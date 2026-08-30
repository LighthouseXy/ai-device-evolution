export async function fetchWithRetry(input, { attempts = 2, timeoutMs = 15000, ...init } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (attempt + 1 < attempts && (response.status === 408 || response.status === 429 || response.status >= 500)) {
        await response.body?.cancel();
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
