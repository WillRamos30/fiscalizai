import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";

export const GET = handle(async (req) => {
  await requireRole(prisma, req, ["ADMIN"]);

  // Deputados
  const camaraImportados = await prisma.politician.count({
    where: { externalKey: { startsWith: "camara:" } }
  });

  // Senadores
  const senadoImportados = await prisma.politician.count({
    where: { externalKey: { startsWith: "senado:" } }
  });

  return json({
    camara: {
      importados: camaraImportados,
      total: 513,
      faltam: Math.max(0, 513 - camaraImportados),
      completo: camaraImportados >= 513
    },
    senado: {
      importados: senadoImportados,
      total: 81,
      faltam: Math.max(0, 81 - senadoImportados),
      completo: senadoImportados >= 81
    }
  });
});
