import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/constants";

export const SESSION_COOKIE = "FiscalizaI_session";
export const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 dias

export type SessionPayload = { sub: string; role: Role; tv: number };

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET ausente ou curto (mínimo 32 caracteres) em produção.");
    }
    return new TextEncoder().encode("dev-only-secret-change-me-0123456789abcdef");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ role: p.role, tv: p.tv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(getSecret());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.role !== "string" || typeof payload.tv !== "number") return null;
    return { sub: payload.sub, role: payload.role as Role, tv: payload.tv };
  } catch {
    return null;
  }
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SEC}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function tokenFromRequest(req: Request): string | undefined {
  return parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
}
