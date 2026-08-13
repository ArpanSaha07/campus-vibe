// apiFetch throws `new Error(responseBodyText)`, so a backend ApiError arrives
// as a JSON string sitting in Error.message and has to be dug back out. Shared
// so every auth surface reports the same failure the same way.
export function parseApiError(err: unknown, fallback: string): string {
  if (!(err instanceof Error) || !err.message) return fallback;
  try {
    const parsed = JSON.parse(err.message);
    return typeof parsed?.message === "string" && parsed.message ? parsed.message : fallback;
  } catch {
    return err.message;
  }
}
