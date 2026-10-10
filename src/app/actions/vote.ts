import "server-only";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/modules/auth/session";

export async function submitVote(factId: string, value: 1 | -1): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    const session = await verifySession(token);

    if (!session) {
      return { success: false, error: "Voc� precisa estar logado para votar." };
    }

    const userId = session.sub;

    // Busca se o usu�rio j� votou neste fato
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
