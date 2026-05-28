"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

const navLinks = [
  { name: "Features", href: "/#features" },
  { name: "Pricing", href: "/#pricing" },
];

const ENTER_EASE = [0.16, 1, 0.3, 1] as const;

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isMobileMenuOpen]);

  return (
    <motion.header
      ref={headerRef}
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.75, ease: ENTER_EASE }}
      className={`fixed z-50 transition-[top,left,right] duration-500 ${
        isScrolled ? "left-4 right-4 top-4" : "left-0 right-0 top-0"
      }`}
    >
      <nav
        style={{
          transitionProperty:
            "max-width, background-color, border-color, border-radius, box-shadow, backdrop-filter, -webkit-backdrop-filter",
          transitionDuration: "600ms",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "max-width, background-color, backdrop-filter",
        }}
        className={`mx-auto border ${
          isScrolled || isMobileMenuOpen
            ? "max-w-[1200px] rounded-2xl border-neutral-800 bg-black/70 shadow-[0_0_40px_-12px_rgba(255,255,255,0.15)] backdrop-blur-xl"
            : "max-w-[1400px] rounded-none border-transparent bg-transparent shadow-none backdrop-blur-0"
        }`}
      >
        <div
          style={{
            transitionProperty: "height, padding",
            transitionDuration: "600ms",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          className={`flex items-center justify-between px-6 lg:px-8 ${
            isScrolled ? "h-14" : "h-20"
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: ENTER_EASE }}
          >
            <Link href="/" className="flex items-center gap-2">
              <span
                className={`font-semibold tracking-tight text-white transition-all duration-500 ${
                  isScrolled ? "text-xl" : "text-2xl"
                }`}
              >
                Confide
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-neutral-800 bg-black/50 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-neutral-400 backdrop-blur sm:inline-flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://s3.coinmarketcap.com/static-gravity/image/ef3ad80e423a4449ab8e961b0d1edea4.png"
                  alt="NEAR"
                  className="h-3 w-3 rounded-full"
                />
                on NEAR
              </span>
            </Link>
          </motion.div>

          <div className="hidden items-center gap-12 md:flex">
            {navLinks.map((link, i) => (
              <motion.a
                key={link.name}
                href={link.href}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.32 + i * 0.08, ease: ENTER_EASE }}
                className="group relative text-sm font-medium text-neutral-400 transition-colors duration-300 hover:text-white"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-all duration-300 group-hover:w-full" />
              </motion.a>
            ))}
          </div>

          <motion.div
            className="hidden items-center gap-4 md:flex"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.56, ease: ENTER_EASE }}
          >
            <Link
              href="/chat"
              className={`inline-flex items-center rounded-full bg-white font-medium text-black transition-all duration-500 hover:bg-neutral-200 ${
                isScrolled ? "h-8 px-4 text-xs" : "h-10 px-6 text-sm"
              }`}
            >
              Open the IDE
            </Link>
          </motion.div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((o) => !o)}
            className="p-2 text-white md:hidden"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <div
        className={`absolute left-3 right-3 top-full mt-2 origin-top transition-all duration-300 md:hidden ${
          isMobileMenuOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
        aria-hidden={!isMobileMenuOpen}
      >
        <nav className="flex flex-col gap-1 rounded-2xl border border-neutral-800 bg-black p-3 shadow-xl">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-neutral-200 transition hover:bg-neutral-900"
            >
              {link.name}
            </a>
          ))}
          <Link
            href="/chat"
            onClick={() => setIsMobileMenuOpen(false)}
            className="mt-2 flex w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
          >
            Open the IDE
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}
