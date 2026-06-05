export function localStorageGet(key, fallback = "") {
  try {
    return globalThis.localStorage?.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function localStorageSet(key, value) {
  try {
    if (value === null || value === undefined) {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage can be blocked in private browsing or embedded contexts.
  }
}
