import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import { hashPassword } from "@/lib/auth";
import { assertDb, db } from "@/lib/db";

export async function POST(request: Request) {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as {
    username?: string;
    displayName?: string;
    password?: string;
    role?: "PLAYER" | "MASTER";
  };

  const username = body.username?.trim().toLowerCase() ?? "";
  const displayName = body.displayName?.trim() ?? "";
  const password = body.password ?? "";
  const role = body.role ?? "PLAYER";

  if (!username || !displayName || !password) {
    return jsonError("Usuário, nome e senha são obrigatórios.");
  }

  if (password.length < 4) {
    return jsonError("Senha deve ter no mínimo 4 caracteres.");
  }

  const existing = assertDb(
    await db.from("app_users").select("id").eq("username", username).maybeSingle(),
    "Falha ao validar usuário existente.",
  ) as { id: string } | null;

  if (existing) {
    return jsonError("Já existe um usuário com esse login.");
  }

  const created = assertDb(
    await db
      .from("app_users")
      .insert({
        username,
        display_name: displayName,
        password_hash: hashPassword(password),
        role,
        active: true,
      })
      .select("id,username,display_name,role,active")
      .single(),
    "Falha ao criar novo usuário.",
  );

  revalidatePath("/master");

  return NextResponse.json({
    message: `Acesso criado para ${displayName}.`,
    user: created,
  });
}
