import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCollector } from "@/modules/ingestion/collectors";
import { runFullSync } from "@/modules/ingestion/sync";

export const maxDuration = 60; // Permite rodar por até 60 segundos na Vercel

export async function GET(req: NextRequest) {
  // Verifica se a requisição está vindo realmente do Cron da Vercel
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const camara = getCollector("camara");
    const senado = getCollector("senado");
    
    const results = [];

    // Tenta rodar a Câmara primeiro
    if (camara) {
      const result = await runFullSync(prisma, camara, { triggeredBy: "system" });
      results.push({ id: "camara", status: result.import.status });
    }

    // Tenta rodar o Senado em seguida (sempre bom colocar os 2 no cron)
    if (senado) {
      const result = await runFullSync(prisma, senado, { triggeredBy: "system" });
      results.push({ id: "senado", status: result.import.status });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
