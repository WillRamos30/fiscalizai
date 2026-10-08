import { getClientIp, handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { authenticate } from "@/modules/auth/service";
import { correctionSchema, createCorrectionTicket } from "@/modules/corrections/service";

// Qualquer visitante pode solicitar correção (com rate limit). Se autenticado, o ticket é vinculado ao usuário.
export const POST = handle(async (req) => {
  const input = await readJson(req, correctionSchema);
  const user = await authenticate(prisma, req);
  const ticket = await createCorrectionTicket(prisma, input, { ip: getClientIp(req), userId: user?.id });
  return json({ id: ticket.id, status: ticket.status }, { status: 201 });
});
