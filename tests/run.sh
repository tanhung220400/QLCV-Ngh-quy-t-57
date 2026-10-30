#!/bin/bash
# Kéo mã mới, build, xóa CSDL thử, chạy kiểm thử đầu-cuối. Kết quả ở /tmp/e2e.log
cd /vercel/app && git pull -q
rm -f /tmp/e2e.log /tmp/e2e.done
npx next build >/tmp/build.log 2>&1 || { echo "BUILD FAILED" > /tmp/e2e.log; tail -40 /tmp/build.log >> /tmp/e2e.log; touch /tmp/e2e.done; exit 1; }
bash tests/reset.sh >/dev/null
NODE_PATH=/vercel/e2e/node_modules timeout 600 node tests/e2e.cjs > /tmp/e2e.log 2>&1
echo "--- app errors" >> /tmp/e2e.log
grep -iE "⨯|error" /tmp/app.log | head -20 | cut -c1-300 >> /tmp/e2e.log
touch /tmp/e2e.done
