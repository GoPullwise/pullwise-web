export const successfulListCache = new Map();
export const issueUpdateCache = new Map();
export const issueUpdateKeysById = new Map();
export const inFlightDataRequests = new Map();

export function clearPullwiseDataCache() {
  successfulListCache.clear();
  issueUpdateCache.clear();
  issueUpdateKeysById.clear();
  for (const entry of inFlightDataRequests.values()) {
    entry.controller?.abort?.();
  }
  inFlightDataRequests.clear();
}

export const __pullwiseDataCacheState = {
  successfulListCache,
  issueUpdateCache,
  issueUpdateKeysById,
  inFlightDataRequests,
};
