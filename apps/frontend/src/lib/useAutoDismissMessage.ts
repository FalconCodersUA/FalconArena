import { Dispatch, SetStateAction, useEffect } from 'react';

export const AUTO_DISMISS_NOTICE_MS = 4000;

export function useAutoDismissMessage(
  message: string,
  setMessage: Dispatch<SetStateAction<string>>,
  durationMs = AUTO_DISMISS_NOTICE_MS,
) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage('');
    }, durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, message, setMessage]);
}
