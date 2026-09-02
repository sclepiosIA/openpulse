#!/usr/bin/env python3
"""Applique les migrations Drive sous verrou avec registre de checksums."""

from __future__ import annotations

import asyncio
import os
import pathlib
import sys
from typing import Any

ROOT_DIR = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.migration_state import (  # noqa: E402 - direct script execution bootstraps repo root
    MIGRATIONS_DIR,
    migration_files,
    migration_manifest,
    migration_sql,
)

MIGRATION_LOCK_ID = 7_349_216_001
EXPECTED_TABLES = (
    "drive_spaces", "drive_folders", "drive_files", "drive_file_versions",
    "drive_permissions", "drive_sync_devices", "drive_sync_events",
    "drive_audit_logs", "drive_schema_migrations",
    "drive_desktop_refresh_sessions",
    "drive_desktop_handoff_challenges",
)


async def apply_migrations(conn: Any, directory: pathlib.Path = MIGRATIONS_DIR) -> None:
    await conn.execute("select pg_advisory_lock($1)", MIGRATION_LOCK_ID)
    try:
        await conn.execute("""
            create table if not exists drive_schema_migrations (
              version text primary key,
              checksum char(64) not null,
              applied_at timestamptz not null default now()
            )
        """)
        manifest = migration_manifest(directory)
        for sql_file in migration_files(directory):
            sql = migration_sql(sql_file)
            checksum = manifest[sql_file.name]
            existing = await conn.fetchrow(
                "select checksum from drive_schema_migrations where version = $1", sql_file.name,
            )
            if existing:
                if str(existing["checksum"]).strip() != checksum:
                    raise RuntimeError(f"Checksum migration modifié: {sql_file.name}")
                print(f"= {sql_file.name} déjà appliquée")
                continue
            print(f"→ {sql_file.name}")
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "insert into drive_schema_migrations (version, checksum) values ($1, $2)",
                    sql_file.name, checksum,
                )

        missing = []
        for table in EXPECTED_TABLES:
            if await conn.fetchval("select to_regclass($1)", f"public.{table}") is None:
                missing.append(table)
        if missing:
            raise RuntimeError("Schéma Drive incomplet: " + ", ".join(missing))
        for column in ("completed_at", "completion_event_id"):
            exists = await conn.fetchval(
                """
                select exists (
                  select 1 from information_schema.columns
                  where table_schema = 'public'
                    and table_name = 'drive_file_versions'
                    and column_name = $1
                )
                """,
                column,
            )
            if not exists:
                raise RuntimeError(f"Colonne Drive manquante: drive_file_versions.{column}")
    finally:
        await conn.execute("select pg_advisory_unlock($1)", MIGRATION_LOCK_ID)


async def main() -> None:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("DATABASE_URL manquant", file=sys.stderr)
        raise SystemExit(1)
    import asyncpg

    conn = await asyncpg.connect(url)
    try:
        await apply_migrations(conn)
        print("Migrations appliquées et schéma vérifié.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
