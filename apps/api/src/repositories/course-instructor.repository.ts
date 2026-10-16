import type { DbClient } from '../database/types.js';

export function createCourseInstructorRepository(db: DbClient) {
  return {
    /** True if the user's faculty profile is assigned to the course (CourseInstructor). */
    async isUserAssignedToCourse(userId: string, courseId: string): Promise<boolean> {
      const assignment = await db.courseInstructor.findFirst({
        where: { courseId, facultyProfile: { userId } },
        select: { courseId: true },
      });
      return assignment !== null;
    },

    /** Ids of every course the user's faculty profile is assigned to (any course status). */
    async assignedCourseIds(userId: string): Promise<string[]> {
      const rows = await db.courseInstructor.findMany({
        where: { facultyProfile: { userId } },
        select: { courseId: true },
      });
      return rows.map((row) => row.courseId);
    },
  };
}
