export function resolveRuntimePort() {
  const raw = process.env.PORT;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 3000;
}

export function resolveLocalBaseUrl() {
  const port = resolveRuntimePort();
  return `http://localhost:${port}`;
}

