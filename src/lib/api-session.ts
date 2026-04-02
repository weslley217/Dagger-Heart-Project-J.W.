import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import type { UserRole } from "@/types/domain";

export async function requireApiSession(role?: UserRole) {
  const session = await getSession();

  if (!session) {
    return {
      error: NextResponse.json({ error: "Sessão inválida." }, { status: 401 }),
    };
  }

  if (role && session.role !== role) {
    return {
      error: NextResponse.json({ error: "Sem permissão para esta ação." }, { status: 403 }),
    };
  }

  return { session };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
