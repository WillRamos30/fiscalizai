import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { enqueueJob } from "@/modules/jobs/runner";
import { recalculateAll } from "@/modules/scoring/run";

// Recalcula notas/ranking com o algoritmo ATIVO (cria novas linhas; o histórico é preservado).
export const POST = handle(async (req) => {
  const admin = await requireRole(prisma, req, ["ADMIN"]);
  const job = enqueueJob("scores:recalculate", () =>
    recalculateAll(prisma, { actor: { id: admin.id, label: admin.email }, reason: "Recálculo solicitado no painel" }),
  );
  return json({ job }, { status: 202 });
});
