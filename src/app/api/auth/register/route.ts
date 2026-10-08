import { handle, json, getClientIp, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { registerSchema, registerUser } from "@/modules/auth/service";
import { sessionCookie } from "@/modules/auth/session";

export const POST = handle(async (req) => {
  const input = await readJson(req, registerSchema);
  const { user, token } = await registerUser(prisma, input, getClientIp(req));
  return json({ user }, { status: 201, cookies: [sessionCookie(token)] });
});
