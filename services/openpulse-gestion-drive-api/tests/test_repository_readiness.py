from __future__ import annotations

from uuid import uuid4

import pytest

from app.migration_state import migration_manifest
from app.repository import PostgresRepository


class _Acquire:
    def __init__(self, connection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Pool:
    def __init__(self, connection):
        self.connection = connection

    def acquire(self):
        return _Acquire(self.connection)


class _Connection:
    def __init__(self, *, index_present: bool = True, checksum_drift: bool = False):
        self.index_present = index_present
        self.checksum_drift = checksum_drift

    async def fetchval(self, sql: str, *args):
        if "unnest" in sql:
            return len(args[0])
        if "uq_drive_file_versions_completion_event" in sql:
            return "uq_drive_file_versions_completion_event" if self.index_present else None
        raise AssertionError(sql)

    async def fetch(self, sql: str, *args):
        del args
        if "information_schema.columns" in sql:
            return [
                {"column_name": "completed_at"},
                {"column_name": "completion_event_id"},
            ]
        if "drive_schema_migrations" in sql:
            manifest = migration_manifest()
            if self.checksum_drift:
                first = next(iter(manifest))
                manifest[first] = "0" * 64
            return [
                {"version": version, "checksum": checksum}
                for version, checksum in manifest.items()
            ]
        raise AssertionError(sql)


def _repository(connection: _Connection) -> PostgresRepository:
    repository = PostgresRepository("postgresql://unused")
    repository._pool = _Pool(connection)
    return repository


@pytest.mark.asyncio
async def test_readiness_accepts_exact_migration_inventory_columns_and_index() -> None:
    assert await _repository(_Connection()).ping() is True


@pytest.mark.asyncio
async def test_readiness_refuses_migration_checksum_drift() -> None:
    assert await _repository(_Connection(checksum_drift=True)).ping() is False


@pytest.mark.asyncio
async def test_readiness_refuses_missing_completion_index() -> None:
    assert await _repository(_Connection(index_present=False)).ping() is False


class _Transaction:
    def __init__(self, connection: "_CreateConnection") -> None:
        self.connection = connection

    async def __aenter__(self):
        self.connection.transaction_count += 1
        return self

    async def __aexit__(self, exc_type, exc, tb):
        self.connection.transaction_error = exc_type
        return False


class _CreateConnection:
    def __init__(self, *, fail_version_insert: bool = False) -> None:
        self.fail_version_insert = fail_version_insert
        self.transaction_count = 0
        self.transaction_error = None
        self.statements: list[str] = []

    def transaction(self) -> _Transaction:
        return _Transaction(self)

    async def fetchrow(self, sql: str, *args):
        self.statements.append(sql)
        return {"id": args[0]}

    async def execute(self, sql: str, *args):
        del args
        self.statements.append(sql)
        if self.fail_version_insert:
            raise RuntimeError("version insert failed")


@pytest.mark.asyncio
async def test_file_and_initial_version_share_one_transaction_and_connection() -> None:
    connection = _CreateConnection()
    repository = PostgresRepository("postgresql://unused")
    repository._pool = _Pool(connection)
    file_id = uuid4()

    created = await repository.create_file_placeholder(
        file_id=file_id,
        space_id=uuid4(),
        folder_id=None,
        name="preuve.txt",
        path="/preuve.txt",
        blob_container="files",
        blob_name="space/file/preuve.txt",
        content_type="text/plain",
        size_bytes=7,
        sha256="a" * 64,
        actor=uuid4(),
    )

    assert created["id"] == file_id
    assert connection.transaction_count == 1
    assert any("insert into drive_files" in sql for sql in connection.statements)
    assert any("insert into drive_file_versions" in sql for sql in connection.statements)


@pytest.mark.asyncio
async def test_initial_version_failure_leaves_transaction_in_error() -> None:
    connection = _CreateConnection(fail_version_insert=True)
    repository = PostgresRepository("postgresql://unused")
    repository._pool = _Pool(connection)

    with pytest.raises(RuntimeError, match="version insert failed"):
        await repository.create_file_placeholder(
            file_id=uuid4(),
            space_id=uuid4(),
            folder_id=None,
            name="preuve.txt",
            path="/preuve.txt",
            blob_container="files",
            blob_name="space/file/preuve.txt",
            content_type="text/plain",
            size_bytes=7,
            sha256="a" * 64,
            actor=uuid4(),
        )

    assert connection.transaction_count == 1
    assert connection.transaction_error is RuntimeError
