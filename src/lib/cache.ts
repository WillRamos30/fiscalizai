// Cache em memória com TTL e invalidação por prefixo/tag.
// Interface propositalmente simples: trocar por Redis/CDN em produção sem alterar chamadores.

type Entry = { value: unknown; expires: number };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = fn()
    .then((v) => {
      store.set(key, { value: v, expires: Date.now() + ttlMs });
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function invalidate(prefix = ""): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

export function cacheSize(): number {
  return store.size;
}
