import type { Testimonial } from '@/types/education';

/**
 * Approved testimonials only. Many ASRA students are minors, so a quote, name or photo may be
 * published only with the consent of the student and their guardian (CLIENT-CLARIFICATIONS U-04).
 * None have been supplied yet, so the homepage shows a neutral statement instead (X-03).
 */
export const approvedTestimonials: Testimonial[] = [];
