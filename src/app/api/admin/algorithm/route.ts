import { handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { enqueueJob } from "@/modules/jobs/runner";
import { createAlgorithmVersion, getActiveAlgorithm, listAlgorithmVersions } from "@/modules/scoring/algorithm";
import { algorithmPatchSchema, patchConfig } from "@/modules/scoring/config-patch";
import { recalculateAll } from "@/modules/scoring/run";

export const GET = handle(async (req) => {
  await requireRole(prisma, req, ["ADMIN", "MODERATOR"]);
  const versions = await listAlgorithmVersions(prisma);
  return json({
    versions: versions.map((v) => ({ id: v.id, version: v.version, status: v.status, changeLog: v.changeLog, reason: v.reason, createdByName: v.createdByName, createdAt: v.createdAt, activatedAt: v.activatedAt })),
  });
});

// Cria NOVA versão (as existentes são imutáveis). Se activate=true, ativa e enfileira o recálculo.
export const POST = handle(async (req) => {
  const admin = await requireRole(prisma, req, ["ADMIN"]);
  const patch = await readJson(req, algorithmPatchSchema);
  const active = await getActiveAlgorithm(prisma);
  const config = patchConfig(active.config, patch);
  const created = await createAlgorithmVersion(prisma, {
    config,
    changeLog: patch.changeLog,
    reason: patch.reason,
    actor: { id: admin.id, label: admin.email },
    major: patch.major,
    activate: patch.activate,
  });
  const job = patch.activate
    ? enqueueJob("scores:recalculate", () => recalculateAll(prisma, { actor: { id: admin.id, label: admin.email }, reason: `Nova versão ${created.version}: ${patch.reason}` }))
    : null;
  return json({ id: created.id, version: created.version, status: patch.activate ? "ACTIVE" : "DRAFT", job }, { status: 201 });
});
