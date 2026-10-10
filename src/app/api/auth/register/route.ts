import { handle, json, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signSession, sessionCookie } from "@/modules/auth/session";
import { isValidCPF } from "@/lib/cpf";
import type { Role } from "@/lib/constants";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail invÃ¡lido").toLowerCase(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  cpf: z.string().min(11, "CPF inválido"),
});

export const POST = handle(async (req) => {
  const { name, email, password, cpf } = await readJson(req, registerSchema);

  const cleanCPF = cpf.replace(/[^\d]+/g, "");
  if (!isValidCPF(cleanCPF)) {
    throw new Error("O CPF informado é inválido.");
  }

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { cpf: cleanCPF }] }
  });
  if (existingUser) {
    throw new Error("Este e-mail jÃ¡ estÃ¡ cadastrado.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "USER", cpf: cleanCPF },
  });

  const token = await signSession({ sub: user.id, role: user.role as Role, tv: user.tokenVersion });
  
  return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role as Role } }, { cookies: [sessionCookie(token)] });
});


