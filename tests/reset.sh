#!/bin/bash
# Dùng khi kiểm thử trên máy chủ thử: xóa CSDL, khởi động lại ứng dụng
pkill -f "next start" ; sleep 1
psql -h 127.0.0.1 -U postgres -c "drop database if exists qlcv" -c "create database qlcv" >/dev/null
cd /vercel/app && (DATABASE_URL=postgres://postgres@127.0.0.1:5432/qlcv AUTH_SECRET=test-secret-0123456789abcdef SETUP_KEY=khoitao nohup npx next start -p 3000 > /tmp/app.log 2>&1 &)
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:3000/dang-nhap && break; sleep 1; done
echo reset-done
