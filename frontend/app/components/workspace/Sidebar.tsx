"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
  match?: string;
};

const primaryNav: NavItem[] = [
  { label: "Chat", href: "/chat", icon: "chat" },
  { label: "Playground", href: "/playground", icon: "play" },
  { label: "Browse models", href: "/models", icon: "models" },
  { label: "Inbox", href: "/inbox", icon: "inbox", disabled: true },
  { label: "My tasks", href: "/tasks", icon: "tasks", disabled: true },
  { label: "Usage", href: "/usage", icon: "usage" },
  { label: "Settings", href: "/settings/profile", icon: "settings", match: "/settings" },
];

type ProjectItem = { label: string; href: string; disabled?: boolean };

const projectsNav: ProjectItem[] = [
  { label: "All projects", href: "/projects", disabled: true },
  { label: "Archived", href: "/projects/archived", disabled: true },
];

function NavIcon({ name }: { name: string }) {
  const common = "h-4 w-4 shrink-0";
  switch (name) {
    case "chat":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12Z" />
        </svg>
      );
    case "inbox":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13a1 1 0 0 1 1 .76L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6L4.5 5.76A1 1 0 0 1 5.5 5Z" />
        </svg>
      );
    case "tasks":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
        </svg>
      );
    case "usage":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l4-4 4 4 5-6" />
        </svg>
      );
    case "play":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <polygon points="6 4 20 12 6 20 6 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "models":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2 2 7l10 5 10-5-10-5Z M2 17l10 5 10-5 M2 12l10 5 10-5" />
        </svg>
      );
    case "settings":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.4 16.97l.06-.06A1.65 1.65 0 0 0 4.79 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1A1.65 1.65 0 0 0 4.27 7.18l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-neutral-900 bg-black text-white md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-900 px-4">
        <Link href="/" className="flex items-center gap-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/logo.svg" alt="" aria-hidden="true" className="h-6 w-6" />
          <span className="text-base font-semibold tracking-tight">onfide</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        <p className="px-3 pb-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
          My Workspace
        </p>
        <nav className="space-y-0.5">
          {primaryNav.map((item) => {
            const active =
              item.href === pathname ||
              (typeof item.match === "string" && pathname.startsWith(item.match));
            const base =
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition";
            const cls = item.disabled
              ? `${base} cursor-not-allowed text-neutral-600`
              : active
              ? `${base} bg-neutral-900 text-white`
              : `${base} text-neutral-300 hover:bg-neutral-900 hover:text-white`;
            const inner = (
              <>
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
                {item.disabled && (
                  <span className="ml-auto rounded bg-neutral-900 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-widest text-neutral-500">
                    soon
                  </span>
                )}
              </>
            );
            return item.disabled ? (
              <div key={item.label} className={cls}>
                {inner}
              </div>
            ) : (
              <Link key={item.label} href={item.href} className={cls}>
                {inner}
              </Link>
            );
          })}
        </nav>

        <p className="mt-6 px-3 pb-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
          Projects
        </p>
        <nav className="space-y-0.5">
          {projectsNav.map((item) => (
            <div
              key={item.label}
              className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-neutral-600"
            >
              <span className="h-1 w-1 rounded-full bg-neutral-700" />
              <span>{item.label}</span>
            </div>
          ))}
          <div className="px-3 py-3 text-xs text-neutral-600">No projects yet</div>
        </nav>
      </div>

      <div className="shrink-0 border-t border-neutral-900 px-4 py-3 text-[0.65rem] uppercase tracking-[0.2em] text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          NEAR TEE connected
        </span>
      </div>
    </aside>
  );
}
