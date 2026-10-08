import path from "node:path";

// Executa ANTES de qualquer import nos arquivos de teste: aponta o Prisma para o banco de teste.
process.env.DATABASE_URL = `file:${path.resolve(__dirname, "..", "prisma", "test.db").replace(/\\/g, "/")}`;
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-0123456789";
(process.env as Record<string, string>).NODE_ENV = "test";
delete process.env.TURNSTILE_SECRET;
