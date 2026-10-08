import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { recalculateAll } from "@/modules/scoring/run";
import { generateFacts } from "@/modules/facts/generate";

export const maxDuration = 60;

export const POST = handle(async (req) => {
  const admin = await requireRole(prisma, req, ["ADMIN"]);
  
  await generateFacts(prisma, { now: new Date() });
  const result = await recalculateAll(prisma, { actor: { id: admin.id, label: admin.email }, reason: "Recálculo solicitado no painel" });
  
  return json({ success: true, result }, { status: 200 });
});

