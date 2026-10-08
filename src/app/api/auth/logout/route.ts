import { handle, json } from "@/lib/http";
import { clearSessionCookie } from "@/modules/auth/session";

export const POST = handle(async () => json({ ok: true }, { cookies: [clearSessionCookie()] }));
