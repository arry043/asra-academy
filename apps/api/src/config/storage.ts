/**
 * Storage providers that resources may reference (`Resource.storageProvider`).
 *
 * EMPTY ON PURPOSE: no object-storage or video-hosting provider has been chosen yet
 * (CLIENT-CLARIFICATIONS R-01, G-01), and there is no upload endpoint. Until one is integrated
 * behind the `StorageProvider` adapter (docs/ARCHITECTURE.md §8.3), the API accepts only external
 * HTTPS URLs for lesson resources and rejects stored-object references with a clear 422 — it does
 * not pretend files can be uploaded. Add the adapter's identifier here when it exists.
 */
export const CONFIGURED_STORAGE_PROVIDERS: ReadonlySet<string> = new Set<string>();
