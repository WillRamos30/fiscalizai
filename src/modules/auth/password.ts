import bcrypt from "bcryptjs";
import { z } from "zod";

// bcrypt (custo 12): hash com sal embutido. Senhas NUNCA são armazenadas nem logadas em texto puro.
const COST = process.env.NODE_ENV === "test" ? 4 : 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Hash descartável para equalizar o tempo de resposta quando o e-mail não existe (evita enumeração).
export const DUMMY_HASH = bcrypt.hashSync("senha-descartavel-nao-usada", 4);

export const passwordSchema = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .regex(/[a-z]/, "Inclua ao menos uma letra minúscula.")
  .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula.")
  .regex(/[0-9]/, "Inclua ao menos um número.");
