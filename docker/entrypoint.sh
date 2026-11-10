#!/bin/sh
set -eu

echo "Applying database migrations"
./node_modules/.bin/prisma migrate deploy

echo "Starting API"
exec node dist/server.js
