import { handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { factStatusSchema, setFactStatus } from "@/modules/admin/service";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const actor = await requireRole(prisma, req, ["ADMIN", "MODERATOR"]);
  const { id } = await params;
  const input = await readJson(req, factStatusSchema);
  const f = await setFactStatus(prisma, id, input, { id: actor.id, label: actor.email });
  return json({ id: f.id, status: f.status });
});
