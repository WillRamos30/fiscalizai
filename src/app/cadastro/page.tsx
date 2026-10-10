"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, cpf }),
      });

      if (!res.ok) {
        const data = await res.json();
        const msg = data.error?.message || "Erro ao criar conta";
        throw new Error(msg);
      }

      // Sucesso: Atualiza o layout e redireciona para o feed
      router.refresh();
      window.location.href = "/feed"; // hard redirect to ensure session updates
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 bg-white dark:bg-surface-100 p-8 rounded-2xl shadow-sm border border-surface-200">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-ink-900 mb-2">Criar Conta</h1>
        <p className="text-ink-500 text-sm">Junte-se ao FiscalizaI e acompanhe polÃ­ticos.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-bad-50 dark:bg-bad-700/20 text-bad-700 dark:text-bad-500 text-sm font-medium rounded-lg border border-bad-500/20">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-ink-900 mb-2">Nome Completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-surface-200 bg-surface-50 dark:bg-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-ink-900"
            placeholder="JoÃ£o Silva"
            required
            minLength={2}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-ink-900 mb-2">CPF</label>
          <input
            type="text"
            value={cpf}
            onChange={(e) => {
              let v = e.target.value.replace(/\D/g, "");
              if (v.length > 11) v = v.slice(0, 11);
              v = v.replace(/(\d{3})(\d)/, "$1.$2");
              v = v.replace(/(\d{3})(\d)/, "$1.$2");
              v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
              setCpf(v);
            }}
            className="w-full px-4 py-3 rounded-lg border border-surface-200 bg-surface-50 dark:bg-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-ink-900"
            placeholder="000.000.000-00"
            required
            maxLength={14}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-ink-900 mb-2">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-surface-200 bg-surface-50 dark:bg-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-ink-900"
            placeholder="joao@exemplo.com"
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
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
        >
          {loading ? "Criando conta..." : "Criar Conta"}
        </button>
      </form>

      <div className="mt-6 text-center text-sm font-medium text-ink-500">
        JÃ¡ tem uma conta?{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          Entrar
        </Link>
      </div>
    </div>
  );
}

