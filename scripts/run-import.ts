// Script de sincronização / importação de dados.
//
// Uso:
//   npm run import:real           → importa dados reais da Câmara e do Senado, removendo dados demo
//   npm run import:camara         → importa dados reais da Câmara dos Deputados
//   npm run import:senado         → importa dados reais do Senado Federal
//   npm run import:mock           → importa dados fictícios (apenas demonstração)
//
// Opções:
//   --limit=25                    → define o número de parlamentares a importar
//   --keep-demo                   → mantém os dados de demonstração no banco

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getCollector } from "../src/modules/ingestion/collectors";
import { runFullSync } from "../src/modules/ingestion/sync";

async function cleanDemoData() {
  const demoPoliticians = await prisma.politician.findMany({
    where: { isDemo: true },
    select: { id: true },
  });

  if (demoPoliticians.length === 0) return;

  const ids = demoPoliticians.map((p) => p.id);
  console.log(`🧹 Removendo ${ids.length} políticos fictícios de demonstração para deixar apenas dados reais...`);

  await prisma.$transaction([
    prisma.popularVote.deleteMany({ where: { fact: { politicianId: { in: ids } } } }),
    prisma.scoreComponent.deleteMany({ where: { score: { politicianId: { in: ids } } } }),
    prisma.score.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.fact.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.mandate.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.project.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.committee.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.attendance.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.expense.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.amendment.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.asset.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.election.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.legalCase.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.dataCoverage.deleteMany({ where: { politicianId: { in: ids } } }),
    prisma.politician.deleteMany({ where: { id: { in: ids } } }),
    prisma.party.deleteMany({ where: { isDemo: true } }),
  ]);

  console.log("✔ Dados fictícios removidos.");
}

async function runCollector(id: string) {
  const collector = getCollector(id);
  if (!collector) throw new Error(`Coletor desconhecido: ${id}`);
  console.log(`\n======================================================`);
  console.log(`▶ Iniciando sincronização: ${collector.label} (${id})`);
  console.log(`======================================================`);
  const r = await runFullSync(prisma, collector);
  console.log("Resultado da importação:", {
    collector: r.import.collector,
    status: r.import.status,
    recordsRead: r.import.recordsRead,
    recordsImported: r.import.recordsImported,
    recordsUpdated: r.import.recordsUpdated,
    recordsFailed: r.import.recordsFailed,
    durationMs: r.import.durationMs,
    errors: r.import.errors,
  });
  if (r.scores) {
    console.log("Recálculo de notas concluído:", {
      algorithm: r.scores.algorithmVersion,
      politicians: r.scores.politicians,
      scored: r.scores.scored,
      insufficient: r.scores.insufficient,
    });
  }
  if (r.import.status === "FAILED") {
    process.exitCode = 1;
  }
  return r;
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0] ?? "real";

  const limitArg = args.find((a) => a.startsWith("--limit="));
  if (limitArg) {
    const val = limitArg.split("=")[1];
    process.env.CAMARA_LIMIT = val;
    process.env.SENADO_LIMIT = val;
  }

  const keepDemo = args.includes("--keep-demo");

  // Se estiver importando dados reais, remove os dados fictícios para evitar mistura
  if (target !== "mock" && !keepDemo) {
    await cleanDemoData();
  }

  if (target === "real" || target === "all") {
    console.log("Iniciando importação de fontes oficiais públicas (Câmara dos Deputados e Senado Federal)...");
    await runCollector("camara");
    await runCollector("senado");
  } else {
    await runCollector(target);
  }

  console.log("\n✔ Processamento finalizado.");
}

main()
  .catch((e) => {
    console.error("Erro fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
