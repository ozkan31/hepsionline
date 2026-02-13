"use client";

import React from "react";

type ApiSectionProps = {
  title: string;
  endpoint: string;
};

type ApiState =
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "ready"; data: unknown };

export function AdminApiSection({ title, endpoint }: ApiSectionProps) {
  const [state, setState] = React.useState<ApiState>({ type: "loading" });

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setState({ type: "loading" });
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as unknown;
        if (!cancelled) {
          setState({ type: "ready", data });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            type: "error",
            message: error instanceof Error ? error.message : "Bilinmeyen hata",
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return (
    <section className="mx-auto max-w-[1120px] rounded-3xl border border-[#E7ECF5] bg-white p-5 shadow-sm">
      <h1 className="text-3xl font-semibold text-slate-800">{title}</h1>
      {state.type === "loading" ? <p className="mt-4 text-sm text-slate-500">Yükleniyor...</p> : null}
      {state.type === "error" ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">API hatası: {state.message}</p>
      ) : null}
      {state.type === "ready" ? (
        <pre className="mt-4 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
          {JSON.stringify(state.data, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

