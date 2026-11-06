const REQUEST_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response | null, attempt: number): number {
  const retryAfter = Number(response?.headers.get('Retry-After'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 8_000);
  }

  return 800 * (attempt + 1);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function abortError(): Error {
  const error = new Error('Request aborted');
  error.name = 'AbortError';
  return error;
}

// `init.signal` cancels the request (and any retry) with an AbortError; the
// built-in timeout surfaces as "Request timed out" instead.
export async function fetchJson(url: string, init?: RequestInit, attempt = 0): Promise<unknown> {
  const outer = init?.signal;
  if (outer?.aborted) {
    throw abortError();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  outer?.addEventListener('abort', forwardAbort);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(response, attempt));
      return fetchJson(url, init, attempt + 1);
    }

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    if (outer?.aborted) {
      throw abortError();
    }

    if (isAbortError(error)) {
      throw new Error('Request timed out');
    }

    const canRetryNetwork =
      attempt < 1 && error instanceof TypeError && /network request failed/i.test(error.message);
    if (canRetryNetwork) {
      await sleep(retryDelayMs(null, attempt));
      return fetchJson(url, init, attempt + 1);
    }

    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', forwardAbort);
  }
}

export async function mapInBatches<T, R>(
  items: T[],
  size: number,
  mapper: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const mapped: R[] = [];

  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    const results = await Promise.allSettled(chunk.map(mapper));

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        mapped.push(result.value);
      }
    }
  }

  return mapped;
}
