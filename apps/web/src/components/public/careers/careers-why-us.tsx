import { Award, Compass, HeartHandshake, Sparkles, TrendingUp, Users } from 'lucide-react';
import * as React from 'react';

import { Container } from '@/components/layout/container';

const benefits = [
  {
    icon: Sparkles,
    title: 'Mission-Driven Impact',
    description:
      'Contribute to a transformative educational model that synthesizes academic rigor with ethical and spiritual consciousness.',
  },
  {
    icon: Users,
    title: 'Collaborative Excellence',
    description:
      'Work alongside dedicated educators, scholars, and professionals who value intellectual curiosity and mutual respect.',
  },
  {
    icon: TrendingUp,
    title: 'Professional Growth',
    description:
      'Access faculty development workshops, research support, leadership training, and clear pathways for career advancement.',
  },
  {
    icon: HeartHandshake,
    title: 'Comprehensive Well-being',
    description:
      'We support our staff with competitive compensation, balanced workloads, supportive leave policies, and a culture of care.',
  },
  {
    icon: Award,
    title: 'Modern Infrastructure',
    description:
      'State-of-the-art digital tools, smart classrooms, and continuous technological investments empowering modern pedagogy.',
  },
  {
    icon: Compass,
    title: 'Ethical Leadership',
    description:
      'Transparent governance, academic integrity, and an environment where every voice is heard and valued.',
  },
];

export function CareersWhyUs() {
  return (
    <section className="border-b bg-asra-warm-white py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 type-eyebrow text-xs font-semibold tracking-wider text-asra-gold-600 uppercase">
            Why ASRA Academy
          </p>
          <h2 className="type-title-lg font-bold text-foreground sm:text-3xl">
            A Place Where Purpose Meets Professional Growth
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            At ASRA Academy, we believe our educators and staff are the foundation of student
            success. We cultivate an environment that fosters intellectual excellence, moral
            character, and lifelong learning.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="rounded-xl border bg-card p-6 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <div className="dark:bg-asra-gold-950 dark:text-asra-gold-300 mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-asra-gold-50 text-asra-gold-700">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
