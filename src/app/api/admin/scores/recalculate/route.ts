import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { recalculateAll } from "@/modules/scoring/run";
import { generateFacts } from "@/modules/facts/generate";
import { after } from "next/server";

export const maxDuration = 60;

export const POST = handle(async (req) => {
  const admin = await requireRole(prisma, req, ["ADMIN"]);
  
  // Ocultamos a carga pesada em background para a Vercel não dar Timeout (504) na borda de 10s
  after(async () => {
    try {
      console.log("Iniciando geração de fatos em background...");
      await generateFacts(prisma, { now: new Date() });
      console.log("Iniciando recalculo de notas em background...");
      await recalculateAll(prisma, { actor: { id: admin.id, label: admin.email }, reason: "Recálculo solicitado no painel" });
      console.log("Recalculo em background finalizado com sucesso!");
    } catch (err) {
      console.error("Erro fatal durante recalculo em background:", err);
    }
  });
  
  // Responde imediatamente para a UI em < 1 segundo
  return json({ success: true, message: "Recálculo iniciado em background" }, { status: 200 });
});
