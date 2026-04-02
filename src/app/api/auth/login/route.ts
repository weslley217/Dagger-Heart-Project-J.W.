import { NextResponse } from "next/server";

import { pathForRole, setSession, verifyPassword } from "@/lib/auth";
import { assertDb, db } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    username?: string;
    password?: string;
    role?: "PLAYER" | "MASTER";
  };

  if (!body.username || !body.password || !body.role) {
    return NextResponse.json(
      { error: "Usuário, senha e perfil são obrigatórios." },
      { status: 400 },
    );
  }

  const user = assertDb(
    await db
      .from("app_users")
      .select("*")
      .eq("username", body.username.trim())
      .maybeSingle(),
    "Falha ao autenticar usuário.",
  ) as {
    id: string;
    username: string;
    password_hash: string;
    role: "PLAYER" | "MASTER";
    active: boolean;
  } | null;

  if (
    !user ||
    !user.active ||
    user.role !== body.role ||
    !verifyPassword(body.password, user.password_hash)
  ) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  await setSession({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  return NextResponse.json({
    redirectTo: pathForRole(user.role),
  });
}
