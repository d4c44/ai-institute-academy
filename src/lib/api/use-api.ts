"use client";

import { useEffect, useState } from "react";
import { apiRead, onApiChange } from "./browser";

type Loaded<T> = { path: string; status: number; data: T | null };

/**
 * Loads `path` from the API in the browser. `loading` is true until the first answer for the current
 * path; after any successful change made through apiSend the data is fetched again in the background
 * (the old data stays on screen meanwhile). Pass null to skip.
 */
export function useApi<T>(path: string | null) {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => onApiChange(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (!path) return;
    let live = true;
    apiRead<T>(path).then((res) => {
      if (live) setLoaded({ path, status: res.status, data: res.data });
    });
    return () => {
      live = false;
    };
  }, [path, tick]);

  const current = loaded && loaded.path === path ? loaded : null;
  return { loading: path !== null && current === null, status: current?.status ?? null, data: current?.data ?? null };
}
