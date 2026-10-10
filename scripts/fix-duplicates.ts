import "dotenv/config";
import { prisma } from "../src/lib/db";

async function fixDuplicates() {
  console.log("Procurando duplicatas...");
  const duplicates = await prisma.$queryRaw`
    SELECT "politicianId", "kind", "label", COUNT(*) as cnt
    FROM "Score"
    WHERE "isCurrent" = true
    GROUP BY "politicianId", "kind", "label"
    HAVING COUNT(*) > 1
  `;
  console.log("Encontrados duplicatas:", duplicates);
  
  // Para cada politico com duplicata, manter apenas o scoreId mais recente
  const currentScores = await prisma.score.findMany({
    where: { isCurrent: true },
    orderBy: { createdAt: "desc" }
  });

  const seen = new Set();
  const toUpdate = [];
  for (const s of currentScores) {
    const key = s.politicianId + "_" + s.kind + "_" + s.label;
    if (seen.has(key)) {
      toUpdate.push(s.id);
    } else {
      seen.add(key);
    }
  }

  if (toUpdate.length > 0) {
    console.log(`Marcando ${toUpdate.length} scores antigos como isCurrent = false...`);
    await prisma.score.updateMany({
      where: { id: { in: toUpdate } },
      data: { isCurrent: false }
    });
    console.log("Corrigido!");
  } else {
    console.log("Nenhuma duplicata para corrigir.");
  }
}
fixDuplicates().catch(console.error).finally(() => prisma.$disconnect());
