// Seed de DEMONSTRAÇÃO: referência + usuários de teste + políticos FICTÍCIOS + fatos + votos + notas.
// Uso: npm run db:seed   (ou npm run setup)

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/modules/auth/password";
import { audit } from "../src/modules/audit/audit";
import { ensureReferenceData } from "../src/modules/ingestion/reference";
import { MockCollector, DEMO_PEOPLE } from "../src/modules/ingestion/collectors/mock";
import { runFullSync } from "../src/modules/ingestion/sync";
import { ensureDefaultAlgorithm } from "../src/modules/scoring/algorithm";
import { recalculateAll } from "../src/modules/scoring/run";

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function upsertUser(email: string, name: string, password: string, role: string) {
  const passwordHash = await hashPassword(password);
  return prisma.user.upsert({
    where: { email },
    update: { role, name },
    create: { email, name, passwordHash, role },
  });
}

async function main() {
  console.log("▶ Dados de referência e algoritmo…");
  await ensureReferenceData(prisma, { demoSources: true });
  await ensureDefaultAlgorithm(prisma);

  console.log("▶ Usuários de demonstração…");
  const admin = await upsertUser(
    process.env.SEED_ADMIN_EMAIL ?? "admin@avaliador.demo",
    "Administrador (demo)",
    process.env.SEED_ADMIN_PASSWORD ?? "Admin#Demo2026",
    "ADMIN",
  );
  await upsertUser(
    process.env.SEED_USER_EMAIL ?? "usuario@avaliador.demo",
    "Usuário (demo)",
    process.env.SEED_USER_PASSWORD ?? "Usuario#Demo2026",
    "USER",
  );
  await upsertUser("moderador@avaliador.demo", "Moderador (demo)", "Moderador#Demo2026", "MODERATOR");

  console.log("▶ Importando políticos FICTÍCIOS (MockCollector)…");
  const now = new Date();
  const first = await runFullSync(prisma, new MockCollector(), { now, triggeredBy: admin.id, actorLabel: admin.email });
  console.log("  import:", first.import.status, `${first.import.recordsImported} novos, ${first.import.recordsUpdated} atualizados`);
  if (first.import.errors.length) console.log("  erros:", first.import.errors);

  console.log("▶ Eleitores de demonstração e votos populares…");
  const voterHash = await hashPassword("Eleitor#Demo2026x");
  const voters = [];
  for (let i = 1; i <= 14; i++) {
    voters.push(
      await prisma.user.upsert({
        where: { email: `eleitor${i}@avaliador.demo` },
        update: {},
        create: { email: `eleitor${i}@avaliador.demo`, name: `Eleitor de demonstração ${i}`, passwordHash: voterHash },
      }),
    );
  }
  const rnd = mulberry32(20261005);
  const qByName = new Map(DEMO_PEOPLE.map((p) => [`mock:${p.key}`, p.q]));
  const pols = await prisma.politician.findMany({ select: { id: true, externalKey: true } });
  const facts = await prisma.fact.findMany({ select: { id: true, politicianId: true } });
  await prisma.popularVote.deleteMany({});
  await prisma.fact.updateMany({ data: { votesUp: 0, votesDown: 0 } });
  const counters = new Map<string, { up: number; down: number }>();
  const rows: { factId: string; userId: string; value: number }[] = [];
  for (const f of facts) {
    const q = qByName.get(pols.find((p) => p.id === f.politicianId)?.externalKey ?? "") ?? 0.5;
    for (const v of voters) {
      if (rnd() > 0.55) continue; // nem todos votam em tudo
      const value = rnd() < 0.3 + 0.55 * q ? 1 : -1;
      rows.push({ factId: f.id, userId: v.id, value });
      const c = counters.get(f.id) ?? { up: 0, down: 0 };
      if (value === 1) c.up++;
      else c.down++;
      counters.set(f.id, c);
    }
  }
  await prisma.popularVote.createMany({ data: rows });
  for (const [factId, c] of counters) {
    await prisma.fact.update({ where: { id: factId }, data: { votesUp: c.up, votesDown: c.down } });
  }
  console.log(`  ${rows.length} votos criados.`);

  console.log("▶ Recalculando notas e ranking…");
  const scores = await recalculateAll(prisma, { now, actor: { id: admin.id, label: admin.email }, reason: "Seed de demonstração" });
  console.log("  ", scores);

  await audit(prisma, { actorId: admin.id, actorLabel: admin.email, action: "SEED_COMPLETED", entity: "System", after: { politicians: scores.politicians } });
  console.log("\n✔ Pronto.\n  Admin:   admin@avaliador.demo / Admin#Demo2026\n  Usuário: usuario@avaliador.demo / Usuario#Demo2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
