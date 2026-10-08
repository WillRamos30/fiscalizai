import { handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { politicianPatchSchema, updatePolitician } from "@/modules/admin/service";

type Ctx = { params: Promise<{ id: string }> };

// Edita dados cadastrais. Campos de nota/ranking são REJEITADOS (schema estrito): ninguém altera a nota manualmente.
export const PATCH = handle<Ctx>(async (req, { params }) => {
  const admin = await requireRole(prisma, req, ["ADMIN"]);
  const { id } = await params;
  const input = await readJson(req, politicianPatchSchema);
  const p = await updatePolitician(prisma, id, input, { id: admin.id, label: admin.email });
  return json({ id: p.id, slug: p.slug, politicalName: p.politicalName, status: p.status });
});
