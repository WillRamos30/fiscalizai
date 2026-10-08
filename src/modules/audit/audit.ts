import { sha256, hashIp } from "@/lib/utils";
import type { Db } from "@/lib/db";

// Auditoria append-only com encadeamento de hash: qualquer alteração/remoção de um registro
// quebra a cadeia e é detectada por verifyAuditChain(). Nenhuma alteração é silenciosa.

type AuditClient = Pick<Db, "auditLog">;

export type AuditEvent = {
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
};

function toJson(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  try {
    return JSON.stringify(v);
  } catch {
    return JSON.stringify(String(v));
  }
}

function computeHash(prevHash: string | null, e: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: string | null;
  after: string | null;
  reason: string | null;
  createdAt: Date;
}): string {
  return sha256(
    [prevHash ?? "GENESIS", e.actorId ?? "", e.action, e.entity, e.entityId ?? "", e.before ?? "", e.after ?? "", e.reason ?? "", e.createdAt.toISOString()].join("|"),
  );
}

export async function audit(db: AuditClient, e: AuditEvent) {
  const last = await db.auditLog.findFirst({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { hash: true } });
  const createdAt = new Date();
  const data = {
    actorId: e.actorId ?? null,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId ?? null,
    before: toJson(e.before),
    after: toJson(e.after),
    reason: e.reason ?? null,
    createdAt,
  };
  const hash = computeHash(last?.hash ?? null, data);
  return db.auditLog.create({
    data: { ...data, actorLabel: e.actorLabel ?? null, ipHash: hashIp(e.ip), prevHash: last?.hash ?? null, hash },
  });
}

export async function verifyAuditChain(db: AuditClient): Promise<{ ok: boolean; checked: number; brokenAt?: string }> {
  const rows = await db.auditLog.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  let prev: string | null = null;
  for (const r of rows) {
    const expected = computeHash(prev, {
      actorId: r.actorId,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      reason: r.reason,
      createdAt: r.createdAt,
    });
    if (r.prevHash !== prev || r.hash !== expected) return { ok: false, checked: rows.length, brokenAt: r.id };
    prev = r.hash;
  }
  return { ok: true, checked: rows.length };
}
