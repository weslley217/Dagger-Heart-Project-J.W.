import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { importCards } from "@/lib/card-import";
import { requireApiSession, jsonError } from "@/lib/api-session";
import type { CardEffect } from "@/types/domain";

export async function POST(request: Request) {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const formData = await request.formData();
  const id = formData.get("id");
  const name = formData.get("name");
  const category = formData.get("category");
  const text = formData.get("text");

  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof category !== "string" ||
    typeof text !== "string"
  ) {
    return jsonError("Campos obrigatórios ausentes.");
  }

  const effectsRaw = formData.get("effectsJson");
  const effects =
    typeof effectsRaw === "string" && effectsRaw.trim()
      ? (JSON.parse(effectsRaw) as CardEffect[])
      : undefined;

  const keywordsRaw = formData.get("keywords");
  const keywords =
    typeof keywordsRaw === "string" && keywordsRaw.trim()
      ? keywordsRaw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;

  await importCards([
    {
      id,
      name,
      category: category as
        | "classe"
        | "subclasse"
        | "dominio"
        | "comunidade"
        | "ancestralidade"
        | "outros",
      classKey: stringOrNull(formData.get("classKey")),
      subclassKey: stringOrNull(formData.get("subclassKey")),
      domainKey: stringOrNull(formData.get("domainKey")),
      tier: stringOrNull(formData.get("tier")),
      text,
      keywords,
      effects,
    },
  ]);

  revalidatePath("/master/import");
  revalidatePath("/master");
  revalidatePath("/player");

  return NextResponse.json({
    message: "Carta salva manualmente.",
  });
}

function stringOrNull(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : null;
}
