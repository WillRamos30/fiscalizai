import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { authenticate } from "@/modules/auth/service";

export const GET = handle(async (req) => {
  const user = await authenticate(prisma, req);
  return json({ user });
});
