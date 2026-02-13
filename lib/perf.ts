type PerfStep = {
  label: string;
  ms: number;
};

declare global {
  var __hepsionlinePerfSlowest: { key: string; ms: number } | undefined;
}

export function createPerfScope(scope: string) {
  const startedAt = Date.now();
  const steps: PerfStep[] = [];
  let stepIndex = 0;
  const scopeId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  async function time<T>(label: string, run: () => Promise<T>): Promise<T> {
    stepIndex += 1;
    const timerKey = `[perf] ${scope}[${scopeId}] :: ${label}#${stepIndex}`;
    const stepStartedAt = Date.now();
    console.time(timerKey);
    try {
      return await run();
    } finally {
      const elapsed = Date.now() - stepStartedAt;
      steps.push({ label, ms: elapsed });
      console.timeEnd(timerKey);
    }
  }

  function flush() {
    const total = Date.now() - startedAt;
    const slowest = steps.reduce<PerfStep | null>((acc, step) => {
      if (!acc || step.ms > acc.ms) return step;
      return acc;
    }, null);

    if (slowest) {
      console.log(`[perf] ${scope} total=${total}ms slowest=${slowest.label}(${slowest.ms}ms)`);
      const globalSlowest = globalThis.__hepsionlinePerfSlowest;
      if (!globalSlowest || slowest.ms > globalSlowest.ms) {
        globalThis.__hepsionlinePerfSlowest = { key: `${scope}::${slowest.label}`, ms: slowest.ms };
        console.log(`[perf][slowest] ${globalThis.__hepsionlinePerfSlowest.key} ${globalThis.__hepsionlinePerfSlowest.ms}ms`);
      }
      return;
    }

    console.log(`[perf] ${scope} total=${total}ms`);
  }

  return {
    time,
    flush,
  };
}
