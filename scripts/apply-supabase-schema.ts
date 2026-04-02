import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

const projectId = process.env.SUPABASE_PROJECT_ID;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

async function main() {
  if (!projectId) {
    throw new Error("SUPABASE_PROJECT_ID não definido.");
  }

  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN não definido.");
  }

  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  const query = await readFile(schemaPath, "utf8");

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectId}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao aplicar schema no Supabase: ${response.status} ${body}`);
  }

  console.log("Schema aplicado com sucesso no Supabase.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
