"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const msg = errorData.error?.message || "Erro ao fazer login";
        throw new Error(msg);
      }

      // Sucesso: Atualiza o layout e redireciona
      const data = await res.json();
      router.refresh();
      if (data.user?.role === "ADMIN") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/perfil";
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 bg-white dark:bg-surface-100 p-8 rounded-2xl shadow-sm border border-surface-200">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-ink-900 mb-2">Entrar</h1>
        <p className="text-ink-500 text-sm">Acesse o painel do FiscalizaI</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-bad-50 dark:bg-bad-700/20 text-bad-700 dark:text-bad-500 text-sm font-medium rounded-lg border border-bad-500/20">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-ink-900 mb-2">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-surface-200 bg-surface-50 dark:bg-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-ink-900"
            placeholder="admin@fiscalizai.com.br"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-ink-900 mb-2">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-surface-200 bg-surface-50 dark:bg-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-ink-900"
            placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Acessar Painel"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/" className="text-sm text-brand-600 font-medium hover:underline">
          â† Voltar para o site
        </Link>
      </div>
    </div>
  );
}


