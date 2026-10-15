'use client';

import type {
  AcademicLevelDto,
  ClassDto,
  CourseCategoryDto,
  StreamDto,
  SubjectDto,
} from '@asra/types';
import {
  academicLevelCreateSchema,
  academicLevelUpdateSchema,
  classCreateSchema,
  classUpdateSchema,
  courseCategoryCreateSchema,
  courseCategoryUpdateSchema,
  streamCreateSchema,
  streamUpdateSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
} from '@asra/validation';

import {
  CatalogueManager,
  optionalNumber,
  type CatalogueConfig,
  type CatalogueField,
  type FormValues,
} from './catalogue-manager';

const text = (values: FormValues, name: string) =>
  typeof values[name] === 'string' ? (values[name] as string) : '';

const nameField: CatalogueField = { name: 'name', label: 'Name', kind: 'text' };
const slugField: CatalogueField = {
  name: 'slug',
  label: 'Slug',
  kind: 'text',
  optional: true,
  hint: 'URL name, e.g. class-10. Generated from the name when left empty.',
};
const sortField: CatalogueField = {
  name: 'sortOrder',
  label: 'Sort order',
  kind: 'number',
  optional: true,
  hint: 'Lower numbers are listed first.',
};
const descriptionField: CatalogueField = {
  name: 'description',
  label: 'Description',
  kind: 'textarea',
  optional: true,
};

const countLabel = (count: number, noun: string) =>
  count > 0
    ? `Used by ${count} ${noun}${count === 1 ? '' : 's'} — it cannot be deleted while in use.`
    : null;

const levelConfig: CatalogueConfig<AcademicLevelDto> = {
  title: 'Academic levels',
  singular: 'Academic level',
  description:
    'Bands of school education, e.g. “Classes 6–10”. Classes and streams belong to a level.',
  endpoint: '/admin/academic-levels',
  createSchema: academicLevelCreateSchema,
  updateSchema: academicLevelUpdateSchema,
  fields: [
    nameField,
    slugField,
    {
      name: 'board',
      label: 'Board / curriculum',
      kind: 'text',
      optional: true,
      placeholder: 'e.g. CBSE',
    },
    descriptionField,
    sortField,
  ],
  columns: [
    { header: 'Board', cell: (row) => row.board ?? '—' },
    { header: 'Classes', cell: (row) => row.classCount, className: 'tabular-nums' },
    { header: 'Streams', cell: (row) => row.streamCount, className: 'tabular-nums' },
  ],
  toForm: (row) => ({
    name: row?.name ?? '',
    slug: row?.slug ?? '',
    board: row?.board ?? '',
    description: row?.description ?? '',
    sortOrder: String(row?.sortOrder ?? 0),
    isActive: row?.isActive ?? true,
  }),
  toPayload: (values) => ({
    name: text(values, 'name'),
    slug: text(values, 'slug'),
    board: text(values, 'board'),
    description: text(values, 'description'),
    sortOrder: optionalNumber(values.sortOrder) ?? 0,
    isActive: values.isActive === true,
  }),
  usage: (row) => countLabel(row.classCount + row.streamCount, 'class or stream'),
};

const classConfig: CatalogueConfig<ClassDto> = {
  title: 'Classes',
  singular: 'Class',
  description:
    'School grades such as “Class 10”. Subjects are linked to a class through its courses.',
  endpoint: '/admin/classes',
  usesLevels: true,
  createSchema: classCreateSchema,
  updateSchema: classUpdateSchema,
  fields: [
    { name: 'academicLevelId', label: 'Academic level', kind: 'level' },
    nameField,
    slugField,
    {
      name: 'gradeNumber',
      label: 'Grade number',
      kind: 'number',
      optional: true,
      hint: 'e.g. 10 — used for sorting and filtering.',
    },
    sortField,
  ],
  columns: [
    { header: 'Academic level', cell: (row) => row.academicLevel.name },
    { header: 'Grade', cell: (row) => row.gradeNumber ?? '—', className: 'tabular-nums' },
    { header: 'Courses', cell: (row) => row.courseCount, className: 'tabular-nums' },
  ],
  toForm: (row) => ({
    academicLevelId: row?.academicLevelId ?? '',
    name: row?.name ?? '',
    slug: row?.slug ?? '',
    gradeNumber:
      row?.gradeNumber === null || row?.gradeNumber === undefined ? '' : String(row.gradeNumber),
    sortOrder: String(row?.sortOrder ?? 0),
    isActive: row?.isActive ?? true,
  }),
  toPayload: (values) => ({
    academicLevelId: text(values, 'academicLevelId'),
    name: text(values, 'name'),
    slug: text(values, 'slug'),
    gradeNumber: optionalNumber(values.gradeNumber),
    sortOrder: optionalNumber(values.sortOrder) ?? 0,
    isActive: values.isActive === true,
  }),
  usage: (row) => countLabel(row.courseCount, 'course'),
};

const streamConfig: CatalogueConfig<StreamDto> = {
  title: 'Streams',
  singular: 'Stream',
  description:
    'Academic streams within a level, e.g. Science for Classes 11–12 (list pending client confirmation, A-02).',
  endpoint: '/admin/streams',
  usesLevels: true,
  createSchema: streamCreateSchema,
  updateSchema: streamUpdateSchema,
  fields: [
    { name: 'academicLevelId', label: 'Academic level', kind: 'level' },
    nameField,
    slugField,
    descriptionField,
    sortField,
  ],
  columns: [
    { header: 'Academic level', cell: (row) => row.academicLevel.name },
    { header: 'Courses', cell: (row) => row.courseCount, className: 'tabular-nums' },
  ],
  toForm: (row) => ({
    academicLevelId: row?.academicLevelId ?? '',
    name: row?.name ?? '',
    slug: row?.slug ?? '',
    description: row?.description ?? '',
    sortOrder: String(row?.sortOrder ?? 0),
    isActive: row?.isActive ?? true,
  }),
  toPayload: (values) => ({
    academicLevelId: text(values, 'academicLevelId'),
    name: text(values, 'name'),
    slug: text(values, 'slug'),
    description: text(values, 'description'),
    sortOrder: optionalNumber(values.sortOrder) ?? 0,
    isActive: values.isActive === true,
  }),
  usage: (row) => countLabel(row.courseCount, 'course'),
};

const subjectConfig: CatalogueConfig<SubjectDto> = {
  title: 'Subjects',
  singular: 'Subject',
  description: 'Reusable subjects such as Mathematics. A course places a subject in a class.',
  endpoint: '/admin/subjects',
  createSchema: subjectCreateSchema,
  updateSchema: subjectUpdateSchema,
  fields: [
    nameField,
    slugField,
    { name: 'code', label: 'Subject code', kind: 'text', optional: true, placeholder: 'e.g. 041' },
    descriptionField,
  ],
  columns: [
    { header: 'Code', cell: (row) => row.code ?? '—' },
    { header: 'Courses', cell: (row) => row.courseCount, className: 'tabular-nums' },
  ],
  toForm: (row) => ({
    name: row?.name ?? '',
    slug: row?.slug ?? '',
    code: row?.code ?? '',
    description: row?.description ?? '',
    isActive: row?.isActive ?? true,
  }),
  toPayload: (values) => ({
    name: text(values, 'name'),
    slug: text(values, 'slug'),
    code: text(values, 'code'),
    description: text(values, 'description'),
    isActive: values.isActive === true,
  }),
  usage: (row) => countLabel(row.courseCount, 'course'),
};

const categoryConfig: CatalogueConfig<CourseCategoryDto> = {
  title: 'Course categories',
  singular: 'Category',
  description: 'Groupings for the course catalogue, e.g. “School Education” or “Languages”.',
  endpoint: '/admin/course-categories',
  createSchema: courseCategoryCreateSchema,
  updateSchema: courseCategoryUpdateSchema,
  fields: [nameField, slugField, descriptionField, sortField],
  columns: [{ header: 'Courses', cell: (row) => row.courseCount, className: 'tabular-nums' }],
  toForm: (row) => ({
    name: row?.name ?? '',
    slug: row?.slug ?? '',
    description: row?.description ?? '',
    sortOrder: String(row?.sortOrder ?? 0),
    isActive: row?.isActive ?? true,
  }),
  toPayload: (values) => ({
    name: text(values, 'name'),
    slug: text(values, 'slug'),
    description: text(values, 'description'),
    sortOrder: optionalNumber(values.sortOrder) ?? 0,
    isActive: values.isActive === true,
  }),
  usage: (row) => countLabel(row.courseCount, 'course'),
};

export function AcademicLevelsManager() {
  return <CatalogueManager config={levelConfig} />;
}
export function ClassesManager() {
  return <CatalogueManager config={classConfig} />;
}
export function StreamsManager() {
  return <CatalogueManager config={streamConfig} />;
}
export function SubjectsManager() {
  return <CatalogueManager config={subjectConfig} />;
}
export function CourseCategoriesManager() {
  return <CatalogueManager config={categoryConfig} />;
}
