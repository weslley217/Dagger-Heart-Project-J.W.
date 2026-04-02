import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { UserRole } from "@/types/domain";

const SESSION_COOKIE = "dh_session";

type SessionPayload = {
  userId: string;
  username: string;
  role: UserRole;
};

export function hashPassword(password: string) {
  return createHash("sha256").update(`dh-local:${password}`).digest("hex");
}

export function verifyPassword(password: string, hash: string) {
  return hashPassword(password) === hash;
}

function encodeSession(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeSession(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  return decodeSession(raw);
}

export async function setSession(payload: SessionPayload) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function pathForRole(role: UserRole) {
  return role === "MASTER" ? "/master" : "/player";
}

export async function requireSession(role?: UserRole) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (role && session.role !== role) {
    redirect(pathForRole(session.role));
  }

  return session;
}
