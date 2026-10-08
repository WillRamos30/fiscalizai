import path from "node:path";
import { execSync } from "node:child_process";
import fs from "node:fs";

// Cria um banco SQLite limpo e isolado (prisma/test.db) para a suíte de testes.
export default async function setup() {
  const dbPath = path.resolve(__dirname, "..", "prisma", "test.db").replace(/\\/g, "/");
  const url = `file:${dbPath}`;
  for (const f of [dbPath, `${dbPath}-journal`]) if (fs.existsSync(f)) fs.rmSync(f);
  execSync("npx prisma db push --skip-generate --force-reset", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
