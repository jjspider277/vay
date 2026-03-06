const runtimeEnv = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env;
export const API_BASE_URL = runtimeEnv?.REACT_APP_API_BASE_URL || 'http://localhost:3001';

export const LOW_BATTERY_THRESHOLD = 20;
export const STALE_SIGNAL_THRESHOLD_MS = 30000;
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60000;
export const REFRESH_INTERVAL_MS = 5000;
export const MESSAGE_CLEAR_DELAY_MS = 3000;

export const DEFAULT_BULK_ADD_COUNT = 10;
export const MIN_BULK_ADD_COUNT = 1;

export const MAX_BULK_ADD_COUNT = 20;
