import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { importCards, parseCardJsonPayload } from "@/lib/card-import";
import { requireApiSession, jsonError } from "@/lib/api-session";

export async function POST(request: Request) {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const rawJson = formData.get("json");

  let source = "";

  if (file instanceof File && file.size > 0) {
    source = await file.text();
  } else if (typeof rawJson === "string" && rawJson.trim()) {
    source = rawJson;
  }

  if (!source) {
    return jsonError("Envie um arquivo JSON ou cole o conteúdo.");
  }

  const imported = await importCards(parseCardJsonPayload(source));

  revalidatePath("/master/import");
  revalidatePath("/master");
  revalidatePath("/player");

  return NextResponse.json({
    message: `${imported} carta(s) importada(s) por JSON.`,
  });
}
