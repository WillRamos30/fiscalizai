// Avaliação popular (👍/👎) com proteção contra abuso:
//  • apenas usuários autenticados; 1 voto por usuário por fato (índice único);
//  • alteração de voto limitada; limite diário; detecção de rajada; rate limit por IP;
//  • CAPTCHA (Cloudflare Turnstile) exigido quando há comportamento atípico E o segredo está configurado;
//  • IP guardado apenas como hash (LGPD); eventos suspeitos vão para o AuditLog.
// A avaliação popular NUNCA altera indicadores técnicos: só alimenta o pilar POP (peso máx. 5%).

import { z } from "zod";
import type { Db } from "@/lib/db";
import { VOTE_LIMITS } from "@/lib/constants";
import { HttpError, notFound, tooMany } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/utils";
import { audit } from "@/modules/audit/audit";

export const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
  captchaToken: z.string().max(4096).optional(),
});

export type VoteSummary = {
  factId: string;
  votesUp: number;
  votesDown: number;
  positivePct: number | null; // null quando não há votos
  myVote: 1 | -1 | null;
};

export function summarize(factId: string, up: number, down: number, myVote: 1 | -1 | null): VoteSummary {
  const total = up + down;
  return { factId, votesUp: up, votesDown: down, positivePct: total > 0 ? Math.round((up / total) * 100) : null, myVote };
}

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // CAPTCHA desativado
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function castVote(
  db: Db,
  args: { factId: string; userId: string; value: 1 | -1; ip: string; captchaToken?: string },
): Promise<VoteSummary> {
  const { factId, userId, value, ip } = args;

  const fact = await db.fact.findUnique({ where: { id: factId }, select: { id: true, status: true } });
  if (!fact || fact.status !== "PUBLICADO") throw notFound("Acontecimento não encontrado.");

  // Rate limiting por IP e por usuário (rajada).
  const rlIp = rateLimit(`vote-ip:${ip}`, VOTE_LIMITS.burstMaxVotes * 3, VOTE_LIMITS.burstWindowMs);
  const rlUser = rateLimit(`vote-user:${userId}`, VOTE_LIMITS.burstMaxVotes, VOTE_LIMITS.burstWindowMs);
  if (!rlIp.allowed || !rlUser.allowed) {
    await audit(db, {
      actorId: userId,
      action: "SUSPICIOUS_VOTING_BURST",
      entity: "PopularVote",
      entityId: factId,
      after: { reason: "rate limit" },
      ip,
    });
    throw tooMany(Math.max(rlIp.retryAfterSec, rlUser.retryAfterSec), "Você está votando rápido demais. Aguarde um instante.");
  }

  // Limite diário.
  const since = new Date(Date.now() - 24 * 3_600_000);
  const last24h = await db.popularVote.count({ where: { userId, updatedAt: { gte: since } } });
  if (last24h >= VOTE_LIMITS.maxVotesPerDay) {
    throw tooMany(3600, "Limite diário de votos atingido.");
  }

  // CAPTCHA quando há atividade atípica (muitos votos em 10 min) e o segredo está configurado.
  const last10m = await db.popularVote.count({ where: { userId, updatedAt: { gte: new Date(Date.now() - 600_000) } } });
  if (process.env.TURNSTILE_SECRET && last10m >= 8) {
    const ok = await verifyTurnstile(args.captchaToken, ip);
    if (!ok) throw new HttpError(428, "Verificação anti-robô necessária.", "CAPTCHA_REQUIRED");
  }

  return db.$transaction(async (tx) => {
    const existing = await tx.popularVote.findUnique({ where: { factId_userId: { factId, userId } } });

    if (!existing) {
      await tx.popularVote.create({ data: { factId, userId, value, ipHash: hashIp(ip) } });
      const f = await tx.fact.update({
        where: { id: factId },
        data: value === 1 ? { votesUp: { increment: 1 } } : { votesDown: { increment: 1 } },
        select: { votesUp: true, votesDown: true },
      });
      return summarize(factId, f.votesUp, f.votesDown, value);
    }

    if (existing.value === value) {
      const f = await tx.fact.findUniqueOrThrow({ where: { id: factId }, select: { votesUp: true, votesDown: true } });
      return summarize(factId, f.votesUp, f.votesDown, value); // idempotente
    }

    if (existing.changes >= VOTE_LIMITS.maxChangesPerVote) {
      throw new HttpError(409, "Limite de alterações deste voto atingido.", "VOTE_CHANGE_LIMIT");
    }
    await tx.popularVote.update({
      where: { id: existing.id },
      data: { value, changes: { increment: 1 }, ipHash: hashIp(ip) },
    });
    const f = await tx.fact.update({
      where: { id: factId },
      data: value === 1 ? { votesUp: { increment: 1 }, votesDown: { decrement: 1 } } : { votesUp: { decrement: 1 }, votesDown: { increment: 1 } },
      select: { votesUp: true, votesDown: true },
    });
    return summarize(factId, f.votesUp, f.votesDown, value);
  });
}

export async function getMyVotes(db: Db, userId: string, factIds: string[]): Promise<Record<string, 1 | -1>> {
  if (factIds.length === 0) return {};
  const rows = await db.popularVote.findMany({ where: { userId, factId: { in: factIds } }, select: { factId: true, value: true } });
  return Object.fromEntries(rows.map((r) => [r.factId, r.value as 1 | -1]));
}
