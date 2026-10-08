// Serviço de versões do algoritmo. Versões são IMUTÁVEIS: mudar a metodologia = criar nova versão
// (com responsável, motivo e registro de auditoria). O histórico nunca é apagado.

import type { Db } from "@/lib/db";
import { audit } from "@/modules/audit/audit";
import { ALGORITHM_VERSION, defaultConfig, validateConfig, type ConfigIssue } from "./config";
import type { AlgorithmConfig } from "./types";
import { safeJson } from "@/lib/utils";

export type ActiveAlgorithm = { id: string; version: string; config: AlgorithmConfig };

export type Actor = { id: string | null; label: string | null };

export class AlgorithmValidationError extends Error {
  constructor(public issues: ConfigIssue[]) {
    super(issues.filter((i) => i.level === "error").map((i) => i.message).join(" | "));
    this.name = "AlgorithmValidationError";
  }
}

/** Garante que exista ao menos a v1.0 (criada pelo sistema). */
export async function ensureDefaultAlgorithm(db: Db): Promise<void> {
  const exists = await db.algorithmVersion.findUnique({ where: { version: ALGORITHM_VERSION } });
  if (exists) return;
  const cfg = defaultConfig();
  const created = await db.algorithmVersion.create({
    data: {
      version: ALGORITHM_VERSION,
      status: "ACTIVE",
      config: JSON.stringify(cfg),
      changeLog: "Versão inicial da metodologia (7 pilares, 28 indicadores).",
      reason: "Criação da metodologia base.",
      createdByName: "sistema",
      activatedAt: new Date(),
    },
  });
  await audit(db, {
    actorLabel: "sistema",
    action: "ALGORITHM_VERSION_CREATED",
    entity: "AlgorithmVersion",
    entityId: created.id,
    after: { version: created.version, status: created.status },
    reason: "Criação da metodologia base.",
  });
}

export async function getActiveAlgorithm(db: Db): Promise<ActiveAlgorithm> {
  await ensureDefaultAlgorithm(db);
  const row = await db.algorithmVersion.findFirst({ where: { status: "ACTIVE" }, orderBy: { activatedAt: "desc" } });
  if (!row) throw new Error("Nenhuma versão ativa do algoritmo.");
  return { id: row.id, version: row.version, config: safeJson<AlgorithmConfig>(row.config, defaultConfig()) };
}

export async function listAlgorithmVersions(db: Db) {
  return db.algorithmVersion.findMany({ orderBy: { createdAt: "desc" } });
}

/** Próximo número de versão: v1.0 → v1.1 (mudança de pesos/parâmetros); `major` → v2.0. */
export async function nextVersionName(db: Db, major = false): Promise<string> {
  const rows = await db.algorithmVersion.findMany({ select: { version: true } });
  let maxMajor = 1;
  let maxMinor = 0;
  for (const r of rows) {
    const m = /^v(\d+)\.(\d+)$/.exec(r.version);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > maxMajor || (a === maxMajor && b > maxMinor)) {
      maxMajor = a;
      maxMinor = b;
    }
  }
  return major ? `v${maxMajor + 1}.0` : `v${maxMajor}.${maxMinor + 1}`;
}

export type CreateVersionInput = {
  config: AlgorithmConfig;
  changeLog: string;
  reason: string;
  actor: Actor;
  major?: boolean;
  activate?: boolean;
};

export async function createAlgorithmVersion(db: Db, input: CreateVersionInput) {
  if (!input.reason.trim() || !input.changeLog.trim()) {
    throw new Error("Informe o motivo e a descrição da alteração do algoritmo.");
  }
  const version = await nextVersionName(db, input.major);
  const config: AlgorithmConfig = { ...input.config, version };
  config.indicators = config.indicators.map((i) => ({ ...i, version: i.version ?? version }));
  const issues = validateConfig(config);
  if (issues.some((i) => i.level === "error")) throw new AlgorithmValidationError(issues);

  const created = await db.algorithmVersion.create({
    data: {
      version,
      status: "DRAFT",
      config: JSON.stringify(config),
      changeLog: input.changeLog.trim(),
      reason: input.reason.trim(),
      createdById: input.actor.id,
      createdByName: input.actor.label,
    },
  });
  await audit(db, {
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    action: "ALGORITHM_VERSION_CREATED",
    entity: "AlgorithmVersion",
    entityId: created.id,
    after: { version, changeLog: input.changeLog },
    reason: input.reason,
  });
  if (input.activate) await activateAlgorithmVersion(db, created.id, input.actor, input.reason);
  return created;
}

export async function activateAlgorithmVersion(db: Db, id: string, actor: Actor, reason: string) {
  const target = await db.algorithmVersion.findUnique({ where: { id } });
  if (!target) throw new Error("Versão do algoritmo não encontrada.");
  if (target.status === "ACTIVE") return target;
  const current = await db.algorithmVersion.findFirst({ where: { status: "ACTIVE" } });
  if (current) await db.algorithmVersion.update({ where: { id: current.id }, data: { status: "ARCHIVED" } });
  const activated = await db.algorithmVersion.update({ where: { id }, data: { status: "ACTIVE", activatedAt: new Date() } });
  await audit(db, {
    actorId: actor.id,
    actorLabel: actor.label,
    action: "ALGORITHM_VERSION_ACTIVATED",
    entity: "AlgorithmVersion",
    entityId: id,
    before: current ? { version: current.version } : null,
    after: { version: activated.version },
    reason,
  });
  return activated;
}
