# Local Docker Infrastructure

Local development services started by the root [`docker-compose.yml`](../../docker-compose.yml).

| Service  | Image                | Default port | Volume               | Healthcheck      |
| -------- | -------------------- | ------------ | -------------------- | ---------------- |
| postgres | `postgres:17-alpine` | 5432         | `asra_postgres_data` | `pg_isready`     |
| redis    | `redis:7.4-alpine`   | 6379         | `asra_redis_data`    | `redis-cli ping` |

The web app and API run **on the host** (`npm run dev`) for fast hot reload; only stateful
infrastructure runs in Docker.

> Docker PostgreSQL is for **local development only**. Production uses **Neon**.

## Files

- `postgres/init/*.sql` — executed once when the PostgreSQL volume is first created.
- `redis/redis.conf` — AOF persistence and `noeviction` (required by BullMQ).

## Common commands

```bash
docker compose up -d          # start
docker compose ps             # status (expect "healthy")
docker compose logs -f postgres
docker compose down           # stop, keep data
docker compose down -v        # stop and DELETE local data (re-runs init scripts next start)
```

## Port conflicts

If 5432 or 6379 is already in use on your machine, change `POSTGRES_PORT` / `REDIS_PORT`
in `.env` and update `DATABASE_URL`, `DIRECT_DATABASE_URL` and `REDIS_URL` to match.
