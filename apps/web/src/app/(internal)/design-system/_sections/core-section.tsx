import { ArrowRight, Bell, CheckCircle2, Download, Plus, Trash2 } from 'lucide-react';

import { CourseCardSkeleton } from '@/components/asra/courses/course-card';
import { Section } from '@/components/layout/section';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { LoadingRegion, Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Caption, ShowcaseBlock, Specimen, TokenCode } from '../_components/showcase';
import { PaginationDemo, TableDemo } from '../_demos/data-demo';
import { ToastDemo, TooltipDemo } from '../_demos/feedback-demo';
import { FormDemo } from '../_demos/form-demo';
import { OverlayDemo } from '../_demos/overlay-demo';

const VARIANTS = [
  'default',
  'accent',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'link',
] as const;

export function CoreSection({ linkPage }: { linkPage: number }) {
  return (
    <Section
      id="components"
      tone="muted"
      eyebrow="B · Core components"
      title="Core components"
      description="shadcn/ui-style primitives on Radix, styled with ASRA tokens. Every interactive example below is live."
    >
      <ShowcaseBlock
        title="Button"
        description="One primary action per area. Loading disables the button and sets aria-busy to prevent double submission."
      >
        <Specimen className="grid gap-5">
          <div className="flex flex-wrap items-center gap-3">
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant === 'default' ? 'Primary' : variant[0]!.toUpperCase() + variant.slice(1)}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">
              Explore courses <ArrowRight aria-hidden />
            </Button>
            <Button size="icon" variant="outline" aria-label="Add item">
              <Plus aria-hidden />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Delete item">
              <Trash2 aria-hidden />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled>Disabled</Button>
            <Button loading>Saving</Button>
            <Button variant="outline" loading loadingText="Downloading…">
              <Download aria-hidden /> Download
            </Button>
          </div>
          <Caption>
            Sizes map to <TokenCode>h-control-sm</TokenCode> 36px · <TokenCode>h-control</TokenCode>{' '}
            44px · <TokenCode>h-control-lg</TokenCode> 48px. Icon-only buttons require{' '}
            <TokenCode>aria-label</TokenCode>.
          </Caption>
        </Specimen>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="Input, Select & Field"
        description="Submit empty to see error states. Errors use text + icon, are linked with aria-describedby and set aria-invalid."
      >
        <Specimen>
          <FormDemo />
        </Specimen>
      </ShowcaseBlock>

      <div className="grid gap-8 lg:grid-cols-2">
        <ShowcaseBlock title="Card">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle as="h4">Default card</CardTitle>
                <CardDescription>
                  Header, description, content, footer and an action slot.
                </CardDescription>
                <CardAction>
                  <Badge variant="success">
                    <CheckCircle2 aria-hidden /> Active
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="type-body-sm">Card content uses the body-small role.</p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Primary</Button>
                <Button size="sm" variant="ghost">
                  Secondary
                </Button>
              </CardFooter>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card variant="muted">
                <CardHeader>
                  <CardTitle as="h4">Muted</CardTitle>
                  <CardDescription>Grouping without competing.</CardDescription>
                </CardHeader>
              </Card>
              <Card variant="brand">
                <CardHeader>
                  <CardTitle as="h4" className="text-asra-ivory">
                    Brand
                  </CardTitle>
                  <CardDescription>One highlight per view.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </ShowcaseBlock>

        <ShowcaseBlock
          title="Badge & Alert"
          description="Badges are concise statuses with a word (and often an icon), never colour alone."
        >
          <Specimen className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="accent">Accent</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
            <Alert tone="info" title="Information">
              <p>Polite status message (role=&quot;status&quot;).</p>
            </Alert>
            <Alert tone="success">Saved successfully.</Alert>
            <Alert tone="warning">Your session will expire soon.</Alert>
            <Alert tone="error" title="Something went wrong">
              <p>Errors use role=&quot;alert&quot; and are announced immediately.</p>
            </Alert>
          </Specimen>
        </ShowcaseBlock>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <ShowcaseBlock
          title="Modal & Drawer"
          description="Focus is trapped; Escape closes; focus returns to the trigger."
        >
          <Specimen>
            <OverlayDemo />
          </Specimen>
        </ShowcaseBlock>
        <ShowcaseBlock
          title="Toast & Tooltip"
          description="Toasts pause on hover/focus and are reachable with F8. Tooltips open on focus too."
        >
          <Specimen className="grid gap-5">
            <ToastDemo />
            <TooltipDemo />
          </Specimen>
        </ShowcaseBlock>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <ShowcaseBlock
          title="Tabs"
          description="Arrow keys move between tabs. Long lists scroll horizontally."
        >
          <Specimen>
            <Tabs defaultValue="overview">
              <TabsList aria-label="Course sections (demo)">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
                <TabsTrigger value="materials">Study material</TabsTrigger>
                <TabsTrigger value="schedule">Live class schedule</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="type-body-sm text-muted-foreground">
                Overview panel. Tab panels are focusable so keyboard users land on the content.
              </TabsContent>
              <TabsContent value="curriculum" className="type-body-sm text-muted-foreground">
                Curriculum panel (demo).
              </TabsContent>
              <TabsContent value="materials" className="type-body-sm text-muted-foreground">
                Study material panel (demo).
              </TabsContent>
              <TabsContent value="schedule" className="type-body-sm text-muted-foreground">
                Schedule panel (demo).
              </TabsContent>
            </Tabs>
          </Specimen>
        </ShowcaseBlock>
        <ShowcaseBlock
          title="Accordion"
          description="Enter/Space toggle; headings wrap long questions without overflow."
        >
          <Specimen className="py-2 sm:py-2">
            <Accordion type="single" collapsible defaultValue="q1">
              <AccordionItem value="q1">
                <AccordionTrigger>Which classes does ASRA Academy teach?</AccordionTrigger>
                <AccordionContent>
                  Classes 6–12 (CBSE pattern) and special courses.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>
                  A deliberately long question that wraps across several lines on a narrow phone
                  screen to prove the trigger never overflows its container?
                </AccordionTrigger>
                <AccordionContent>Answer content (demo).</AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger>How are live classes joined?</AccordionTrigger>
                <AccordionContent>Provider pending (F-01). Placeholder answer.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </Specimen>
        </ShowcaseBlock>
      </div>

      <ShowcaseBlock
        title="Table"
        description="Semantic table with a labelled, keyboard-scrollable container on narrow screens, plus an empty state."
      >
        <TableDemo />
      </ShowcaseBlock>

      <ShowcaseBlock
        id="pagination"
        title="Pagination"
        description="Callback mode (client state) and link mode (?page=, crawlable). Boundaries are disabled; phones show “Page x of y”."
      >
        <Specimen className="grid gap-6">
          <PaginationDemo />
          <div className="grid gap-3 border-t pt-5">
            <p className="type-body-sm text-muted-foreground">
              Link mode — current page from the URL:{' '}
              <strong className="text-foreground">{linkPage}</strong>
            </p>
            <Pagination
              page={linkPage}
              pageCount={5}
              getHref={(page) => `/design-system?page=${page}#pagination`}
              label="Link pagination demo"
            />
          </div>
        </Specimen>
      </ShowcaseBlock>

      <div className="grid gap-8 lg:grid-cols-3">
        <ShowcaseBlock
          title="Avatar"
          description="Image → initials fallback; failed images fall back too."
        >
          <Specimen className="flex flex-wrap items-center gap-4">
            <Avatar name="ASRA Academy" src="/brand/icon-192.png" size="lg" status="online" />
            <Avatar name="Demo Student" size="lg" status="away" />
            <Avatar name="Broken Image" src="/does-not-exist.png" size="lg" status="offline" />
            <Avatar name="" size="default" />
            <Avatar name="Small" size="sm" />
          </Specimen>
        </ShowcaseBlock>
        <ShowcaseBlock
          title="Progress"
          description="Clamped to 0…max; text always shows the value."
        >
          <Specimen className="grid gap-4">
            <Progress value={0} label="Not started" showValue />
            <Progress value={45} label="In progress" showValue />
            <Progress value={100} label="Complete" showValue />
            <Progress value={150} label="150 → clamped" showValue />
            <Progress value={null} label="Missing value" showValue />
          </Specimen>
        </ShowcaseBlock>
        <ShowcaseBlock
          title="Skeleton"
          description="Matches the geometry of the content it replaces; announced once."
        >
          <LoadingRegion label="Loading demo content…" className="grid gap-4">
            <Specimen className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <SkeletonText lines={2} className="flex-1" />
            </Specimen>
            <CourseCardSkeleton />
          </LoadingRegion>
        </ShowcaseBlock>
      </div>

      <Caption>
        <Bell className="mr-1 inline size-3.5" aria-hidden />
        All examples use demo data and call no API.
      </Caption>
    </Section>
  );
}
