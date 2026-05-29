"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TopBar } from "@/app/components/workspace/TopBar";

const accountNav = [
  { label: "Profile", href: "/settings/profile" },
  { label: "Security", href: "/settings/security" },
  { label: "Referrals", href: "/settings/referrals" },
  { label: "Git integration", href: "/settings/git" },
  { label: "Notifications", href: "/settings/notifications" },
];

const teamNav = [
  { label: "Team", href: "/settings/team" },
  { label: "Team Billing", href: "/settings/team/billing" },
  { label: "Team Usage", href: "/settings/team/usage" },
  { label: "Projects Trash", href: "/settings/team/trash" },
];

function SettingsNav() {
  const pathname = usePathname() ?? "";
  return (
    <aside className="w-full shrink-0 border-b border-neutral-900 px-4 py-5 sm:w-64 sm:border-b-0 sm:border-r sm:px-5 sm:py-7">
      <div className="space-y-7">
        <div>
          <p className="px-2 pb-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
            Account
          </p>
          <nav className="space-y-0.5">
            {accountNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm transition ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div>
          <p className="px-2 pb-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
            Team Settings
          </p>
          <nav className="space-y-0.5">
            {teamNav.map((item) => (
              <div
                key={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-600"
              >
                <span>{item.label}</span>
                <span className="ml-auto rounded bg-neutral-900 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-widest text-neutral-500">
                  soon
                </span>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col overflow-y-auto sm:flex-row sm:overflow-hidden">
        <SettingsNav />
        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
