import { z } from "zod";
import type { Db } from "@/lib/db";
import type { Role } from "@/lib/constants";
import { forbidden, HttpError, tooMany, unauthorized } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/modules/audit/audit";
import { DUMMY_HASH, hashPassword, passwordSchema, verifyPassword } from "./password";
import { signSession, tokenFromRequest, verifySession } from "./session";

export type AuthUser = { id: string; email: string; name: string; role: Role; status: string };

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
  password: z.string().min(1).max(128),
});

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60_000;

const publicUser = (u: { id: string; email: string; name: string; role: string; status: string }): AuthUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role as Role,
  status: u.status,
});

export async function registerUser(db: Db, input: z.infer<typeof registerSchema>, ip: string) {
  const rl = rateLimit(`register:${ip}`, 8, 60 * 60_000);
  if (!rl.allowed) throw tooMany(rl.retryAfterSec);
  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw new HttpError(409, "Este e-mail já está cadastrado.", "EMAIL_TAKEN");
  const user = await db.user.create({
    data: { email: input.email, name: input.name, passwordHash: await hashPassword(input.password), role: "USER" },
  });
  await audit(db, { actorId: user.id, actorLabel: user.email, action: "USER_REGISTERED", entity: "User", entityId: user.id, ip });
  const token = await signSession({ sub: user.id, role: "USER", tv: user.tokenVersion });
  return { user: publicUser(user), token };
}

export async function loginUser(db: Db, input: z.infer<typeof loginSchema>, ip: string) {
  const rlIp = rateLimit(`login-ip:${ip}`, 30, 15 * 60_000);
  const rlEmail = rateLimit(`login-email:${input.email}`, 10, 15 * 60_000);
  if (!rlIp.allowed || !rlEmail.allowed) throw tooMany(Math.max(rlIp.retryAfterSec, rlEmail.retryAfterSec));

  const user = await db.user.findUnique({ where: { email: input.email } });
  const genericFail = new HttpError(401, "E-mail ou senha incorretos.", "INVALID_CREDENTIALS");

  if (!user) {
    await verifyPassword(input.password, DUMMY_HASH); // equaliza o tempo
    throw genericFail;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, "Conta temporariamente bloqueada por tentativas inválidas. Tente mais tarde.", "LOCKED");
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MS) : null },
    });
    if (lock) await audit(db, { actorId: user.id, actorLabel: user.email, action: "USER_LOCKED", entity: "User", entityId: user.id, ip });
    throw genericFail;
  }
  if (user.status !== "ACTIVE") throw forbidden("Conta suspensa.");

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await audit(db, { actorId: user.id, actorLabel: user.email, action: "USER_LOGIN", entity: "User", entityId: user.id, ip });
  const token = await signSession({ sub: user.id, role: user.role as Role, tv: user.tokenVersion });
  return { user: publicUser(user), token };
}

/** Resolve o usuário da requisição: valida JWT E confere no banco (papel atual, status, tokenVersion). */
export async function authenticate(db: Db, req: Request): Promise<AuthUser | null> {
  const payload = await verifySession(tokenFromRequest(req));
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== "ACTIVE" || user.tokenVersion !== payload.tv) return null;
  return publicUser(user);
}

export async function requireUser(db: Db, req: Request): Promise<AuthUser> {
  const u = await authenticate(db, req);
  if (!u) throw unauthorized();
  return u;
}

/** RBAC: exige um dos papéis informados. Sempre usa o papel do BANCO, nunca só o do token. */
export async function requireRole(db: Db, req: Request, roles: Role[]): Promise<AuthUser> {
  const u = await requireUser(db, req);
  if (!roles.includes(u.role)) throw forbidden();
  return u;
}

/** Invalida todas as sessões do usuário (logout global / troca de senha / suspensão). */
export async function revokeSessions(db: Db, userId: string) {
  await db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
}
