"use client";

import { useSyncExternalStore, type Dispatch, type SetStateAction } from "react";

const memory = new Map<string, string>();
const eventName = "device-session-change";
function read(key: string, persist = true) {
  if (memory.has(key)) return memory.get(key)!;
  if (!persist) return "";
  try { return window.sessionStorage.getItem(key) ?? ""; }
  catch { return memory.get(key) ?? ""; }
}
function subscribe(listener: () => void) {
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
function parse<T>(value: string, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

// 当前标签页保存表单与已收到的结果；切换导航或刷新不会重新请求模型。
export function useSessionState<T>(key: string, initial: T, { persist = true } = {}): [T, Dispatch<SetStateAction<T>>] {
  const stored = useSyncExternalStore(subscribe, () => read(key, persist), () => "");
  const set: Dispatch<SetStateAction<T>> = next => {
    const current = parse(read(key, persist), initial);
    const value = typeof next === "function" ? (next as (value: T) => T)(current) : next;
    const serialized = JSON.stringify(value);
    memory.set(key, serialized);
    if (persist) {
      try { window.sessionStorage.setItem(key, serialized); } catch { /* 内存保留本次浏览状态。 */ }
    }
    window.dispatchEvent(new Event(eventName));
  };
  return [parse(stored, initial), set];
}
