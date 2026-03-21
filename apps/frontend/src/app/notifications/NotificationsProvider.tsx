import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type NotificationTone = 'success' | 'error' | 'info';

type NotificationEntry = {
  id: number;
  tone: NotificationTone;
  message: string;
};

type NotificationsApi = {
  notify: (message: string, tone?: NotificationTone, durationMs?: number) => void;
  notifySuccess: (message: string, durationMs?: number) => void;
  notifyError: (message: string, durationMs?: number) => void;
  notifyInfo: (message: string, durationMs?: number) => void;
};

const noop = () => undefined;

const NotificationsContext = createContext<NotificationsApi>({
  notify: noop,
  notifySuccess: noop,
  notifyError: noop,
  notifyInfo: noop,
});

export function useNotifications() {
  return useContext(NotificationsContext);
}

function normalizeDuration(durationMs?: number) {
  if (!durationMs || !Number.isFinite(durationMs)) {
    return 4200;
  }

  return Math.max(1500, Math.min(durationMs, 10000));
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationEntry[]>([]);
  const sequenceRef = useRef(0);
  const timersRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    return () => {
      for (const timerId of timersRef.current.values()) {
        window.clearTimeout(timerId);
      }
      timersRef.current.clear();
    };
  }, []);

  function dismiss(id: number) {
    const timerId = timersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    }
    setItems((current) => current.filter((entry) => entry.id !== id));
  }

  function push(message: string, tone: NotificationTone, durationMs?: number) {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      return;
    }

    sequenceRef.current += 1;
    const id = sequenceRef.current;
    const entry: NotificationEntry = { id, tone, message: normalizedMessage };

    setItems((current) => [...current.slice(-4), entry]);

    const timerId = window.setTimeout(() => dismiss(id), normalizeDuration(durationMs));
    timersRef.current.set(id, timerId);
  }

  const api = useMemo<NotificationsApi>(
    () => ({
      notify: (message, tone = 'info', durationMs) => push(message, tone, durationMs),
      notifySuccess: (message, durationMs) => push(message, 'success', durationMs),
      notifyError: (message, durationMs) => push(message, 'error', durationMs),
      notifyInfo: (message, durationMs) => push(message, 'info', durationMs),
    }),
    [],
  );

  return (
    <NotificationsContext.Provider value={api}>
      {children}
      <div className="app-toast-stack" role="status" aria-live="polite" aria-atomic="false">
        {items.map((entry) => (
          <div key={entry.id} className={`app-toast app-toast-${entry.tone}`}>
            <p>{entry.message}</p>
            <button
              type="button"
              className="app-toast-close"
              onClick={() => dismiss(entry.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

