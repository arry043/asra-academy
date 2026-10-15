import type { FacultySummary } from '@/types/education';

/**
 * Public faculty profiles shown on /faculty and the homepage.
 *
 * EMPTY ON PURPOSE: no faculty names, photos or credentials have been approved for publication
 * (CLIENT-CLARIFICATIONS C-01, C-02), and the API has no public faculty endpoint yet. Pages render
 * an honest empty state until profiles exist.
 *
 * FUTURE: a public endpoint should return only `FacultyProfile` rows with `isPublic = true` and
 * only public fields (name, designation, subjects, bio, photo URL) — never email, phone, user
 * status, roles or `employeeCode`. Map that response to `FacultySummary` and replace this list.
 */
export const publicFaculty: FacultySummary[] = [];
