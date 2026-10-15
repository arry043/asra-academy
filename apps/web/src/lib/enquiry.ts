import { ENQUIRY_TOPICS, type EnquiryInput, type EnquiryTopic } from '@asra/validation';

import { programmes } from '@/content/programmes';

/** Human labels for the enquiry topics, in form order. Programme labels come from the catalogue. */
export const ENQUIRY_TOPIC_LABELS: Record<EnquiryTopic, string> = Object.fromEntries(
  ENQUIRY_TOPICS.map((topic) => {
    if (topic === 'admission') return [topic, 'Admission and enrolment'];
    if (topic === 'general') return [topic, 'General question'];
    return [topic, programmes.find((programme) => programme.slug === topic)?.title ?? topic];
  }),
) as Record<EnquiryTopic, string>;

export function isEnquiryTopic(value: unknown): value is EnquiryTopic {
  return typeof value === 'string' && (ENQUIRY_TOPICS as readonly string[]).includes(value);
}

/**
 * How an enquiry reaches the academy.
 *
 * There is NO enquiry API yet (no `POST /api/v1/enquiries`), so the website cannot deliver or
 * store a message by itself. Until that endpoint exists, the validated form hands the message to
 * the visitor's own email app, addressed to the client-confirmed academy email (CLIENT-
 * CLARIFICATIONS V-08/Q-03). The visitor sends it themselves; the website never claims delivery.
 */
export function buildEnquiryMailto(enquiry: EnquiryInput, recipient: string): string {
  const topic = ENQUIRY_TOPIC_LABELS[enquiry.topic];
  const lines = [
    enquiry.message,
    '',
    '—',
    `Name: ${enquiry.fullName}`,
    `Email: ${enquiry.email}`,
    enquiry.phone ? `Phone: ${enquiry.phone}` : null,
    `Topic: ${topic}`,
  ].filter((line): line is string => line !== null);

  // encodeURIComponent (not URLSearchParams) so spaces become %20, which every mail client reads.
  const subject = encodeURIComponent(`Website enquiry: ${topic}`);
  const body = encodeURIComponent(lines.join('\r\n'));
  return `mailto:${recipient}?subject=${subject}&body=${body}`;
}
