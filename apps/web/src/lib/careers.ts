import type { PublicCareerCategoryDto } from '@asra/types';
import { apiRequest } from './api';

/**
 * Fetches dynamic career categories from published, active, non-expired jobs.
 * Uses Next.js Incremental Static Regeneration (ISR) revalidation with a 60-second window.
 * Returns an empty array if the API is offline or no published jobs exist.
 */
export async function getPublicCareerCategories(): Promise<PublicCareerCategoryDto[]> {
  try {
    const data = await apiRequest<PublicCareerCategoryDto[]>('/careers/categories', {
      timeoutMs: 5_000,
      next: { revalidate: 60, tags: ['careers-categories'] },
    });
    return Array.isArray(data) ? data : [];
  } catch {
    // Graceful fallback: return empty array so footer renders only CAREERS link
    return [];
  }
}
