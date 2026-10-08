import { prisma } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";
import { invalidate } from "@/lib/cache";
import { hashPassword } from "@/modules/auth/password";
import { MockCollector } from "@/modules/ingestion/collectors/mock";
import { ensureReferenceData } from "@/modules/ingestion/reference";
import { runFullSync } from "@/modules/ingestion/sync";
import { ensureDefaultAlgorithm } from "@/modules/scoring/algorithm";
import { signSession } from "@/modules/auth/session";
import type { Role } from "@/lib/constants";

export const NOW = new Date(Date.UTC(2026, 9, 5, 12, 0, 0)); // data fixa → testes determinísticos

// Limpa todas as tabelas (ordem respeitando FKs). AuditLog é append-only (o guard bloqueia deleteMany),
// por isso usamos SQL direto APENAS no banco de teste.
export async function resetDb() {
  const tables = [
    "PopularVote", "ScoreComponent", "Score", "Fact", "CorrectionTicket", "Favorite", "DataCoverage", "LegalCase", "Donation",
    "Election", "Asset", "Amendment", "Expense", "Committee", "Attendance", "Vote", "Project", "Mandate", "Politician",
    "Municipality", "Party", "DataImport", "AuditLog", "AlgorithmVersion", "Source", "Office", "State", "User",
  ];
  for (const t of tables) await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`);
  resetRateLimits();
  invalidate();
}

export async function seedDemo() {
  await ensureReferenceData(prisma, { demoSources: true });
  await ensureDefaultAlgorithm(prisma);
  return runFullSync(prisma, new MockCollector(), { now: NOW });
}

export async function makeUser(email: string, role: Role = "USER", password = "Senha#Teste12345") {
  return prisma.user.create({ data: { email, name: `Teste ${email}`, role, passwordHash: await hashPassword(password) } });
}

export async function cookieFor(user: { id: string; role: string; tokenVersion: number }) {
  const token = await signSession({ sub: user.id, role: user.role as Role, tv: user.tokenVersion });
  return `avaliador_session=${token}`;
}

export function req(url: string, init: RequestInit & { cookie?: string; json?: unknown } = {}): Request {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  let body = init.body;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    headers.set("content-type", "application/json");
  }
  return new Request(`http://localhost:3000${url}`, { ...init, headers, body });
}

export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
