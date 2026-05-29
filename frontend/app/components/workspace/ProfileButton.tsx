"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function ProfileButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-full border border-neutral-800 bg-black/60 pl-1 pr-3 transition hover:border-neutral-600"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 text-[0.7rem] font-semibold text-black">
          AS
        </span>
        <span className="hidden text-xs text-neutral-300 sm:inline">Ayush</span>
        <svg
          className={`h-3 w-3 text-neutral-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] backdrop-blur"
        >
          <div className="border-b border-neutral-900 px-4 py-3">
            <p className="text-sm font-medium text-white">Ayush Singh</p>
            <p className="truncate text-[0.7rem] text-neutral-500">
              ayushsinghmi711@gmail.com
            </p>
          </div>
          <div className="py-1">
            <Link
              href="/settings/profile"
              role="menuitem"
              className="block px-4 py-2 text-sm text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Profile
            </Link>
            <Link
              href="/usage"
              role="menuitem"
              className="block px-4 py-2 text-sm text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Usage
            </Link>
            <Link
              href="/settings/profile"
              role="menuitem"
              className="block px-4 py-2 text-sm text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>
          </div>
          <div className="border-t border-neutral-900 py-1">
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2 text-left text-sm text-neutral-500 transition hover:bg-neutral-900"
              onClick={() => setOpen(false)}
            >
              Sign in (soon)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
