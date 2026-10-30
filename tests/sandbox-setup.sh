#!/bin/bash
# Dựng môi trường kiểm thử trên máy Ubuntu trống (chạy bằng root)
set -e
(apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql >/tmp/apt.log 2>&1)
V=$(ls /usr/lib/postgresql | head -1)
mkdir -p /tmp/pgd && chown postgres /tmp/pgd
su postgres -c "/usr/lib/postgresql/$V/bin/initdb -D /tmp/pgd/data --auth=trust -E UTF8 >/dev/null && /usr/lib/postgresql/$V/bin/pg_ctl -D /tmp/pgd/data -l /tmp/pgd/log -o '-p 5432 -k /tmp' start >/dev/null"
sleep 2
cd /vercel/app && npm install --no-audit --no-fund >/tmp/npm.log 2>&1 && npx next build >/tmp/build.log 2>&1 || { tail -30 /tmp/build.log; exit 1; }
mkdir -p /vercel/e2e && cd /vercel/e2e && npm init -y >/dev/null && npm i playwright@1 >/dev/null 2>&1 && npx playwright install --with-deps chromium >/tmp/pw.log 2>&1
echo setup-done
