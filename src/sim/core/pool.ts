/** OpenTTD's pools reuse the lowest free index: the first null slot, else the end of the pool. */
export function lowestFreeSlot<T>(pool: readonly (T | null)[]): number {
  const free = pool.indexOf(null);
  return free === -1 ? pool.length : free;
}
