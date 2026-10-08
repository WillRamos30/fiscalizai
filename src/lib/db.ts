import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Cliente Prisma único (evita múltiplas conexões no hot-reload do Next em dev).
// Extensão de proteção: tabelas append-only/imutáveis NÃO aceitam alteração silenciosa.
// (Em produção, reforce com permissões do banco: REVOKE UPDATE, DELETE em AuditLog.)

function immutable(model: string): never {
  throw new Error(`${model} é imutável: alterações/remoções não são permitidas.`);
}

function createClient() {
  const base = new PrismaClient({
    log: process.env.PRISMA_LOG ? ["query", "error", "warn"] : ["error"],
  });

  return base.$extends({
    name: "immutability-guard",
    query: {
      auditLog: {
        update: () => immutable("AuditLog"),
        updateMany: () => immutable("AuditLog"),
        upsert: () => immutable("AuditLog"),
        delete: () => immutable("AuditLog"),
        deleteMany: () => immutable("AuditLog"),
      },
      algorithmVersion: {
        // Só o status/activatedAt pode mudar; o conteúdo (config) é imutável.
        async update({ args, query }) {
          const data = args.data as Record<string, unknown>;
          for (const k of Object.keys(data)) {
            if (!["status", "activatedAt"].includes(k)) {
              throw new Error(`AlgorithmVersion.${k} é imutável; crie uma nova versão.`);
            }
          }
          return query(args);
        },
        updateMany: () => immutable("AlgorithmVersion"),
        upsert: () => immutable("AlgorithmVersion"),
        delete: () => immutable("AlgorithmVersion"),
        deleteMany: () => immutable("AlgorithmVersion"),
      },
      scoreComponent: {
        update: () => immutable("ScoreComponent"),
        updateMany: () => immutable("ScoreComponent"),
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { __prisma?: ExtendedClient };

export const prisma: ExtendedClient = globalForPrisma.__prisma ?? createClient();
if (env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;

export type Db = ExtendedClient;
// Cliente de transação (parâmetro do callback de $transaction).
export type Tx = Parameters<Parameters<ExtendedClient["$transaction"]>[0]>[0];
