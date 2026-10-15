/**
 * Drops keys whose value is `undefined`, so a PATCH only writes the fields the client sent
 * (`null` is kept: it clears a nullable column).
 */
export function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
