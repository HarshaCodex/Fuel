import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { deleteEntry, trackingKeys, type DashboardEntry } from '@/api/tracking';

export const UNDO_MS = 6000;

/**
 * Deletes that wait behind an undo toast. A scheduled entry is hidden at once (its id enters `ids`) and the server
 * call runs when the timer ends. A second delete sends the first immediately, so there is only one toast. On failure
 * the id leaves `ids`, which brings the row back, and `onError` is told. The cache is never written: callers derive
 * the view from `ids`, so a refetch during the window cannot resurrect the row.
 */
export function usePendingDeletes(onError: (error: unknown, entry: DashboardEntry) => void) {
  const qc = useQueryClient();
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const [last, setLast] = useState<DashboardEntry | null>(null);
  const pending = useRef(new Map<string, { entry: DashboardEntry; timer: ReturnType<typeof setTimeout> | null }>());
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });
  const mounted = useRef(true);

  const drop = useCallback((id: string) => {
    pending.current.delete(id);
    if (mounted.current) {
      setIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }, []);

  const send = useCallback(
    async (entry: DashboardEntry) => {
      const item = pending.current.get(entry.id);
      if (!item) return;
      if (item.timer) clearTimeout(item.timer);
      item.timer = null;
      try {
        await deleteEntry(entry.id);
        await qc.invalidateQueries({ queryKey: trackingKeys.all });
        drop(entry.id);
      } catch (error) {
        drop(entry.id);
        onErrorRef.current(error, entry);
      }
    },
    [qc, drop],
  );

  const flush = useCallback(() => {
    for (const { entry, timer } of [...pending.current.values()]) {
      if (timer) void send(entry);
    }
    if (mounted.current) setLast(null);
  }, [send]);

  const schedule = useCallback(
    (entry: DashboardEntry) => {
      flush();
      const timer = setTimeout(() => {
        if (mounted.current) setLast(null);
        void send(entry);
      }, UNDO_MS);
      pending.current.set(entry.id, { entry, timer });
      setIds((s) => new Set(s).add(entry.id));
      setLast(entry);
    },
    [flush, send],
  );

  const undo = useCallback(() => {
    for (const [id, item] of [...pending.current.entries()]) {
      if (!item.timer) continue;
      clearTimeout(item.timer);
      drop(id);
    }
    setLast(null);
  }, [drop]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => {
      sub.remove();
    };
  }, [flush]);

  useEffect(() => {
    const items = pending.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const { entry, timer } of [...items.values()]) {
        if (timer) void send(entry);
      }
    };
  }, [send]);

  return { ids, last, schedule, undo, flush };
}
