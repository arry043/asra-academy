import type { Metadata } from 'next';
import { RecruitmentOverview } from '@/components/admin/recruitment/recruitment-overview';

export const metadata: Metadata = {
  title: 'Recruitment & Careers — Admin | ASRA Academy',
  description: 'Manage recruitment, job vacancies, applications, and candidate interviews.',
};

export default function AdminRecruitmentPage() {
  return <RecruitmentOverview />;
}
