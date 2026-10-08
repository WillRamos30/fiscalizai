// Sincronização completa: importar → gerar fatos → recalcular notas/ranking.
// É o "job" que roda no worker/cron em produção (ver scripts/ e módulo de jobs).

import type { Db } from "@/lib/db";
import { invalidate } from "@/lib/cache";
import { generateFacts } from "@/modules/facts/generate";
import { recalculateAll, type RunSummary } from "@/modules/scoring/run";
import { runImport, type ImportSummary } from "./pipeline";
import type { Collector } from "./types";

export type SyncSummary = { import: ImportSummary; facts: { created: number; updated: number } | null; scores: RunSummary | null };

export async function runFullSync(
  db: Db,
  collector: Collector,
  opts: { now?: Date; triggeredBy?: string; actorLabel?: string } = {},
): Promise<SyncSummary> {
  const now = opts.now ?? new Date();
  const imp = await runImport(db, collector, { now, triggeredBy: opts.triggeredBy, actorLabel: opts.actorLabel });
  if (imp.status === "FAILED") return { import: imp, facts: null, scores: null };
  const facts = await generateFacts(db, { now });
  const scores = await recalculateAll(db, {
    now,
    actor: opts.triggeredBy && opts.triggeredBy !== "system" ? { id: opts.triggeredBy, label: opts.actorLabel ?? null } : undefined,
    reason: `Sincronização (${collector.id})`,
  });
  invalidate();
  return { import: imp, facts, scores };
}
