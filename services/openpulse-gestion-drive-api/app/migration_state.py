"""Inventaire canonique et checksums des migrations Drive embarquées."""

from __future__ import annotations

import hashlib
import pathlib
import re

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parent.parent / "migrations"
_TRANSACTION_CONTROL = re.compile(r"(?im)^\s*(begin|commit|rollback)\s*;")
_LEGACY_WRAPPED_MIGRATIONS = {"0001_init_drive.sql"}


def migration_files(directory: pathlib.Path = MIGRATIONS_DIR) -> list[pathlib.Path]:
    return [path for path in sorted(directory.glob("[0-9]*.sql")) if ".rollback." not in path.name]


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def migration_sql(path: pathlib.Path) -> str:
    """Return transaction-free SQL without rewriting an applied migration.

    The original 0001 file shipped with a top-level BEGIN/COMMIT wrapper. Its
    bytes—and therefore its historical checksum—must remain immutable. The
    runner strips only that exact legacy wrapper in memory before executing the
    statements inside its own transaction. Any transaction control in another
    migration remains a hard error.
    """
    sql = path.read_text(encoding="utf-8")
    controls = [match.group(1).lower() for match in _TRANSACTION_CONTROL.finditer(sql)]
    if not controls:
        return sql
    if path.name in _LEGACY_WRAPPED_MIGRATIONS and controls == ["begin", "commit"]:
        return _TRANSACTION_CONTROL.sub("", sql)
    raise RuntimeError(f"Transaction SQL imbriquée interdite: {path.name}")


def migration_manifest(directory: pathlib.Path = MIGRATIONS_DIR) -> dict[str, str]:
    manifest: dict[str, str] = {}
    for path in migration_files(directory):
        raw_sql = path.read_text(encoding="utf-8")
        migration_sql(path)  # validation fail-closed avant calcul du reçu
        manifest[path.name] = sha256_text(raw_sql)
    return manifest
