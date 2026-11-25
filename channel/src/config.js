/**
 * Read a plugin config field that may be a plain value or a live reference
 * (an object with `get`, as DSH passes volatile settings and credentials).
 * @param value - config field.
 * @param fallback - value used when the field is absent or cannot be read.
 * @returns the current value.
 */
export function readLive(value, fallback) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    try {
      const current = value.get()
      return current === undefined ? fallback : current
    } catch {
      return fallback
    }
  }
  return value === undefined || value === null ? fallback : value
}
