import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function resolveDbPath(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL precisa usar o formato file: para SQLite.");
  }

  const relativePath = databaseUrl.replace(/^file:/, "");
  return path.resolve(process.cwd(), relativePath);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não definida.");
  }

  const sqlPath = path.join(process.cwd(), "prisma", "init.sql");
  const sql = await readFile(sqlPath, "utf8");
  const dbPath = resolveDbPath(databaseUrl);
  const database = new DatabaseSync(dbPath);

  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(sql);
  database.close();

  console.log(`Banco SQLite preparado em ${dbPath}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
