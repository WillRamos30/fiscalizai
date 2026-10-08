// Processamento assíncrono (fila em processo, sequencial).
// Recálculos e sincronizações NUNCA rodam no caminho de uma requisição de leitura: a API admin
// enfileira o job e responde 202. Interface mínima — troque por BullMQ/Cloud Tasks/worker dedicado
// em produção mantendo `enqueueJob`/`listJobs`.

export type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED";

export type JobInfo = {
  id: string;
  name: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: unknown;
  error?: string;
};

type State = { jobs: Map<string, JobInfo>; promises: Map<string, Promise<void>>; tail: Promise<void> };
const g = globalThis as unknown as { __FiscalizaIJobs?: State };
const state: State = (g.__FiscalizaIJobs ??= { jobs: new Map(), promises: new Map(), tail: Promise.resolve() });

export function enqueueJob(name: string, fn: () => Promise<unknown>): JobInfo {
  const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const info: JobInfo = { id, name, status: "QUEUED", createdAt: new Date().toISOString() };
  state.jobs.set(id, info);
  const p = state.tail.then(async () => {
    info.status = "RUNNING";
    info.startedAt = new Date().toISOString();
    try {
      info.result = await fn();
      info.status = "DONE";
    } catch (e) {
      info.status = "FAILED";
      info.error = e instanceof Error ? e.message : String(e);
    } finally {
      info.finishedAt = new Date().toISOString();
    }
  });
  state.tail = p;
  state.promises.set(id, p);
  // mantém só os 50 mais recentes
  if (state.jobs.size > 50) {
    const oldest = [...state.jobs.keys()][0];
    state.jobs.delete(oldest);
    state.promises.delete(oldest);
  }
  return info;
}

export async function waitForJob(id: string): Promise<JobInfo | undefined> {
  await state.promises.get(id);
  return state.jobs.get(id);
}

export function listJobs(): JobInfo[] {
  return [...state.jobs.values()].reverse();
}
