"use client";

import { useState, useTransition } from "react";
import { Lock, Shield, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

type Role = "PLAYER" | "MASTER";

const presets: Array<{
  role: Role;
  title: string;
  username: string;
  password: string;
  icon: typeof UserCircle2;
  summary: string;
}> = [
  {
    role: "PLAYER",
    title: "Jogador",
    username: "joao",
    password: "1234",
    icon: UserCircle2,
    summary: "Acesso à home, criador de ficha, fichas base e campanhas abertas.",
  },
  {
    role: "MASTER",
    title: "Mestre",
    username: "mestre",
    password: "123456",
    icon: Shield,
    summary: "Cria campanhas, logins de jogador e controla a aventura em tempo real.",
  },
];

export function LoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("PLAYER");
  const [username, setUsername] = useState("joao");
  const [password, setPassword] = useState("1234");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role,
        username,
        password,
      }),
    });

    const data = (await response.json()) as { error?: string; redirectTo?: string };

    if (!response.ok) {
      setError(data.error ?? "Não foi possível iniciar a sessão.");
      return;
    }

    startTransition(() => {
      router.push(data.redirectTo ?? "/player");
      router.refresh();
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(25,129,125,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(214,169,88,0.18),transparent_42%)]" />
      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-6 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.42em] text-white/45">
            Daggerheart Control Room
          </p>
          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-semibold text-white md:text-6xl">
              Fichas responsivas, campanhas vivas e um painel completo para mestre.
            </h1>
            <p className="max-w-xl text-base leading-7 text-white/65 md:text-lg">
              O acesso de jogador é criado pelo mestre dentro da plataforma. Entre com seu login
              para jogar ou mestrar.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {presets.map((preset) => {
              const Icon = preset.icon;
              const active = role === preset.role;

              return (
                <button
                  key={preset.role}
                  className={`rounded-[28px] border p-5 text-left transition ${
                    active
                      ? "border-transparent bg-[linear-gradient(135deg,rgba(212,177,106,0.32),rgba(20,118,111,0.28))]"
                      : "border-white/10 bg-white/4"
                  }`}
                  onClick={() => {
                    setRole(preset.role);
                    setUsername(preset.username);
                    setPassword(preset.password);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-black/20 text-[#f3e2b4]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-lg font-semibold text-white">{preset.title}</p>
                      <p className="text-sm text-white/50">
                        {preset.username} / {preset.password}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/65">{preset.summary}</p>
                </button>
              );
            })}
          </div>
        </div>

        <SurfaceCard className="mx-auto w-full max-w-xl border-white/12 p-6 md:p-8">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-white/45">Entrar</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Selecionar perfil</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["PLAYER", "MASTER"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    role === option
                      ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border-white/10 bg-white/4 text-white/75"
                  }`}
                  onClick={() => {
                    setRole(option);
                    setUsername(option === "PLAYER" ? "joao" : "mestre");
                    setPassword(option === "PLAYER" ? "1234" : "123456");
                  }}
                >
                  {option === "PLAYER" ? "Jogador" : "Mestre"}
                </button>
              ))}
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-white/70">Usuário</span>
              <input
                className="field"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="joao"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-white/70">Senha</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  type="password"
                  className="field pl-11"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="1234"
                />
              </div>
            </label>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Entrando..." : "Entrar agora"}
            </Button>
          </form>
        </SurfaceCard>
      </div>
    </div>
  );
}
