'use client';

import type {
  ClassDto,
  CourseCategoryDto,
  FacultyOptionDto,
  Paginated,
  StreamDto,
  SubjectDto,
} from '@asra/types';

import { useAdminApi, useApiResource } from './use-admin';

export interface CourseOptions {
  categories: CourseCategoryDto[];
  classes: ClassDto[];
  streams: StreamDto[];
  subjects: SubjectDto[];
}

/**
 * Relation options for course forms and filters, loaded from the real catalogue endpoints
 * (first 100 of each, ordered for display — enough for the academy's catalogue; a typeahead can
 * replace this if a list ever grows beyond that). Inactive rows are included so an existing
 * course still shows its current value; the form disables them for new choices.
 */
export function useCourseOptions() {
  const api = useAdminApi();
  return useApiResource<CourseOptions>('course-options', async () => {
    const [categories, classes, streams, subjects] = await Promise.all([
      api.get<Paginated<CourseCategoryDto>>('/admin/course-categories?pageSize=100'),
      api.get<Paginated<ClassDto>>('/admin/classes?pageSize=100'),
      api.get<Paginated<StreamDto>>('/admin/streams?pageSize=100'),
      api.get<Paginated<SubjectDto>>('/admin/subjects?pageSize=100'),
    ]);
    return {
      categories: categories.items,
      classes: classes.items,
      streams: streams.items,
      subjects: subjects.items,
    };
  });
}

export function useFacultyOptions() {
  const api = useAdminApi();
  return useApiResource('faculty-options', () =>
    api.get<FacultyOptionDto[]>('/admin/faculty?limit=100'),
  );
}
