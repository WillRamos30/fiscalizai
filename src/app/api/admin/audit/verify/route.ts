import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { verifyAuditChain } from "@/modules/audit/audit";

// Verifica a integridade da cadeia de hash da auditoria (detecta adulteração/remoção).
export const GET = handle(async (req) => {
  await requireRole(prisma, req, ["ADMIN"]);
  return json(await verifyAuditChain(prisma));
});
