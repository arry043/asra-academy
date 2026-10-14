import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Section } from '@/components/layout/section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Caption, ShowcaseBlock, Specimen, TokenCode } from '../_components/showcase';
import { EntranceDemo, PageTransitionDemo, ProgressMotionDemo } from '../_demos/motion-demo';

const TOKENS = [
  ['Fast', 'duration-150', 'Hover, focus, colour changes'],
  ['Base', 'duration-200', 'Fade, scale, overlays opening'],
  ['Slow', 'duration-300', 'Slide / drawer, entrance (fade-up)'],
  ['Standard ease', 'ease-standard', 'cubic-bezier(0.2, 0, 0, 1) — default'],
  ['Emphasized ease', 'ease-emphasized', 'Slight overshoot — use rarely'],
] as const;

export function MotionSection() {
  return (
    <Section
      id="motion"
      eyebrow="E · Motion"
      title="Motion"
      description="Short, subtle, transform/opacity only. With “reduce motion” enabled, everything resolves instantly and nothing moves."
    >
      <ShowcaseBlock title="Motion tokens">
        <Table scrollLabel="Motion tokens" className="min-w-[30rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Use</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TOKENS.map(([name, cls, use]) => (
              <TableRow key={cls}>
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell>
                  <TokenCode>{cls}</TokenCode>
                </TableCell>
                <TableCell className="text-muted-foreground">{use}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ShowcaseBlock>

      <ShowcaseBlock title="Fade · Slide · Scale">
        <EntranceDemo />
      </ShowcaseBlock>

      <div className="grid gap-8 lg:grid-cols-2">
        <ShowcaseBlock
          title="Hover"
          description="Interactive cards lift 2px and gain elevation; the lift is skipped with reduced motion."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Card interactive>
              <CardHeader>
                <CardTitle as="h4">Hover me</CardTitle>
                <CardDescription>
                  <TokenCode>interactive</TokenCode> card variant
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle as="h4">Static card</CardTitle>
                <CardDescription>No hover response</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </ShowcaseBlock>
        <ShowcaseBlock
          title="Progress"
          description="Width transitions over 500ms; the value text updates immediately."
        >
          <Specimen>
            <ProgressMotionDemo />
          </Specimen>
        </ShowcaseBlock>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <ShowcaseBlock
          title="Page transition"
          description="CSS-only; used by the dashboard previews' template.tsx."
        >
          <PageTransitionDemo />
        </ShowcaseBlock>
        <ShowcaseBlock
          title="Reveal on scroll"
          description="CSS scroll-driven animation. Content stays visible where unsupported or without JavaScript."
        >
          <div className="grid gap-3">
            {['First item', 'Second item', 'Third item'].map((label) => (
              <div key={label} className="reveal rounded-xl border bg-card p-4 shadow-card">
                <p className="type-label text-heading">{label}</p>
                <Caption>
                  <TokenCode>reveal</TokenCode> utility
                </Caption>
              </div>
            ))}
          </div>
        </ShowcaseBlock>
      </div>
    </Section>
  );
}
