from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from app.migration_state import sha256_text

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "migrate.py"
SPEC = importlib.util.spec_from_file_location("drive_migrate", SCRIPT)
assert SPEC and SPEC.loader
migrate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migrate)


class FakeTransaction:
    def __init__(self, connection: "FakeConnection") -> None:
        self.connection = connection

    async def __aenter__(self):
        self.connection.transaction_count += 1
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeConnection:
    def __init__(self) -> None:
        self.applied: dict[str, str] = {}
        self.executed: list[tuple[str, tuple[object, ...]]] = []
        self.transaction_count = 0
        self.missing_tables: set[str] = set()

    def transaction(self) -> FakeTransaction:
        return FakeTransaction(self)

    async def execute(self, sql: str, *args: object) -> None:
        self.executed.append((sql, args))
        if "insert into drive_schema_migrations" in sql:
            self.applied[str(args[0])] = str(args[1])

    async def fetchrow(self, _sql: str, version: str):
        checksum = self.applied.get(version)
        return {"checksum": checksum} if checksum else None

    async def fetchval(self, _sql: str, table: str):
        return None if table in self.missing_tables else table


def test_migration_inventory_excludes_rollbacks(tmp_path: Path) -> None:
    (tmp_path / "0001_init.sql").write_text("select 1", encoding="utf-8")
    (tmp_path / "0001_init.rollback.sql").write_text("select 2", encoding="utf-8")
    (tmp_path / "README.md").write_text("ignored", encoding="utf-8")

    assert [path.name for path in migrate.migration_files(tmp_path)] == [
        "0001_init.sql"
    ]


def test_desktop_handoff_challenge_migration_is_versioned() -> None:
    migrations_dir = SCRIPT.parents[1] / "migrations"
    manifest = migrate.migration_manifest(migrations_dir)

    assert "0004_desktop_handoff_challenges.sql" in manifest
    sql = (migrations_dir / "0004_desktop_handoff_challenges.sql").read_text(encoding="utf-8")
    assert "drive_desktop_handoff_challenges" in sql
    assert "challenge_hash" in sql
    assert "nonce_hash" in sql


def test_migration_inventory_rejects_embedded_transaction_control(tmp_path: Path) -> None:
    (tmp_path / "0001_bad.sql").write_text("begin;\nselect 1;\ncommit;", encoding="utf-8")
    with pytest.raises(RuntimeError, match="Transaction SQL imbriquée"):
        migrate.migration_manifest(tmp_path)


def test_legacy_0001_wrapper_is_preserved_but_removed_at_execution(tmp_path: Path) -> None:
    migration = tmp_path / "0001_init_drive.sql"
    raw_sql = "-- migration historique\nbegin;\nselect 1;\ncommit;\n"
    migration.write_text(raw_sql, encoding="utf-8")

    assert migrate.migration_manifest(tmp_path) == {
        migration.name: sha256_text(raw_sql),
    }
    executable = migrate.migration_sql(migration)
    assert "begin;" not in executable.lower()
    assert "commit;" not in executable.lower()
    assert "select 1;" in executable


@pytest.mark.asyncio
async def test_legacy_0001_receipt_uses_original_checksum_inside_runner_transaction(
    tmp_path: Path,
) -> None:
    migration = tmp_path / "0001_init_drive.sql"
    raw_sql = "begin;\nselect 1;\ncommit;\n"
    migration.write_text(raw_sql, encoding="utf-8")
    conn = FakeConnection()

    await migrate.apply_migrations(conn, tmp_path)

    assert conn.transaction_count == 1
    assert conn.applied[migration.name] == sha256_text(raw_sql)
    assert any("select 1;" in sql and "begin;" not in sql.lower() for sql, _ in conn.executed)


@pytest.mark.asyncio
async def test_migrations_are_locked_versioned_and_idempotent(tmp_path: Path) -> None:
    migration = tmp_path / "0001_init.sql"
    migration.write_text("select 1", encoding="utf-8")
    conn = FakeConnection()

    await migrate.apply_migrations(conn, tmp_path)
    first_sql_count = sum(sql == "select 1" for sql, _ in conn.executed)
    await migrate.apply_migrations(conn, tmp_path)
    second_sql_count = sum(sql == "select 1" for sql, _ in conn.executed)

    assert first_sql_count == 1
    assert second_sql_count == 1
    assert conn.applied["0001_init.sql"] == sha256_text("select 1")
    assert conn.transaction_count == 1
    assert sum("pg_advisory_lock" in sql for sql, _ in conn.executed) == 2
    assert sum("pg_advisory_unlock" in sql for sql, _ in conn.executed) == 2


@pytest.mark.asyncio
async def test_modified_applied_migration_fails_and_releases_lock(
    tmp_path: Path,
) -> None:
    migration = tmp_path / "0001_init.sql"
    migration.write_text("select 2", encoding="utf-8")
    conn = FakeConnection()
    conn.applied[migration.name] = sha256_text("select 1")

    with pytest.raises(RuntimeError, match="Checksum migration modifié"):
        await migrate.apply_migrations(conn, tmp_path)

    assert any("pg_advisory_unlock" in sql for sql, _ in conn.executed)


@pytest.mark.asyncio
async def test_schema_verification_requires_desktop_refresh_sessions(tmp_path: Path) -> None:
    migration = tmp_path / "0001_init.sql"
    migration.write_text("select 1", encoding="utf-8")
    conn = FakeConnection()
    conn.missing_tables.add("public.drive_desktop_refresh_sessions")

    with pytest.raises(RuntimeError, match="drive_desktop_refresh_sessions"):
        await migrate.apply_migrations(conn, tmp_path)

    assert "drive_desktop_refresh_sessions" in migrate.EXPECTED_TABLES
    assert any("pg_advisory_unlock" in sql for sql, _ in conn.executed)


def test_schema_contract_requires_desktop_handoff_challenges() -> None:
    assert "drive_desktop_handoff_challenges" in migrate.EXPECTED_TABLES
