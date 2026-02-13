"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, Math.max(5000, intervalMs));
    return () => clearInterval(id);
  }, [intervalMs, router]);

  return null;
}
