// Sessão para Server Components/Server Actions (usa next/headers). Mantido separado de service.ts
// para que os testes e as rotas de API não dependam do contexto de requisição do Next.

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/constants";
import { SESSION_COOKIE, verifySession } from "./session";
import type { AuthUser } from "./service";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== "ACTIVE" || user.tokenVersion !== payload.tv) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role as Role, status: user.status };
}
