import { AssignmentCard } from '@/components/asra/assignments/assignment-card';
import { CourseCategoryCard } from '@/components/asra/categories/course-category-card';
import { CourseCard } from '@/components/asra/courses/course-card';
import { ExamCard } from '@/components/asra/exams/exam-card';
import { FacultyCard } from '@/components/asra/faculty/faculty-card';
import { FeatureCard } from '@/components/asra/features/feature-card';
import { LiveClassCard } from '@/components/asra/live-classes/live-class-card';
import { ProgressCard } from '@/components/asra/progress/progress-card';
import { TestimonialCard } from '@/components/asra/testimonials/testimonial-card';
import { Section } from '@/components/layout/section';

import { ShowcaseBlock } from '../_components/showcase';
import {
  demoAssignments,
  demoCategories,
  demoCourses,
  demoExams,
  demoFaculty,
  demoFeatures,
  demoLiveClasses,
  demoProgress,
  demoTestimonials,
} from '../_fixtures';

const grid3 = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';

export function EducationSection() {
  return (
    <Section
      id="education"
      eyebrow="C · Education components"
      title="ASRA education components"
      description="Typed, presentational cards built from the core primitives. Each set includes a case with missing or invalid data."
    >
      <ShowcaseBlock
        id="courses"
        title="CourseCard"
        description="With image · without image (fallback) · draft status with a long title and no action."
      >
        <div className={grid3}>
          {demoCourses.map((course, index) => (
            <CourseCard key={course.title} {...course} headingLevel="h4" priority={index === 0} />
          ))}
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        id="categories"
        title="CourseCategoryCard"
        description="Pastel tones from the visual reference. Counts are hidden unless real data is supplied. Arabic and Urdu render right-to-left."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {demoCategories.map((category) => (
            <CourseCategoryCard key={category.name} {...category} headingLevel="h4" />
          ))}
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock title="FeatureCard">
        <div className={grid3}>
          {demoFeatures.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              {...feature}
              headingLevel="h4"
              align={index === 1 ? 'center' : 'start'}
            />
          ))}
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        id="faculty"
        title="FacultyCard"
        description="Full profile · subjects only · broken photo URL falling back to initials."
      >
        <div className={grid3}>
          {demoFaculty.map((member) => (
            <FacultyCard key={member.name} {...member} headingLevel="h4" />
          ))}
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="TestimonialCard"
        description="Demo only — real testimonials require consent (U-04)."
      >
        <div className={grid3}>
          {demoTestimonials.map((item) => (
            <TestimonialCard key={item.authorName} {...item} />
          ))}
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="LiveClassCard"
        description="Join appears only when live AND a safe http(s) link exists (third card: live, no link → no button)."
      >
        <div className={grid3}>
          {demoLiveClasses.map((session) => (
            <LiveClassCard key={session.title} {...session} headingLevel="h4" />
          ))}
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock id="assignments" title="AssignmentCard">
        <div className={grid3}>
          {demoAssignments.map((assignment) => (
            <AssignmentCard key={assignment.title} {...assignment} headingLevel="h4" />
          ))}
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        id="exams"
        title="ExamCard"
        description="An invalid date is omitted rather than shown as “Invalid Date”."
      >
        <div className={grid3}>
          {demoExams.map((exam) => (
            <ExamCard key={exam.title} {...exam} headingLevel="h4" />
          ))}
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="ProgressCard"
        description="Partial · complete · missing data · out-of-range value clamped."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {demoProgress.map((item) => (
            <ProgressCard key={item.title} {...item} headingLevel="h4" />
          ))}
        </div>
      </ShowcaseBlock>
    </Section>
  );
}
