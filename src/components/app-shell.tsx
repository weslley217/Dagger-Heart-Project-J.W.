"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenText,
  Download,
  LayoutDashboard,
  LogOut,
  Shield,
  Swords,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/domain";

type AppShellProps = {
  role: UserRole;
  title: string;
  subtitle: string;
  children: ReactNode;
};

const navigation = {
  PLAYER: [
    { href: "/player", label: "Personagens", shortLabel: "Fichas", icon: LayoutDashboard },
  ],
  MASTER: [
    { href: "/master", label: "Painel do Mestre", shortLabel: "Mestre", icon: Shield },
    { href: "/master/import", label: "Importador", shortLabel: "Importar", icon: Download },
  ],
} as const;

export function AppShell({ role, title, subtitle, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    startTransition(() => {
      router.push("/login");
      router.refresh();
    });
    setLoggingOut(false);
  }

  const items = navigation[role];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(19,107,102,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(225,167,75,0.18),transparent_42%)]" />
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-5 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6">
        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-5 rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(7,18,27,0.95),rgba(8,13,18,0.86))] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.36)]">
            <div className="space-y-3">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#d4b16a,#3db2a7)] text-[#081116] shadow-[0_20px_40px_rgba(23,186,170,0.22)]">
                {role === "MASTER" ? (
                  <Swords className="h-6 w-6" />
                ) : (
                  <BookOpenText className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-white/45">
                  Daggerheart Hub
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
                <p className="mt-2 text-sm leading-6 text-white/60">{subtitle}</p>
              </div>
            </div>

            <nav className="space-y-2">
              {items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                      active
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "text-white/70 hover:bg-white/7 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="rounded-[28px] border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Sessão local</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Persistência em Supabase com snapshots por campanha e atualização em tempo real.
              </p>
            </div>

            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={handleLogout}
              disabled={loggingOut || isPending}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-5 pb-24 lg:pb-5">{children}</main>
      </div>

      <nav className="fixed inset-x-4 bottom-4 z-40 grid grid-cols-3 gap-2 rounded-[28px] border border-white/10 bg-[rgba(6,11,16,0.86)] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold",
                active ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-white/70",
              )}
            >
              <Icon className="mb-1 h-4 w-4" />
              {item.shortLabel}
            </Link>
          );
        })}
        <button
          className="flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold text-white/70"
          onClick={handleLogout}
          disabled={loggingOut || isPending}
        >
          <LogOut className="mb-1 h-4 w-4" />
          Sair
        </button>
      </nav>
    </div>
  );
}
