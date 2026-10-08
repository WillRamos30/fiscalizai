import type { Collector } from "../types";
import { MockCollector } from "./mock";
import { CamaraCollector, SenadoCollector, TransparenciaCollector, TSECollector } from "./official";

const registry: Record<string, () => Collector> = {
  mock: () => new MockCollector(),
  camara: () => new CamaraCollector(),
  senado: () => new SenadoCollector(),
  tse: () => new TSECollector(),
  transparencia: () => new TransparenciaCollector(),
};

export function listCollectors(): { id: string; label: string; connected: boolean }[] {
  return Object.entries(registry).map(([id, make]) => {
    const c = make();
    return { id, label: c.label, connected: id === "mock" || id === "camara" || id === "senado" };
  });
}

export function getCollector(id: string): Collector | null {
  return registry[id]?.() ?? null;
}
