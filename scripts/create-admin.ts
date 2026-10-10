import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/modules/auth/password";
import { ensureReferenceData } from "../src/modules/ingestion/reference";
import { ensureDefaultAlgorithm } from "../src/modules/scoring/algorithm";

async function main() {
  console.log("Configurando banco de produção...");
  
  // 1. Dados estruturais (cargos, partidos, algoritmo) - SEM DADOS FALSOS
  await ensureReferenceData(prisma, { demoSources: false });
  await ensureDefaultAlgorithm(prisma);

  // 2. Criando o Administrador oficial
  const email = "admin@fiscalizai.com.br";
  const password = "Admin#FiscalizaI2026";
  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", name: "Administrador FiscalizaI" },
    create: { email, name: "Administrador FiscalizaI", passwordHash, role: "ADMIN" },
  });

  console.log("=========================================");
  console.log("SUCESSO! O Banco de Produção foi inicializado.");
  console.log(`Painel Admin: ${email}`);
  console.log(`Senha Inicial: ${password}`);
  console.log("NENHUM DADO FICTÍCIO FOI INSERIDO.");
  console.log("=========================================");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
