import { createClient } from "@supabase/supabase-js";

type GlobalSupabase = typeof globalThis & {
  __dh_supabase_admin__?: ReturnType<typeof createClient> | null;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Configure SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env antes de iniciar.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const db =
  (globalThis as GlobalSupabase).__dh_supabase_admin__ ?? createSupabaseAdmin();

if (process.env.NODE_ENV !== "production") {
  (globalThis as GlobalSupabase).__dh_supabase_admin__ = db as ReturnType<
    typeof createClient
  >;
}

export function assertDb<T>(
  result: { data: T | null; error: { message: string } | null },
  fallbackMessage = "Operação no banco falhou.",
) {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }

  return result.data;
}

export function nowIso() {
  return new Date().toISOString();
}

export function requireSupabaseProjectConfig() {
  return {
    projectId: getEnv("SUPABASE_PROJECT_ID"),
    accessToken: getEnv("SUPABASE_ACCESS_TOKEN"),
  };
}
