import { getClientIp, handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireUser } from "@/modules/auth/service";
import { castVote, voteSchema } from "@/modules/votes/service";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/facts/:id/vote  { "value": 1 | -1 }  — exige usuário autenticado.
export const POST = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser(prisma, req);
  const input = await readJson(req, voteSchema, 2_000);
  const summary = await castVote(prisma, { factId: id, userId: user.id, value: input.value, ip: getClientIp(req), captchaToken: input.captchaToken });
  return json(summary);
});
