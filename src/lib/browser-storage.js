export function localStorageGet(key, fallback = "") {
  try {
    return globalThis.localStorage?.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function localStorageSet(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage can be blocked in private browsing or embedded contexts.
  }
}
