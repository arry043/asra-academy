/**
 * Server-side feature flags. Read at REQUEST time (callers must opt into dynamic rendering, e.g.
 * with `await connection()`), so one build can be promoted through environments. The variables
 * are not `NEXT_PUBLIC_*`, so they are never inlined into browser bundles.
 */

/**
 * The internal design-system showcase (/design-system) is always available in development and
 * test. In production builds it returns 404 unless `ENABLE_DESIGN_SYSTEM=true` is set — e.g. on a
 * staging deployment for client review. It contains demo data only, never user data.
 */
export function isDesignSystemEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DESIGN_SYSTEM === 'true';
}

/**
 * Search-engine indexing of the public website. OFF unless `SITE_INDEXING_ENABLED=true`, so local,
 * preview and staging deployments are never indexed by accident. Unlike the flag above, this is
 * read when pages are PRERENDERED (metadata and robots.txt of static routes), so set it in the
 * build environment of the production deployment only — after the domain is live (W-04) and
 * the legal pages carry approved text (U-01).
 */
export function isSiteIndexingEnabled(): boolean {
  return process.env.SITE_INDEXING_ENABLED === 'true';
}
