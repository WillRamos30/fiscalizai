import { handle, json, getClientIp, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { loginSchema, loginUser } from "@/modules/auth/service";
import { sessionCookie } from "@/modules/auth/session";

export const POST = handle(async (req) => {
  const input = await readJson(req, loginSchema);
  const { user, token } = await loginUser(prisma, input, getClientIp(req));
  return json({ user }, { cookies: [sessionCookie(token)] });
});
