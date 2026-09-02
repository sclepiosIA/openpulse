import pytest

from app.repository import PostgresRepository, SessionNotFound


class FakePool:
    def __init__(self):
        self.calls = []

    async def fetch(self, query, *args):
        self.calls.append(("fetch", query, args))
        return []

    async def fetchrow(self, query, *args):
        self.calls.append(("fetchrow", query, args))
        if "count(*)" in query:
            return {"n": 0}
        return None


@pytest.mark.asyncio
async def test_postgres_list_contract_filters_owner_before_pagination():
    repo = PostgresRepository("postgresql://unused")
    pool = FakePool()
    repo._pool = pool
    sessions, total = await repo.list_sessions("owner-1", page=2, page_size=25)
    assert sessions == [] and total == 0
    fetch_call = pool.calls[0]
    assert "where created_by = $1::uuid" in fetch_call[1]
    assert fetch_call[2] == ("owner-1", 25, 25)
    count_call = pool.calls[1]
    assert count_call[2] == ("owner-1",)


@pytest.mark.asyncio
async def test_postgres_get_contract_filters_owner():
    repo = PostgresRepository("postgresql://unused")
    pool = FakePool()
    repo._pool = pool
    with pytest.raises(SessionNotFound):
        await repo.get_session("session-1", "owner-1")
    call = pool.calls[0]
    assert "where id = $1::uuid and created_by = $2::uuid" in call[1]
    assert call[2] == ("session-1", "owner-1")
