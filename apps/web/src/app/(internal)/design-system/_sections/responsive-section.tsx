import { Section } from '@/components/layout/section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Caption, ShowcaseBlock } from '../_components/showcase';
import { TableDemo } from '../_demos/data-demo';

const TARGETS = [
  [
    'Mobile',
    '375 × 812',
    'base (< 640px)',
    'Single column, drawers, “Page x of y”, 44px touch targets',
  ],
  [
    'Tablet',
    '768 × 1024',
    'md (≥ 768px)',
    '2-column grids, nav still in drawer, sidebar in drawer',
  ],
  ['Desktop', '1440 × 900', 'lg (≥ 1024px)', 'Inline nav, sidebar rail, 3-column grids'],
  ['Large desktop', '1920 × 1080', 'max-w-page', 'Content capped at 1216px and centred'],
] as const;

const FRAMES = [
  {
    title: 'Dashboard preview at 375px (mobile)',
    src: '/design-system/dashboard-preview',
    width: 375,
  },
  { title: 'Admin preview at 768px (tablet)', src: '/design-system/admin-preview', width: 768 },
] as const;

export function ResponsiveSection() {
  return (
    <Section
      id="responsive"
      tone="muted"
      eyebrow="F · Responsive"
      title="Responsive behaviour"
      description="Layouts change at breakpoints (they never just shrink). Verified at the four viewport targets below."
    >
      <ShowcaseBlock title="Viewport targets">
        <Table scrollLabel="Viewport targets" className="min-w-[40rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Test viewport</TableHead>
              <TableHead>Tailwind breakpoint</TableHead>
              <TableHead>Behaviour</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TARGETS.map(([name, size, bp, behaviour]) => (
              <TableRow key={name}>
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell className="tabular-nums">{size}</TableCell>
                <TableCell>{bp}</TableCell>
                <TableCell className="text-muted-foreground">{behaviour}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="Layouts at fixed widths"
        description="Live iframes of the layout previews. Use the menu button inside to open the mobile drawer."
      >
        <div
          className="flex gap-6 overflow-x-auto pb-3"
          role="region"
          aria-label="Responsive layout previews"
          tabIndex={0}
        >
          {FRAMES.map((frame) => (
            <figure key={frame.src} className="grid shrink-0 gap-2">
              <iframe
                src={frame.src}
                title={frame.title}
                width={frame.width}
                height={640}
                loading="lazy"
                className="rounded-xl border bg-background shadow-raised"
              />
              <figcaption>
                <Caption>{frame.title}</Caption>
              </figcaption>
            </figure>
          ))}
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="Table on a narrow viewport"
        description="A 320px-wide container: the table scrolls horizontally inside its labelled region; the page does not."
      >
        <TableDemo narrow />
      </ShowcaseBlock>
    </Section>
  );
}
