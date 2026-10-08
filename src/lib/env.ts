import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "A URL do banco de dados deve ser informada"),
  AUTH_SECRET: z.string().min(16, "O AUTH_SECRET deve ter pelo menos 16 caracteres para segurança"),
  
  // Variáveis opcionais que podemos ter para Analytics, Sentry, etc.
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Variáveis de ambiente inválidas ou ausentes:");
  console.error(_env.error.format());
  throw new Error("Erro de validação de variáveis de ambiente. Verifique o arquivo .env");
}

export const env = _env.data;
