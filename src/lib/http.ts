// Helpers HTTP compartilhados pelas rotas de API: erros tipados, validação, CSRF, IP, wrapper.

import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "ERROR",
    public details?: unknown,
    public headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (m: string, details?: unknown) => new HttpError(400, m, "BAD_REQUEST", details);
export const unauthorized = (m = "Autenticação necessária.") => new HttpError(401, m, "UNAUTHENTICATED");
export const forbidden = (m = "Sem permissão para esta ação.") => new HttpError(403, m, "FORBIDDEN");
export const notFound = (m = "Recurso não encontrado.") => new HttpError(404, m, "NOT_FOUND");
export const tooMany = (retryAfterSec: number, m = "Muitas requisições. Tente novamente em instantes.") =>
  new HttpError(429, m, "RATE_LIMITED", { retryAfterSec }, { "Retry-After": String(retryAfterSec) });

export function json(data: unknown, init: ResponseInit & { cookies?: string[] } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", headers.get("Cache-Control") ?? "no-store");
  for (const c of init.cookies ?? []) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify(data), { status: init.status ?? 200, headers });
}

export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/**
 * Proteção CSRF para métodos que alteram estado:
 *  1) o cookie de sessão já é SameSite=Lax (não vai em POST cross-site);
 *  2) além disso, exigimos que Origin/Sec-Fetch-Site (quando presentes) sejam do mesmo site.
 * Clientes não-navegador (sem Origin) não são vetor de CSRF, pois não carregam o cookie da vítima.
 */
export function assertSameOrigin(req: Request): void {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
  const site = req.headers.get("sec-fetch-site");
  if (site && !["same-origin", "none"].includes(site)) throw forbidden("Requisição entre sites bloqueada (CSRF).");
  const origin = req.headers.get("origin");
  if (origin) {
    const allowed = new Set<string>();
    try {
      allowed.add(new URL(req.url).host);
    } catch {}
    const host = req.headers.get("host");
    if (host) allowed.add(host);
    const pub = process.env.NEXT_PUBLIC_SITE_URL;
    if (pub) {
      try {
        allowed.add(new URL(pub).host);
      } catch {}
    }
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (!allowed.has(originHost)) throw forbidden("Origem não permitida (CSRF).");
  }
}

export async function readJson<T>(req: Request, schema: { parse: (v: unknown) => T }, maxBytes = 64_000): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "Corpo da requisição muito grande.", "TOO_LARGE");
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) throw new HttpError(413, "Corpo da requisição muito grande.", "TOO_LARGE");
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw badRequest("JSON inválido.");
  }
  return schema.parse(body); // ZodError é tratado em handle()
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Envolve um handler: CSRF + tratamento uniforme de erros (Zod → 400, HttpError → status, resto → 500). */
export function handle<C = unknown>(fn: Handler<C>, opts: { csrf?: boolean } = {}): Handler<C> {
  return async (req, ctx) => {
    try {
      if (opts.csrf !== false) assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        return json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status, headers: e.headers });
      }
      if (e instanceof ZodError) {
        return json(
          { error: { code: "VALIDATION", message: "Dados inválidos.", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } },
          { status: 400 },
        );
      }
      console.error("[api] erro inesperado:", e);
      return json({ error: { code: "INTERNAL", message: "Erro interno. Tente novamente." } }, { status: 500 });
    }
  };
}
