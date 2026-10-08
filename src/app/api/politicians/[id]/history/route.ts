import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { findPoliticianRef } from "@/modules/politicians/lookup";

type Ctx = { params: Promise<{ id: string }> };

// Histórico de notas (janelas de 12 meses) + versões anteriores do cálculo (notas nunca são sobrescritas).
export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const ref = await findPoliticianRef(prisma, id);
  const rows = await prisma.score.findMany({
    where: { politicianId: ref.id, kind: "ROLLING12", isCurrent: true },
    orderBy: { periodEnd: "asc" },
    select: { label: true, periodStart: true, periodEnd: true, total: true, technical: true, status: true, confidence: true, algorithm: { select: { version: true } } },
  });
  const valid = rows.filter((r) => r.total != null);
  const delta12m = valid.length >= 2 ? Math.round(((valid[valid.length - 1].total as number) - (valid[valid.length - 2].total as number)) * 10) / 10 : null;
  const runs = await prisma.score.findMany({
    where: { politicianId: ref.id, kind: "CUMULATIVE" },
    orderBy: { computedAt: "desc" },
    take: 20,
    select: { runId: true, total: true, status: true, isCurrent: true, computedAt: true, algorithm: { select: { version: true } } },
  });
  return json(
    {
      politicianId: ref.id,
      windows: rows.map((r) => ({ label: r.label, periodStart: r.periodStart, periodEnd: r.periodEnd, total: r.total, technical: r.technical, status: r.status, confidence: r.confidence, algorithmVersion: r.algorithm.version })),
      delta12m,
      calculations: runs.map((r) => ({ runId: r.runId, total: r.total, status: r.status, isCurrent: r.isCurrent, computedAt: r.computedAt, algorithmVersion: r.algorithm.version })),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
});
