#!/bin/sh
# Apply pending DB migrations, then start the API. A failed migration stops the container
# (restart policy retries) instead of running new code against an old schema.
set -e
npx prisma migrate deploy
exec node dist/main
