"use client";
import { useEffect, useState } from "react";

const KEY = "qlcv_ten_dang_nhap";

/** Ô tên đăng nhập + mật khẩu, có ghi nhớ tên đăng nhập trên thiết bị này */
export function LoginFields() {
  const [u, setU] = useState("");
  const [remember, setRemember] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        setU(saved);
        setRemember(true);
        setTimeout(() => document.getElementById("p")?.focus(), 0);
      }
    } catch {}
  }, []);
  const persist = (name: string, on: boolean) => {
    try {
      if (on && name) localStorage.setItem(KEY, name);
      else localStorage.removeItem(KEY);
    } catch {}
  };
  return (
    <>
      <div>
        <label className="label" htmlFor="u">
          Tên đăng nhập
        </label>
        <input
          id="u"
          name="ten_dang_nhap"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          required
          autoFocus
          value={u}
          onChange={(e) => {
            setU(e.target.value);
            persist(e.target.value.trim().toLowerCase(), remember);
          }}
        />
      </div>
      <div>
        <label className="label" htmlFor="p">
          Mật khẩu
        </label>
        <input id="p" name="mat_khau" type="password" className="input" autoComplete="current-password" required />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={remember}
            onChange={(e) => {
              setRemember(e.target.checked);
              persist(u.trim().toLowerCase(), e.target.checked);
            }}
          />
          Ghi nhớ tên đăng nhập
        </label>
        <a href={`/quen-mat-khau${u ? `?u=${encodeURIComponent(u.trim().toLowerCase())}` : ""}`} className="font-medium text-brand-700 underline">
          Quên mật khẩu?
        </a>
      </div>
    </>
  );
}
