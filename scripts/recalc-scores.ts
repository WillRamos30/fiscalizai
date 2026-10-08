// Uso: npm run score:recalc → recalcula notas e ranking com o algoritmo ATIVO (cria novas linhas; histórico preservado).
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { recalculateAll } from "../src/modules/scoring/run";

recalculateAll(prisma, { reason: "Recálculo manual (CLI)" })
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
