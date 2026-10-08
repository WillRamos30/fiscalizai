import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const rows = await prisma.score.findMany({
    where: { kind: "CUMULATIVE", isCurrent: true },
    include: { politician: { select: { politicalName: true, stateUf: true, office: { select: { slug: true } } } }, components: { where: { level: "PILLAR" } } },
    orderBy: { total: "desc" },
  });
  for (const r of rows) {
    const pil = r.components.map((c) => `${c.code}:${c.points == null ? "—" : c.points.toFixed(1)}/${c.maxPoints}`).join(" ");
    console.log(
      `${(r.politician.politicalName).padEnd(22)} ${r.politician.office.slug.slice(0, 3)} ${r.politician.stateUf} ` +
        `tot=${r.total ?? "—"} tec=${r.technical ?? "—"} pop=${r.popularApproval ?? "—"} conf=${r.confidence} rank=${r.rankOffice}/${r.totalOffice} | ${pil}`,
    );
  }
  const hist = await prisma.score.findMany({
    where: { kind: "ROLLING12", isCurrent: true, politician: { slug: "joao-exemplo" } },
    orderBy: { periodEnd: "asc" },
  });
  console.log("hist joao:", hist.map((h) => `${h.label}=${h.total}`).join(", "));
}
main().finally(() => prisma.$disconnect());
