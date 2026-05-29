"use client";

import { usePathname } from "next/navigation";
import { ProfileButton } from "./ProfileButton";

const titleMap: Record<string, string> = {
  "/chat": "Workspace",
  "/usage": "Usage",
  "/models": "Browse models",
  "/settings/profile": "Profile",
  "/settings/security": "Security",
  "/settings/git": "Git integration",
  "/settings/notifications": "Notifications",
};

export function TopBar({ rightSlot }: { rightSlot?: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const title =
    titleMap[pathname] ??
    (pathname.startsWith("/settings") ? "Settings" : "Confide");

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-900 bg-black px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-sm font-medium text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {rightSlot}
        <ProfileButton />
      </div>
    </header>
  );
}
