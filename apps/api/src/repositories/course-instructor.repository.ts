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
  };
}
