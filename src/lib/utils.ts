import { createHash } from "node:crypto";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Normaliza texto para busca: minúsculas, sem acentos, espaços colapsados.
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Hash do IP com sal: não guardamos IP em claro (LGPD), mas ainda detectamos abuso.
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.AUTH_SECRET ?? "dev-salt";
  return sha256(`${salt}:${ip}`).slice(0, 32);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function formatDateBR(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatNumber(n: number, digits = 1): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function formatScore(score: number | null | undefined): string {
  if (score == null) return "—";
  return formatNumber(score, 1);
}

export function monthsBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24 * 30.4375));
}

export function safeJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
