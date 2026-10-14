import { Section } from '@/components/layout/section';

import { Caption, ShowcaseBlock, Specimen, TokenCode } from '../_components/showcase';

/** Values mirror globals.css; contrast ratios are documented in docs/DESIGN-SYSTEM.md. */
const BRAND = [
  { name: 'ASRA Green', token: '--asra-green-700', hex: '#034729', note: 'Primary actions, links' },
  {
    name: 'Deep Green',
    token: '--asra-green-900',
    hex: '#012114',
    note: 'Logo green, headings, brand bands',
  },
  { name: 'ASRA Gold', token: '--asra-gold-500', hex: '#E4A735', note: 'Accent fills, highlights' },
  { name: 'Logo Gold', token: '--asra-gold-600', hex: '#C88717', note: 'Graphics only (2.9:1)' },
  {
    name: 'Gold Text',
    token: '--asra-gold-800',
    hex: '#8A5A0B',
    note: 'Gold-coloured text (5.7:1)',
  },
  { name: 'Ivory', token: '--asra-ivory', hex: '#FDFBF5', note: 'Page background' },
  {
    name: 'Warm White',
    token: '--asra-warm-white',
    hex: '#FFFEFB',
    note: 'Cards, inputs, popovers',
  },
  { name: 'Ivory Deep', token: '--asra-ivory-200', hex: '#F6F1E4', note: 'Sunken bands, footer' },
  { name: 'Dark Text', token: '--asra-ink', hex: '#13211A', note: 'Body text (16:1)' },
  {
    name: 'Muted Green',
    token: '--asra-sage',
    hex: '#6B8577',
    note: 'Icons, decoration (not text)',
  },
] as const;

const SEMANTIC = [
  { token: 'primary', fg: 'primary-foreground' },
  { token: 'secondary', fg: 'secondary-foreground' },
  { token: 'accent', fg: 'accent-foreground' },
  { token: 'muted', fg: 'muted-foreground' },
  { token: 'card', fg: 'card-foreground' },
  { token: 'success', fg: 'success-foreground' },
  { token: 'warning', fg: 'warning-foreground' },
  { token: 'info', fg: 'info-foreground' },
  { token: 'destructive', fg: 'destructive-foreground' },
] as const;

const TYPE_ROLES = [
  {
    role: 'Display',
    className: 'type-display',
    spec: 'Jakarta 700 · 34→60px fluid · lh 1.08',
    sample: 'Quality education for a brighter tomorrow',
  },
  {
    role: 'Heading 1',
    className: 'type-h1',
    spec: 'Jakarta 700 · 30→44px fluid · lh 1.15',
    sample: 'Our courses',
  },
  {
    role: 'Heading 2',
    className: 'type-h2',
    spec: 'Jakarta 700 · 24→34px fluid · lh 1.2',
    sample: 'Choose the right course',
  },
  {
    role: 'Heading 3',
    className: 'type-h3',
    spec: 'Jakarta 650 · 20px · lh 1.35',
    sample: 'Live classes this week',
  },
  {
    role: 'Heading 4',
    className: 'type-h4',
    spec: 'Jakarta 650 · 17px · lh 1.4',
    sample: 'Card title',
  },
  {
    role: 'Body large',
    className: 'type-body-lg',
    spec: 'Inter 400 · 18px · lh 1.65',
    sample: 'Lead paragraphs introduce a section in one or two sentences.',
  },
  {
    role: 'Body',
    className: 'type-body',
    spec: 'Inter 400 · 16px · lh 1.6',
    sample: 'Default reading text for descriptions, forms and content.',
  },
  {
    role: 'Body small',
    className: 'type-body-sm',
    spec: 'Inter 400 · 14px · lh 1.55',
    sample: 'Dense UI text: card descriptions, table cells.',
  },
  {
    role: 'Caption',
    className: 'type-caption',
    spec: 'Inter 400 · 13px · lh 1.45',
    sample: 'Updated 14 Oct 2026 · helper text and metadata',
  },
  {
    role: 'Label',
    className: 'type-label',
    spec: 'Inter 550 · 14px · lh 1.25',
    sample: 'Email address',
  },
  {
    role: 'Eyebrow',
    className: 'type-eyebrow text-asra-gold-800',
    spec: 'Inter 650 · 12px · +0.08em · uppercase',
    sample: 'Our courses',
  },
] as const;

export function BrandSection() {
  return (
    <Section
      id="brand"
      eyebrow="A · Foundations"
      title="Brand & tokens"
      description="Colours sampled from the official logo (official codes pending client confirmation, V-02), semantic tokens, type roles, spacing, radius and elevation."
    >
      <ShowcaseBlock
        title="Brand palette"
        description="Raw brand values. Components use the semantic tokens below, not these directly."
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BRAND.map((swatch) => (
            <li
              key={swatch.token}
              className="overflow-hidden rounded-xl border bg-card shadow-card"
            >
              <div className="h-16 border-b" style={{ backgroundColor: `var(${swatch.token})` }} />
              <div className="grid gap-0.5 p-3">
                <p className="type-label text-heading">{swatch.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{swatch.hex}</p>
                <p className="type-caption text-muted-foreground">{swatch.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="Semantic colour tokens"
        description="Each surface token has a paired foreground that meets WCAG AA."
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SEMANTIC.map(({ token, fg }) => (
            <li
              key={token}
              className="grid min-h-24 content-between gap-2 rounded-xl border p-3"
              style={{ backgroundColor: `var(--${token})`, color: `var(--${fg})` }}
            >
              <span className="type-label">{token}</span>
              <span className="font-mono text-xs opacity-90">on {fg}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          {(['success', 'warning', 'info', 'destructive'] as const).map((tone) => (
            <span
              key={tone}
              className="rounded-lg px-3 py-2 type-body-sm font-medium"
              style={{ backgroundColor: `var(--${tone}-soft)`, color: `var(--${tone})` }}
            >
              {tone} on {tone}-soft
            </span>
          ))}
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="Typography roles"
        description="Plus Jakarta Sans for display/headings, Inter for body and UI (pending brand fonts, V-03)."
      >
        <Specimen className="grid gap-5 p-0 sm:p-0">
          {TYPE_ROLES.map((item) => (
            <div
              key={item.role}
              className="grid gap-1 border-b px-4 pb-5 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6 sm:px-6 [&:first-child]:pt-5"
            >
              <div>
                <p className="type-label text-heading">{item.role}</p>
                <Caption>
                  <TokenCode>{item.className.split(' ')[0]}</TokenCode>
                </Caption>
                <Caption>{item.spec}</Caption>
              </div>
              <p className={`${item.className} min-w-0 break-words text-heading`}>{item.sample}</p>
            </div>
          ))}
        </Specimen>
      </ShowcaseBlock>

      <div className="grid gap-8 lg:grid-cols-3">
        <ShowcaseBlock title="Radius">
          <Specimen className="flex flex-wrap items-end gap-4">
            {[
              ['rounded-sm', '8px'],
              ['rounded-md', '10px'],
              ['rounded-lg', '12px'],
              ['rounded-xl', '16px'],
              ['rounded-full', 'pill'],
            ].map(([cls, px]) => (
              <div key={cls} className="grid justify-items-center gap-1">
                <div className={`size-14 border-2 border-primary/40 bg-secondary ${cls}`} />
                <Caption>{px}</Caption>
              </div>
            ))}
          </Specimen>
        </ShowcaseBlock>
        <ShowcaseBlock title="Elevation">
          <Specimen className="grid grid-cols-3 gap-4 bg-background">
            {['shadow-card', 'shadow-raised', 'shadow-overlay'].map((cls) => (
              <div key={cls} className="grid justify-items-center gap-2">
                <div className={`h-14 w-full rounded-lg bg-card ${cls}`} />
                <Caption>{cls.replace('shadow-', '')}</Caption>
              </div>
            ))}
          </Specimen>
        </ShowcaseBlock>
        <ShowcaseBlock title="Control heights & spacing">
          <Specimen className="grid gap-3">
            {[
              ['h-control-sm', '36px · dense UI'],
              ['h-control', '44px · default (touch)'],
              ['h-control-lg', '48px · hero CTAs'],
            ].map(([cls, label]) => (
              <div key={cls} className="flex items-center gap-3">
                <div className={`w-10 shrink-0 rounded-md bg-asra-gold-200 ${cls}`} />
                <Caption>
                  <TokenCode>{cls}</TokenCode> {label}
                </Caption>
              </div>
            ))}
            <Caption>
              <TokenCode>px-gutter</TokenCode> 16→32px · <TokenCode>py-section</TokenCode> 56→96px
            </Caption>
          </Specimen>
        </ShowcaseBlock>
      </div>
    </Section>
  );
}
