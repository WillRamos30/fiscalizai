import { z } from "zod";
import { handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { enqueueJob } from "@/modules/jobs/runner";
import { activateAlgorithmVersion } from "@/modules/scoring/algorithm";
import { recalculateAll } from "@/modules/scoring/run";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ reason: z.string().trim().min(5).max(1000) });

export const POST = handle<Ctx>(async (req, { params }) => {
  const admin = await requireRole(prisma, req, ["ADMIN"]);
  const { id } = await params;
  const { reason } = await readJson(req, schema, 2_000);
  const v = await activateAlgorithmVersion(prisma, id, { id: admin.id, label: admin.email }, reason);
  const job = enqueueJob("scores:recalculate", () => recalculateAll(prisma, { actor: { id: admin.id, label: admin.email }, reason: `Ativação ${v.version}: ${reason}` }));
  return json({ version: v.version, status: v.status, job }, { status: 202 });
});
