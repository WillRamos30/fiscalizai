import { handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { ticketUpdateSchema, updateTicket } from "@/modules/corrections/service";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const actor = await requireRole(prisma, req, ["ADMIN", "MODERATOR"]);
  const { id } = await params;
  const input = await readJson(req, ticketUpdateSchema);
  const t = await updateTicket(prisma, id, input, { id: actor.id, label: actor.email });
  return json({ id: t.id, status: t.status });
});
