import type { DbClient } from '../../database/types.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Data access for the academic structure: academic levels, classes, streams and subjects.
 * Catalogue rows are retired with `isActive = false`; hard deletes are only for unused rows
 * (the service checks references first; FK RESTRICT is the backstop).
 */

const levelRef = { select: { id: true, name: true, slug: true, isActive: true } } as const;

export const levelInclude = {
  _count: { select: { classes: true, streams: true } },
} satisfies Prisma.AcademicLevelInclude;

export const classInclude = {
  academicLevel: levelRef,
  _count: { select: { courses: true, students: true } },
} satisfies Prisma.ClassInclude;

export const streamInclude = {
  academicLevel: levelRef,
  _count: { select: { courses: true, students: true } },
} satisfies Prisma.StreamInclude;

export const subjectInclude = {
  _count: { select: { courses: true } },
} satisfies Prisma.SubjectInclude;

export type LevelRow = Prisma.AcademicLevelGetPayload<{ include: typeof levelInclude }>;
export type ClassRow = Prisma.ClassGetPayload<{ include: typeof classInclude }>;
export type StreamRow = Prisma.StreamGetPayload<{ include: typeof streamInclude }>;
export type SubjectRow = Prisma.SubjectGetPayload<{ include: typeof subjectInclude }>;

/** Case-insensitive exact match, so "class 10" and "Class 10" count as duplicates. */
const sameText = (value: string) => ({ equals: value, mode: 'insensitive' as const });
const notId = (id?: string) => (id ? { NOT: { id } } : {});

export function createAcademicsRepository(db: DbClient) {
  return {
    levels: {
      list(where: Prisma.AcademicLevelWhereInput, skip: number, take: number) {
        return db.academicLevel.findMany({
          where,
          include: levelInclude,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          skip,
          take,
        });
      },
      count: (where: Prisma.AcademicLevelWhereInput) => db.academicLevel.count({ where }),
      findById: (id: string) =>
        db.academicLevel.findUnique({ where: { id }, include: levelInclude }),
      async slugTaken(slug: string, excludeId?: string) {
        return (await db.academicLevel.count({ where: { slug, ...notId(excludeId) } })) > 0;
      },
      async nameTaken(name: string, excludeId?: string) {
        return (
          (await db.academicLevel.count({ where: { name: sameText(name), ...notId(excludeId) } })) >
          0
        );
      },
      create: (data: Prisma.AcademicLevelUncheckedCreateInput) =>
        db.academicLevel.create({ data, include: levelInclude }),
      update: (id: string, data: Prisma.AcademicLevelUncheckedUpdateInput) =>
        db.academicLevel.update({ where: { id }, data, include: levelInclude }),
      delete: (id: string) => db.academicLevel.delete({ where: { id } }),
    },

    classes: {
      list(where: Prisma.ClassWhereInput, skip: number, take: number) {
        return db.class.findMany({
          where,
          include: classInclude,
          orderBy: [{ sortOrder: 'asc' }, { gradeNumber: 'asc' }, { name: 'asc' }],
          skip,
          take,
        });
      },
      count: (where: Prisma.ClassWhereInput) => db.class.count({ where }),
      findById: (id: string) => db.class.findUnique({ where: { id }, include: classInclude }),
      async slugTaken(slug: string, excludeId?: string) {
        return (await db.class.count({ where: { slug, ...notId(excludeId) } })) > 0;
      },
      async nameTaken(academicLevelId: string, name: string, excludeId?: string) {
        const where = { academicLevelId, name: sameText(name), ...notId(excludeId) };
        return (await db.class.count({ where })) > 0;
      },
      create: (data: Prisma.ClassUncheckedCreateInput) =>
        db.class.create({ data, include: classInclude }),
      update: (id: string, data: Prisma.ClassUncheckedUpdateInput) =>
        db.class.update({ where: { id }, data, include: classInclude }),
      delete: (id: string) => db.class.delete({ where: { id } }),
    },

    streams: {
      list(where: Prisma.StreamWhereInput, skip: number, take: number) {
        return db.stream.findMany({
          where,
          include: streamInclude,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          skip,
          take,
        });
      },
      count: (where: Prisma.StreamWhereInput) => db.stream.count({ where }),
      findById: (id: string) => db.stream.findUnique({ where: { id }, include: streamInclude }),
      async slugTaken(slug: string, excludeId?: string) {
        return (await db.stream.count({ where: { slug, ...notId(excludeId) } })) > 0;
      },
      async nameTaken(academicLevelId: string, name: string, excludeId?: string) {
        const where = { academicLevelId, name: sameText(name), ...notId(excludeId) };
        return (await db.stream.count({ where })) > 0;
      },
      create: (data: Prisma.StreamUncheckedCreateInput) =>
        db.stream.create({ data, include: streamInclude }),
      update: (id: string, data: Prisma.StreamUncheckedUpdateInput) =>
        db.stream.update({ where: { id }, data, include: streamInclude }),
      delete: (id: string) => db.stream.delete({ where: { id } }),
    },

    subjects: {
      list(where: Prisma.SubjectWhereInput, skip: number, take: number) {
        return db.subject.findMany({
          where,
          include: subjectInclude,
          orderBy: [{ name: 'asc' }],
          skip,
          take,
        });
      },
      count: (where: Prisma.SubjectWhereInput) => db.subject.count({ where }),
      findById: (id: string) => db.subject.findUnique({ where: { id }, include: subjectInclude }),
      async slugTaken(slug: string, excludeId?: string) {
        return (await db.subject.count({ where: { slug, ...notId(excludeId) } })) > 0;
      },
      async nameTaken(name: string, excludeId?: string) {
        return (
          (await db.subject.count({ where: { name: sameText(name), ...notId(excludeId) } })) > 0
        );
      },
      async codeTaken(code: string, excludeId?: string) {
        return (await db.subject.count({ where: { code, ...notId(excludeId) } })) > 0;
      },
      create: (data: Prisma.SubjectUncheckedCreateInput) =>
        db.subject.create({ data, include: subjectInclude }),
      update: (id: string, data: Prisma.SubjectUncheckedUpdateInput) =>
        db.subject.update({ where: { id }, data, include: subjectInclude }),
      delete: (id: string) => db.subject.delete({ where: { id } }),
    },

    /** Published courses that reference a catalogue row (blocks deactivation). */
    countPublishedCourses(where: Prisma.CourseWhereInput) {
      return db.course.count({ where: { ...where, status: 'PUBLISHED' } });
    },
  };
}
