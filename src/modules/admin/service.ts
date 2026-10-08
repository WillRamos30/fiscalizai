// Operações administrativas. Princípio de NÃO MANIPULAÇÃO: nenhuma função aqui altera notas.
// Notas só mudam por (dados coletados) + (versão do algoritmo) via recálculo registrado.
// Toda alteração grava AuditLog com antes/depois e motivo.

import { z } from "zod";
import type { Db } from "@/lib/db";
import { notFound } from "@/lib/http";
import { normalizeText } from "@/lib/utils";
import { audit } from "@/modules/audit/audit";
import { invalidate } from "@/lib/cache";

export type AdminActor = { id: string; label: string };

export const politicianPatchSchema = z
  .object({
    politicalName: z.string().trim().min(2).max(120).optional(),
    fullName: z.string().trim().min(3).max(200).optional(),
    status: z.enum(["EM_EXERCICIO", "LICENCIADO", "AFASTADO", "SUPLENTE", "ENCERRADO"]).optional(),
    bio: z.string().trim().max(1000).nullable().optional(),
    photoUrl: z.string().trim().url().max(500).nullable().optional(),
    reason: z.string().trim().min(5, "Informe o motivo da alteração.").max(1000),
  })
  .strict(); // campos de nota/ranking são rejeitados

export async function updatePolitician(db: Db, id: string, input: z.infer<typeof politicianPatchSchema>, actor: AdminActor) {
  const before = await db.politician.findUnique({ where: { id }, include: { office: true, party: true, state: true } });
  if (!before) throw notFound("Político não encontrado.");
  const { reason, ...patch } = input;
  const nextPolitical = patch.politicalName ?? before.politicalName;
  const nextFull = patch.fullName ?? before.fullName;
  const after = await db.politician.update({
    where: { id },
    data: {
      ...patch,
      searchText: normalizeText([nextFull, nextPolitical, before.party?.acronym, before.party?.name, before.office.name, before.stateUf, before.state?.name].filter(Boolean).join(" ")),
    },
  });
  await audit(db, {
    actorId: actor.id,
    actorLabel: actor.label,
    action: "POLITICIAN_UPDATED",
    entity: "Politician",
    entityId: id,
    before: { politicalName: before.politicalName, fullName: before.fullName, status: before.status, bio: before.bio, photoUrl: before.photoUrl },
    after: { politicalName: after.politicalName, fullName: after.fullName, status: after.status, bio: after.bio, photoUrl: after.photoUrl },
    reason,
  });
  invalidate();
  return after;
}

export const factStatusSchema = z.object({
  status: z.enum(["PUBLICADO", "OCULTO", "RASCUNHO"]),
  reason: z.string().trim().min(5).max(1000),
});

export async function setFactStatus(db: Db, id: string, input: z.infer<typeof factStatusSchema>, actor: AdminActor) {
  const before = await db.fact.findUnique({ where: { id }, select: { id: true, status: true, title: true } });
  if (!before) throw notFound("Acontecimento não encontrado.");
  const after = await db.fact.update({ where: { id }, data: { status: input.status } });
  await audit(db, {
    actorId: actor.id,
    actorLabel: actor.label,
    action: "FACT_STATUS_CHANGED",
    entity: "Fact",
    entityId: id,
    before: { status: before.status },
    after: { status: after.status },
    reason: input.reason,
  });
  invalidate();
  return after;
}

export async function getDashboardStats(db: Db) {
  const [politicians, demoPoliticians, facts, votes, users, sources, activeSources, lastImport, failedImports, openTickets, activeAlgo, scored, insufficient, lastRun, auditCount, recentErrors] =
    await Promise.all([
      db.politician.count(),
      db.politician.count({ where: { isDemo: true } }),
      db.fact.count({ where: { status: "PUBLICADO" } }),
      db.popularVote.count(),
      db.user.count(),
      db.source.count(),
      db.source.count({ where: { connection: { in: ["ATIVA", "DEMO"] } } }),
      db.dataImport.findFirst({ orderBy: { startedAt: "desc" } }),
      db.dataImport.count({ where: { status: { in: ["FAILED", "PARTIAL"] } } }),
      db.correctionTicket.count({ where: { status: { in: ["ABERTO", "EM_ANALISE"] } } }),
      db.algorithmVersion.findFirst({ where: { status: "ACTIVE" } }),
      db.score.count({ where: { kind: "CUMULATIVE", isCurrent: true, status: "OK" } }),
      db.score.count({ where: { kind: "CUMULATIVE", isCurrent: true, status: "INSUFFICIENT" } }),
      db.score.findFirst({ where: { kind: "CUMULATIVE", isCurrent: true }, orderBy: { computedAt: "desc" }, select: { computedAt: true } }),
      db.auditLog.count(),
      db.auditLog.count({ where: { action: { startsWith: "SUSPICIOUS" }, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    ]);
  const alerts: { level: "warn" | "info" | "bad"; message: string }[] = [];
  if (demoPoliticians > 0) alerts.push({ level: "info", message: `${demoPoliticians} políticos são DADOS DE DEMONSTRAÇÃO. Conecte as fontes oficiais antes de publicar.` });
  if (failedImports > 0) alerts.push({ level: "warn", message: `${failedImports} importação(ões) com falha/parcial. Veja a aba Dados.` });
  if (openTickets > 0) alerts.push({ level: "warn", message: `${openTickets} solicitação(ões) de correção aguardando análise.` });
  if (insufficient > 0) alerts.push({ level: "info", message: `${insufficient} político(s) sem dados suficientes para nota.` });
  if (recentErrors > 0) alerts.push({ level: "bad", message: `${recentErrors} evento(s) de votação suspeita nos últimos 7 dias.` });
  return {
    politicians,
    demoPoliticians,
    facts,
    votes,
    users,
    sources,
    activeSources,
    lastImport,
    failedImports,
    openTickets,
    algorithm: activeAlgo ? { version: activeAlgo.version, activatedAt: activeAlgo.activatedAt } : null,
    scored,
    insufficient,
    lastScoreRun: lastRun?.computedAt ?? null,
    auditCount,
    alerts,
  };
}
