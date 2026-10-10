import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/modules/auth/session";

export const metadata: Metadata = {
  title: "FiscalizaI - Fiscalize quem você elegeu",
  description: "Plataforma de avaliação de desempenho de políticos brasileiros.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  const isLoggedIn = !!session;
  const isAdmin = session?.role === "ADMIN";

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="bg-brand-900 text-white shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                <span className="text-2xl">🏛️</span>
                <div>
                  <h1 className="font-bold text-xl tracking-tight leading-none">FiscalizaI</h1>
                  <span className="text-[10px] uppercase tracking-wider text-brand-200 font-medium">Dados Públicos</span>
                </div>
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium">
                <Link href="/" className="hidden sm:block hover:text-brand-200 transition-colors">Início</Link>
                <Link href="/ranking" className="hidden sm:block hover:text-brand-200 transition-colors">Ranking</Link>
                <Link href="/comparar" className="hidden sm:block hover:text-brand-200 transition-colors">Comparar</Link>
                <Link href="/feed" className="hidden sm:block hover:text-brand-200 transition-colors">Feed</Link>
                <ThemeToggle />
                {isLoggedIn ? (
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <Link href="/admin" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors text-white text-sm font-medium">Painel</Link>
                    )}
                    <Link href="/perfil" className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-md transition-colors text-white text-sm font-medium">Meu Perfil</Link>
                    <LogoutButton />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link href="/login" className="px-4 py-2 text-brand-100 hover:text-white transition-colors text-sm font-medium">Entrar</Link>
                    <Link href="/cadastro" className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-md transition-colors text-white text-sm font-medium border border-brand-500 shadow-sm">Criar Conta</Link>
                  </div>
                )}
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            {children}
          </main>
          <footer className="bg-surface-50 border-t border-surface-200 py-8 text-center text-ink-500 text-sm">
            <p>FiscalizaI © {new Date().getFullYear()}. Código aberto e dados públicos.</p>
            <p className="mt-1">Não temos afiliação com o Governo Federal.</p>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
