"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/topics", label: "Topics", icon: "📋" },
  { href: "/runs", label: "Runs", icon: "⚡" },
  { href: "/blogs", label: "Blogs", icon: "📝" },
  { href: "/skills", label: "Skill Playground", icon: "🧪" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar({ user }: { user: { name?: string; email?: string } }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm font-bold text-white">
          F
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Flo Blog</div>
          <div className="text-xs text-[var(--color-muted)]">Generator</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-border)] p-3">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {user.name ?? "User"}
            </div>
            <div className="truncate text-xs text-[var(--color-muted)]">
              {user.email}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
