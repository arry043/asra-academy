/**
 * Legal pages (REQ-PUB-013…015).
 *
 * STATUS: PENDING CLIENT-APPROVED TEXT (CLIENT-CLARIFICATIONS U-01, U-02, N-01). No legally
 * reviewed text has been supplied, so these pages publish only an outline of the topics each
 * policy will cover. They deliberately contain NO commitments: no refund periods, retention
 * periods, payment terms, jurisdiction, grievance officer or contact process. Replace `sections`
 * with the approved text and set `status` to "approved" (with the effective date) when supplied.
 */

export interface LegalSection {
  heading: string;
  /** Neutral description of what the approved policy will address. */
  covers: string;
}

export interface LegalDocument {
  slug: 'privacy-policy' | 'terms' | 'refund-policy';
  path: string;
  title: string;
  seoDescription: string;
  status: 'pending-approval' | 'approved';
  /** ISO date the approved text takes effect (approved documents only). */
  effectiveDate?: string;
  summary: string;
  sections: LegalSection[];
}

export const legalDocuments: Record<LegalDocument['slug'], LegalDocument> = {
  'privacy-policy': {
    slug: 'privacy-policy',
    path: '/privacy-policy',
    title: 'Privacy Policy',
    seoDescription:
      'How ASRA Academy will handle personal information of students, parents and visitors. The full policy is being finalised.',
    status: 'pending-approval',
    summary:
      'This page will explain how ASRA Academy collects, uses and protects personal information, including information about students under 18.',
    sections: [
      {
        heading: 'Information collected',
        covers: 'The personal information the academy collects and the purposes it is used for.',
      },
      {
        heading: 'Students under 18',
        covers:
          'How information about minors is handled, including the role of parents and guardians.',
      },
      {
        heading: 'Sharing and service providers',
        covers:
          'Whether and when information is shared with service providers that help run the platform.',
      },
      {
        heading: 'Storage, security and retention',
        covers: 'How information is protected and how long it is kept.',
      },
      {
        heading: 'Your rights and choices',
        covers: 'How to access, correct or request deletion of personal information.',
      },
      {
        heading: 'Contact',
        covers: 'Who to contact with privacy questions or concerns.',
      },
    ],
  },
  terms: {
    slug: 'terms',
    path: '/terms',
    title: 'Terms and Conditions',
    seoDescription:
      'The terms for using the ASRA Academy website and learning platform. The full terms are being finalised.',
    status: 'pending-approval',
    summary:
      'This page will set out the terms for using the ASRA Academy website, student accounts and learning platform.',
    sections: [
      {
        heading: 'Using the website and platform',
        covers: 'Who may use the platform and the rules for acceptable use.',
      },
      {
        heading: 'Accounts',
        covers: 'Registration, account security and the responsibilities of account holders.',
      },
      {
        heading: 'Courses and enrolment',
        covers: 'How enrolment in classes and courses works.',
      },
      {
        heading: 'Learning content',
        covers: 'Ownership of lectures, notes and other materials, and how they may be used.',
      },
      {
        heading: 'Payments',
        covers: 'Terms that apply if paid courses are offered.',
      },
      {
        heading: 'Changes and contact',
        covers: 'How the terms may be updated and how to raise a question.',
      },
    ],
  },
  'refund-policy': {
    slug: 'refund-policy',
    path: '/refund-policy',
    title: 'Refund Policy',
    seoDescription:
      'How refunds for ASRA Academy courses will be handled. The full policy is being finalised.',
    status: 'pending-approval',
    summary: 'This page will explain whether and how refunds are available for paid courses.',
    sections: [
      {
        heading: 'Eligibility',
        covers: 'Which payments may be eligible for a refund.',
      },
      {
        heading: 'Requesting a refund',
        covers: 'How to request a refund and what information is needed.',
      },
      {
        heading: 'Processing',
        covers: 'How approved refunds are processed.',
      },
      {
        heading: 'Course access',
        covers: 'What happens to course access after a refund.',
      },
    ],
  },
};
