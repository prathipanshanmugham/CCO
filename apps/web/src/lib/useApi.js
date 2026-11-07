import { useCallback, useEffect, useRef, useState } from 'react';

// Load data for a page; `reload()` refetches; `setData` lets actions replace the result.
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try { const data = await fn(); if (alive.current) setState({ data, error: null, loading: false }); }
    catch (error) { if (alive.current) setState((s) => ({ ...s, error, loading: false })); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { alive.current = true; run(); return () => { alive.current = false; }; }, [run]);
  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}
