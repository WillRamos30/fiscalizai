// Solicitação de correção de dados ("Encontrou um erro?") → tickets no painel administrativo.

import { z } from "zod";
import type { Db } from "@/lib/db";
import { notFound, tooMany } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { TICKET_STATUSES } from "@/lib/constants";
import { audit } from "@/modules/audit/audit";

export const correctionSchema = z.object({
  politicianSlug: z.string().max(120).optional(),
  factId: z.string().max(60).optional(),
  information: z.string().trim().min(3, "Informe qual informação está incorreta.").max(300),
  justification: z.string().trim().min(10, "Explique a justificativa (mín. 10 caracteres).").max(2000),
  sourceUrl: z.string().trim().url("Informe uma URL válida.").max(500).optional().or(z.literal("")),
  description: z.string().trim().min(10, "Descreva o erro (mín. 10 caracteres).").max(4000),
  contactEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
});

export async function createCorrectionTicket(
  db: Db,
  input: z.infer<typeof correctionSchema>,
  ctx: { ip: string; userId?: string | null },
) {
  const rl = rateLimit(`ticket:${ctx.ip}`, 5, 60 * 60_000);
  if (!rl.allowed) throw tooMany(rl.retryAfterSec);

  let politicianId: string | null = null;
  if (input.politicianSlug) {
    const p = await db.politician.findUnique({ where: { slug: input.politicianSlug }, select: { id: true } });
    if (!p) throw notFound("Político não encontrado.");
    politicianId = p.id;
  }
  if (input.factId) {
    const f = await db.fact.findUnique({ where: { id: input.factId }, select: { id: true, politicianId: true } });
    if (!f) throw notFound("Acontecimento não encontrado.");
    politicianId = politicianId ?? f.politicianId;
  }
  const ticket = await db.correctionTicket.create({
    data: {
      politicianId,
      factId: input.factId ?? null,
      information: input.information,
      justification: input.justification,
      sourceUrl: input.sourceUrl || null,
      description: input.description,
      contactEmail: input.contactEmail || null,
      userId: ctx.userId ?? null,
    },
  });
  await audit(db, { actorId: ctx.userId ?? null, actorLabel: ctx.userId ? undefined : "anônimo", action: "TICKET_CREATED", entity: "CorrectionTicket", entityId: ticket.id, ip: ctx.ip });
  return ticket;
}

export const ticketUpdateSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  resolution: z.string().trim().max(2000).optional(),
});

export async function updateTicket(db: Db, id: string, input: z.infer<typeof ticketUpdateSchema>, actor: { id: string; label: string }) {
  const before = await db.correctionTicket.findUnique({ where: { id } });
  if (!before) throw notFound("Ticket não encontrado.");
  const after = await db.correctionTicket.update({
    where: { id },
    data: { status: input.status, resolution: input.resolution ?? before.resolution, resolvedById: ["RESOLVIDO", "REJEITADO"].includes(input.status) ? actor.id : null },
  });
  await audit(db, {
    actorId: actor.id,
    actorLabel: actor.label,
    action: "TICKET_UPDATED",
    entity: "CorrectionTicket",
    entityId: id,
    before: { status: before.status, resolution: before.resolution },
    after: { status: after.status, resolution: after.resolution },
    reason: input.resolution ?? null,
  });
  return after;
}
