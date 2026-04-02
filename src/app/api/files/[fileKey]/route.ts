import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { resolveReferenceFile } from "@/lib/storage";

type FileRouteProps = {
  params: Promise<{ fileKey: string }>;
};

export async function GET(_request: Request, { params }: FileRouteProps) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { fileKey } = await params;
  const file = await readFile(resolveReferenceFile(fileKey));

  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
