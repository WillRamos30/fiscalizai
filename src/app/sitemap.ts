import { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://FiscalizaI.demo';

  // Páginas estáticas principais
  const routes = ['', '/ranking', '/comparar', '/feed', '/metodologia', '/sobre'].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Podemos também gerar o sitemap dinamicamente com os top políticos (por exemplo, os primeiros 50)
  // para acelerar a indexação no Google.
  const topPoliticians = await prisma.politician.findMany({
    take: 50,
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' }
  });

  const politicianRoutes = topPoliticians.map(p => ({
    url: `${baseUrl}/politico/${p.id}`,
    lastModified: p.updatedAt.toISOString(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...routes, ...politicianRoutes];
}
