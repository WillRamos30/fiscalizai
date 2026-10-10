import { handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signSession, sessionCookie } from "@/modules/auth/session";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido").toLowerCase(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const POST = handle(async (req) => {
  const { name, email, password } = await readJson(req, registerSchema);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("Este e-mail já está cadastrado.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "USER" },
  });

  const token = await signSession({ sub: user.id, role: user.role, tv: user.tokenVersion });
  
  return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, { cookies: [sessionCookie(token)] });
});
