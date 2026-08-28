export interface PollingSubscriptionOptions<T> {
  readonly intervalMs: number;
  readonly load: (signal: AbortSignal) => Promise<T>;
  readonly onData: (value: T) => void;
  readonly onError?: (error: unknown) => void;
}

export function createPollingSubscription<T>(
  options: PollingSubscriptionOptions<T>
): () => void {
  let stopped = false;
  let hasReportedCurrentFailure = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  const poll = async (): Promise<void> => {
    controller = new AbortController();
    try {
      const value = await options.load(controller.signal);
      if (!stopped) {
        hasReportedCurrentFailure = false;
        options.onData(value);
      }
    } catch (error) {
      if (!stopped && !(error instanceof Error && error.name === 'AbortError')) {
        if (!hasReportedCurrentFailure) options.onError?.(error);
        hasReportedCurrentFailure = true;
      }
    } finally {
      controller = undefined;
      if (!stopped) timer = setTimeout(() => void poll(), options.intervalMs);
    }
  };

  void poll();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
  };
}
