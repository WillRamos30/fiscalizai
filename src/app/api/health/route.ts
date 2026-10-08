import { json } from "@/lib/http";
import { handle } from "@/lib/http";
import { prisma } from "@/lib/db";

export const GET = handle(async () => {
  await prisma.$queryRaw`SELECT 1`;
  return json({ status: "ok", time: new Date().toISOString() });
});
