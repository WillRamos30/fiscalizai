import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/modules/auth/password";
import { ensureReferenceData } from "@/modules/ingestion/reference";
import { ensureDefaultAlgorithm } from "@/modules/scoring/algorithm";

export async function GET() {
  try {
    console.log("Configurando banco de produção via API...");
    
    await ensureReferenceData(prisma, { demoSources: false });
    await ensureDefaultAlgorithm(prisma);

    const email = "admin@fiscalizai.com.br";
    const passwordHash = await hashPassword("Admin#FiscalizaI2026");

    await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN", name: "Administrador FiscalizaI" },
      create: { email, name: "Administrador FiscalizaI", passwordHash, role: "ADMIN" },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Banco de produção inicializado com sucesso! Conta Admin criada." 
    });
  } catch (error: any) {
    console.error("Erro no setup:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
