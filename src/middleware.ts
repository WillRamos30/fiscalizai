import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("FiscalizaI_session")?.value;
  const path = request.nextUrl.pathname;

  // Rotas que não podem ser acessadas se o usuário já estiver logado
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/cadastro");

  // Rotas protegidas (apenas usuários logados)
  const isProtectedRoute = path.startsWith("/admin") || path.startsWith("/perfil");

  let role = "USER";
  if (token) {
    try {
      const payloadBase64 = token.split(".")[1];
      const payloadJson = atob(payloadBase64);
      role = JSON.parse(payloadJson).role;
    } catch (e) {}
  }

  if (isAuthRoute && token) {
    // Se está logado e tenta ir pro login/cadastro, manda pro dashboard correspondente
    if (role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.redirect(new URL("/perfil", request.url));
  }

  // Proteção de Administrador
  if (path.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/perfil", request.url));
  }

  if (isProtectedRoute && !token) {
    // Se não está logado e tenta ir pra área restrita, manda pro login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Configura o middleware para rodar em todas as rotas de página, ignorando estáticos e API
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
