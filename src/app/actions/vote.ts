"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function submitVote(factId: string, value: 1 | -1): Promise<{ success: boolean; error?: string }> {
  try {
  // ATENÇÃO: Em produção, o userId viria do token/sessão autenticada (JWT).
  // Para demonstração desta fase, vamos pegar um usuário genérico.
  const user = await prisma.user.upsert({
    where: { email: "usuario@FiscalizaI.demo" },
    update: {},
    create: {
      name: "Usuario de Demonstracao",
      email: "usuario@FiscalizaI.demo",
      passwordHash: "dummy",
      role: "USER"
    }
  });

  const userId = user.id;

  // Busca se o usuário já votou neste fato
  const existingVote = await prisma.popularVote.findUnique({
    where: {
      factId_userId: { factId, userId }
    }
  });

  if (existingVote) {
    if (existingVote.value === value) {
      // Remover voto (clicar no mesmo)
      await prisma.$transaction([
        prisma.popularVote.delete({
          where: { id: existingVote.id }
        }),
        prisma.fact.update({
          where: { id: factId },
          data: {
            votesUp: value === 1 ? { decrement: 1 } : undefined,
            votesDown: value === -1 ? { decrement: 1 } : undefined,
          }
        })
      ]);
    } else {
      // Inverter voto
      await prisma.$transaction([
        prisma.popularVote.update({
          where: { id: existingVote.id },
          data: {
            value,
            changes: { increment: 1 }
          }
        }),
        prisma.fact.update({
          where: { id: factId },
          data: {
            votesUp: value === 1 ? { increment: 1 } : { decrement: 1 },
            votesDown: value === -1 ? { increment: 1 } : { decrement: 1 },
          }
        })
      ]);
    }
  } else {
    // Novo voto
    await prisma.$transaction([
      prisma.popularVote.create({
        data: {
          factId,
          userId,
          value,
        }
      }),
      prisma.fact.update({
        where: { id: factId },
        data: {
          votesUp: value === 1 ? { increment: 1 } : undefined,
          votesDown: value === -1 ? { increment: 1 } : undefined,
        }
      })
    ]);
  }

  revalidatePath("/feed");
  revalidatePath("/politico/[id]", "page");
  return { success: true };
  } catch (error: any) {
    console.error("Erro interno no submitVote:", error);
    return { success: false, error: error.message };
  }
}



