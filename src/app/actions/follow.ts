"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/modules/auth/session";

export async function toggleFollow(politicianId: string): Promise<{ success: boolean; isFollowing?: boolean; error?: string }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    const session = await verifySession(token);

    if (!session) {
      return { success: false, error: "Você precisa estar logado para acompanhar um político." };
    }

    const userId = session.sub;

    const existingFollow = await prisma.favorite.findUnique({
      where: {
        userId_politicianId: { userId, politicianId }
      }
    });

    if (existingFollow) {
      // Deixar de seguir
      await prisma.favorite.delete({
        where: { id: existingFollow.id }
      });
      revalidatePath(`/politico/${politicianId}`);
      revalidatePath("/perfil");
      return { success: true, isFollowing: false };
    } else {
      // Seguir
      await prisma.favorite.create({
        data: {
          userId,
          politicianId,
        }
      });
      revalidatePath(`/politico/${politicianId}`);
      revalidatePath("/perfil");
      return { success: true, isFollowing: true };
    }
  } catch (error: any) {
    console.error("Erro interno no toggleFollow:", error);
    return { success: false, error: error.message };
  }
}
