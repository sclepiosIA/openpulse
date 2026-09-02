#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import tarfile
import time
from pathlib import Path

from azure.storage.blob import BlobServiceClient, ContentSettings

SOURCE_HOST = os.environ.get('SOURCE_PG_HOST', 'aws-0-eu-west-3.pooler.supabase.com')
SOURCE_PORT = os.environ.get('SOURCE_PG_PORT', '5432')
SOURCE_DB = os.environ.get('SOURCE_PG_DB', 'postgres')
SOURCE_USER = os.environ.get('SOURCE_PG_USER', 'postgres.openpulse')
SOURCE_PASS = os.environ['SOURCE_PG_PASSWORD']

TARGET_HOST = os.environ.get('TARGET_PG_HOST', 'db.openpulse.example.org')
TARGET_PORT = os.environ.get('TARGET_PG_PORT', '5432')
TARGET_DB = os.environ.get('TARGET_PG_DB', 'gestion')
TARGET_ADMIN_DB = os.environ.get('TARGET_PG_ADMIN_DB', 'postgres')
TARGET_USER = os.environ.get('TARGET_PG_USER', 'gsiadmin')
TARGET_PASS = os.environ['TARGET_PG_PASSWORD']

BLOB_CONN = os.environ['AZURE_BLOB_CONNECTION_STRING']
BLOB_CONTAINER = os.environ.get('BLOB_CONTAINER', 'db-exports')
SYNC_MODE = os.environ.get('SYNC_MODE', 'restore')  # restore | dump-only

WORK = Path('/tmp/gestion-sync')
DUMP = WORK / 'gestion_full.dump'
SCHEMA = WORK / 'schema.sql'
RESTORE_LOG = WORK / 'pgrestore.log'
MANIFEST = WORK / 'manifest.json'
ARCHIVE = Path('/tmp/gestion-sync-artifact.tar.gz')


def run(cmd: list[str], *, env: dict[str, str] | None = None, check: bool = True, stdout=None, stderr=None) -> subprocess.CompletedProcess:
    print('+', ' '.join(cmd[:3]), '...')
    return subprocess.run(cmd, env=env, check=check, text=True, stdout=stdout, stderr=stderr)


def pg_env(password: str) -> dict[str, str]:
    env = os.environ.copy()
    env['PGPASSWORD'] = password
    return env


def psql(db: str, sql: str, *, check: bool = True) -> subprocess.CompletedProcess:
    return run([
        'psql',
        f'host={TARGET_HOST} port={TARGET_PORT} dbname={db} user={TARGET_USER} sslmode=require',
        '-v', 'ON_ERROR_STOP=1' if check else 'ON_ERROR_STOP=0',
        '-c', sql,
    ], env=pg_env(TARGET_PASS), check=check)


def query_counts() -> dict[str, int | str]:
    q = """
    select json_build_object(
      'public_tables', (select count(*) from information_schema.tables where table_schema='public'),
      'auth_tables', (select count(*) from information_schema.tables where table_schema='auth'),
      'storage_tables', (select count(*) from information_schema.tables where table_schema='storage'),
      'public_policies', (select count(*) from pg_policies where schemaname='public'),
      'profiles', coalesce((select count(*) from public.profiles),0),
      'etablissements', coalesce((select count(*) from public.etablissements),0),
      'email_messages', coalesce((select count(*) from public.email_messages),0),
      'taches', coalesce((select count(*) from public.taches),0)
    );
    """
    proc = subprocess.run([
        'psql', f'host={TARGET_HOST} port={TARGET_PORT} dbname={TARGET_DB} user={TARGET_USER} sslmode=require',
        '-Atc', q,
    ], env=pg_env(TARGET_PASS), text=True, check=True, stdout=subprocess.PIPE)
    return json.loads(proc.stdout.strip())


def upload(path: Path, blob_name: str, content_type='application/octet-stream') -> None:
    svc = BlobServiceClient.from_connection_string(BLOB_CONN)
    cc = svc.get_container_client(BLOB_CONTAINER)
    try:
        cc.create_container()
    except Exception:
        pass
    with path.open('rb') as f:
        cc.upload_blob(blob_name, f, overwrite=True, content_settings=ContentSettings(content_type=content_type))
    print('uploaded', blob_name)


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    ts = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
    source_conn = [f'host={SOURCE_HOST} port={SOURCE_PORT} dbname={SOURCE_DB} user={SOURCE_USER} sslmode=require']

    # Dump source Supabase/la plateforme initiale.
    pgdump_err = WORK / 'pgdump.err'
    with pgdump_err.open('w') as err:
        proc = run(['pg_dump', *source_conn, '--format=custom', '--blobs', '--verbose', f'--file={DUMP}'], env=pg_env(SOURCE_PASS), stderr=err, check=False)
    if proc.returncode != 0:
        tail = '\n'.join(pgdump_err.read_text(errors='replace').splitlines()[-80:])
        print('PG_DUMP_FAILED_TAIL_START')
        print(tail)
        print('PG_DUMP_FAILED_TAIL_END')
        raise SystemExit(proc.returncode)

    schema_err = WORK / 'schema.err'
    with schema_err.open('w') as err:
        proc = run(['pg_dump', *source_conn, '--schema-only', '--no-owner', '--no-privileges', f'--file={SCHEMA}'], env=pg_env(SOURCE_PASS), stderr=err, check=False)
    if proc.returncode != 0:
        tail = '\n'.join(schema_err.read_text(errors='replace').splitlines()[-80:])
        print('SCHEMA_DUMP_FAILED_TAIL_START')
        print(tail)
        print('SCHEMA_DUMP_FAILED_TAIL_END')
        raise SystemExit(proc.returncode)

    pre_counts = None
    restore_errors: list[str] = []

    if SYNC_MODE == 'restore':
        # Reset mirror DB. This DB is intentionally a mirror of la plateforme initiale until cutover.
        psql(TARGET_ADMIN_DB, f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='{TARGET_DB}';")
        psql(TARGET_ADMIN_DB, f'DROP DATABASE IF EXISTS {TARGET_DB};')
        psql(TARGET_ADMIN_DB, f'CREATE DATABASE {TARGET_DB};')

        prelude = WORK / 'azure_supabase_prelude.sql'
        prelude.write_text("""
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists realtime;
create schema if not exists vault;
create extension if not exists citext with schema public;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists vector with schema public;
""")
        run(['psql', f'host={TARGET_HOST}', f'port={TARGET_PORT}', f'dbname={TARGET_DB}', f'user={TARGET_USER}', 'sslmode=require', '-v', 'ON_ERROR_STOP=0', '-f', str(prelude)], env=pg_env(TARGET_PASS), check=False)
        with RESTORE_LOG.open('w') as out:
            run(['pg_restore', f'--host={TARGET_HOST}', f'--port={TARGET_PORT}', f'--username={TARGET_USER}', f'--dbname={TARGET_DB}', '--no-owner', '--no-privileges', '--verbose', str(DUMP)], env=pg_env(TARGET_PASS), check=False, stdout=out, stderr=subprocess.STDOUT)
        log = RESTORE_LOG.read_text(errors='replace')
        restore_errors = [line for line in log.splitlines() if 'ERROR:' in line or 'FATAL:' in line]
        pre_counts = query_counts()

    manifest = {
        'timestamp': ts,
        'source': 'plateforme-edition-supabase-openpulse',
        'target': 'psql-openpulse-gestion-prod/gestion',
        'mode': SYNC_MODE,
        'dump_bytes': DUMP.stat().st_size,
        'schema_bytes': SCHEMA.stat().st_size,
        'restore_error_count': len(restore_errors),
        'restore_error_sample': restore_errors[:50],
        'counts': pre_counts,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    with tarfile.open(ARCHIVE, 'w:gz') as tar:
        for path in [DUMP, SCHEMA, WORK / 'pgdump.err', WORK / 'schema.err', RESTORE_LOG, MANIFEST]:
            if path.exists():
                tar.add(path, arcname=path.name)
    upload(ARCHIVE, f'pgsync/{ts}/gestion-sync-artifact.tar.gz', 'application/gzip')
    upload(MANIFEST, f'pgsync/{ts}/manifest.json', 'application/json')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
