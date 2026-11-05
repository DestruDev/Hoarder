// Stores call notifyLocalWrite after changing synced data so sync can push it.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onLocalWrite(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyLocalWrite(): void {
  for (const listener of listeners) {
    listener();
  }
}
