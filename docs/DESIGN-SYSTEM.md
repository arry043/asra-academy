# ASRA Academy — Design System

Version 0.4.0 · PHASE 04 — Design System & Frontend Foundation · Marvel's Techworks

This document describes the design system for the ASRA Academy web app (`apps/web`): tokens, typography, components, layouts, motion, responsive rules and accessibility conventions. The live, interactive reference is the internal showcase at **`/design-system`** (§11).

**Sources of truth**

| What                          | Where                                            |
| ----------------------------- | ------------------------------------------------ |
| Tokens (colour, type, motion) | `apps/web/src/app/globals.css`                   |
| Core primitives               | `apps/web/src/components/ui/`                    |
| Education components          | `apps/web/src/components/asra/`                  |
| Layouts                       | `apps/web/src/components/layout/`                |
| View-model types              | `apps/web/src/types/education.ts`                |
| Navigation config             | `apps/web/src/config/navigation.ts`              |
| Brand assets and logo rules   | [brand/README.md](./brand/README.md)             |
| Visual direction              | Client visual reference (homepage mock-up, V-06) |

**Status of the brand inputs.** The palette is sampled from the official logo PNG. The visual reference (desktop/mobile homepage mock-up) was used for direction: green-and-gold on ivory, pill CTAs, rounded white cards, pastel course tiles. Official colour codes (V-02), brand fonts (V-03), a vector or horizontal logo and a reversed logo (V-01) are **pending client confirmation**. Everything here is tokenised, so confirmed values can be swapped in one file.

---

## 1. Colour

### 1.1 Brand palette

| Name        | Token                | Hex       | Use                                    | Contrast                    |
| ----------- | -------------------- | --------- | -------------------------------------- | --------------------------- |
| ASRA Green  | `--asra-green-700`   | `#034729` | Primary actions, links                 | 10.8:1 on warm white        |
| Deep Green  | `--asra-green-900`   | `#012114` | Logo green; headings; brand bands      | 16.5:1 on ivory             |
| ASRA Gold   | `--asra-gold-500`    | `#E4A735` | Accent fills (with green-950 text)     | 8.5:1 (green-950 on it)     |
| Logo Gold   | `--asra-gold-600`    | `#C88717` | **Graphics only** (icons, quote marks) | 2.9:1 on ivory ✗ text       |
| Gold Text   | `--asra-gold-800`    | `#8A5A0B` | Gold-coloured text, eyebrows           | 5.7:1 on ivory              |
| Ivory       | `--asra-ivory`       | `#FDFBF5` | Page background                        | —                           |
| Warm White  | `--asra-warm-white`  | `#FFFEFB` | Cards, inputs, popovers, headers       | —                           |
| Ivory Deep  | `--asra-ivory-200`   | `#F6F1E4` | Sunken bands, footer                   | —                           |
| Dark Text   | `--asra-ink`         | `#13211A` | Body text                              | 16.1:1 on ivory             |
| Muted Green | `--asra-sage`        | `#6B8577` | Icons, dividers, decoration — not text | 3.9:1 (graphics ≥ 3:1 only) |
| Muted Green | `--asra-sage-strong` | `#4A6356` | Muted green when used as text          | 6.3:1 on ivory              |

Also available: `green-50/100/200/500/600/800/950` and `gold-50/100/200/700` for tints.

### 1.2 Semantic tokens

Components use **semantic** tokens (Tailwind: `bg-primary`, `text-muted-foreground`…). They never use raw hex values or brand scales for meaning.

| Token                                          | Value                                         | Purpose                                      |
| ---------------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `background` / `foreground`                    | ivory / ink                                   | Page                                         |
| `card` / `card-foreground`                     | warm white / ink                              | Raised surfaces                              |
| `popover` / `popover-foreground`               | warm white / ink                              | Menus, select lists                          |
| `primary` / `primary-foreground`               | green-700 / warm white                        | Main action                                  |
| `secondary` / `secondary-foreground`           | green-100 / green-900                         | Quiet actions, selected rows, active nav     |
| `accent` / `accent-foreground`                 | gold-500 / green-950                          | Emphasis CTA, highlights                     |
| `muted` / `muted-foreground`                   | `#F1F3EC` / `#51625A`                         | Subtle fills / secondary text (6.3:1)        |
| `border`                                       | `#DFE5DC`                                     | Decorative dividers and card edges           |
| `input`                                        | `#7D9185`                                     | Form-control boundary (3.3:1, WCAG 1.4.11)   |
| `ring`                                         | green-600                                     | Focus ring (used at 30–50 % alpha, 3px)      |
| `heading`                                      | green-900                                     | Headings                                     |
| `success` · `warning` · `info` · `destructive` | `#1A6B40` · `#8F4C06` · `#1D5A85` · `#B42318` | Status text/icons (≥ 5.7:1 on their `-soft`) |
| `*-soft`                                       | pale tints                                    | Status backgrounds (badges, alerts)          |
| `*-foreground` (status)                        | warm white                                    | Text on solid status fills (≥ 6.4:1)         |

**Category tones.** These are the pastel course tiles from the visual reference: `tone-sky`, `tone-mint`, `tone-amber`, `tone-violet`, `tone-rose` and `tone-teal`. Each tone has a `-soft` tile colour. Every icon colour is ≥ 4.6:1 on its tile.

### 1.3 Rules

1. Gold is for emphasis: one accent CTA per view, active indicators and eyebrows. Do not make every component green **and** gold.
2. Logo gold (`gold-600`) never carries text. Use `gold-800` for gold text.
3. Status is never conveyed by colour alone. Badges and alerts always have a word, and usually an icon too.
4. Avoid gradients, glassmorphism, neon and heavy shadows. Surfaces are flat, with a light `shadow-card`.
5. **Dark mode** is not a requirement. The pre-existing `.dark` token block is preserved and extended with the new semantic names, but it has not been designed or verified.

All contrast ratios were computed with the WCAG 2.x relative-luminance formula against the token values above.

## 2. Typography

**Fonts.** Plus Jakarta Sans (display and headings) and Inter (body and UI), loaded with `next/font/google` in `app/layout.tsx`, with no runtime font requests. Both were already in the project. They are pending the client's brand fonts (V-03). Devanagari, Arabic and Nastaliq glyphs currently fall back to system fonts, and `:lang(ur)` / `:lang(ar)` get a taller line height (see V-05).

Roles are Tailwind utilities defined with `@utility` in `globals.css`. Each role sets family, size, line height, weight and tracking. Colour is applied separately (`text-heading`, `text-muted-foreground`…).

| Role    | Class                                         | Spec                                      | Use                               |
| ------- | --------------------------------------------- | ----------------------------------------- | --------------------------------- |
| Display | `type-display`                                | Jakarta 700 · 34→60px fluid · lh 1.08     | Landing headlines                 |
| Heading | `type-h1` · `type-h2` · `type-h3` · `type-h4` | 30→44 / 24→34 fluid · 20 · 17px           | Page, section, card titles        |
| Body    | `type-body-lg` · `type-body` · `type-body-sm` | Inter 400 · 18 / 16 / 14px · lh 1.55–1.65 | Paragraphs, forms, card text      |
| Caption | `type-caption`                                | Inter 400 · 13px · lh 1.45                | Metadata, helper text, timestamps |
| Label   | `type-label` · `type-eyebrow`                 | Inter 550 · 14px / 650 · 12px uppercase   | Form/nav labels, section markers  |

- Fluid sizes use `clamp()`, so headings scale without extra breakpoints and stay moderate on phones.
- `type-display`, `type-h1` and `type-h2` use `text-wrap: balance`. Long titles in cards clamp (`line-clamp-2`) and break long words.
- The **visual role is independent of the semantic level**. Choose `<h1>…<h4>` for the outline, then the role for the look. Cards accept `headingLevel` (h2–h4), and `CardTitle` accepts `as`.
- Uppercase is only used for `type-eyebrow`, never for headings.
- `cn()` (`lib/utils.ts`) understands the role utilities and custom tokens, so `cn('type-body', 'type-h2')` resolves to `type-h2`.

## 3. Spacing, layout, radius, elevation

| Token / class           | Value                                                                         | Use                                        |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| `px-gutter`             | clamp 16 → 32px                                                               | Page side padding (via `Container`)        |
| `py-section`            | clamp 56 → 96px                                                               | Vertical section rhythm (via `Section`)    |
| `max-w-page`            | 76rem (1216px)                                                                | Pages and dashboards                       |
| `max-w-narrow`          | 56rem (896px)                                                                 | Forms, media articles                      |
| `max-w-prose-content`   | 42rem (672px)                                                                 | Long-form reading                          |
| `h-control-sm`          | 36px                                                                          | Dense UI (tables, toolbars, small buttons) |
| `h-control`             | 44px                                                                          | **Default** control height (touch target)  |
| `h-control-lg`          | 48px                                                                          | Hero / primary CTAs                        |
| `w-sidebar`, `h-topbar` | 256px, 64px                                                                   | Dashboard shell                            |
| Grid gaps               | `gap-3` / `gap-4` (cards), `gap-8` (blocks)                                   | Consistent card grids                      |
| Icons                   | 16px inline (`size-4`), 20px in buttons/feature tiles, 24px in category tiles | —                                          |

**Radius** (base `--radius: 12px`): `rounded-sm` 8px for badges, `rounded-md` 10px for inputs, `rounded-lg` 12px for alerts and popovers, `rounded-xl` 16px for cards and dialogs, `rounded-2xl` 20px for panels, and `rounded-full` for **buttons, tabs and pills** (the CTAs in the reference are pills).

**Borders**: 1px `border` on cards and dividers, and 1px `input` on controls.

**Elevation**: `shadow-card` (resting cards), `shadow-raised` (hover, popovers) and `shadow-overlay` (dialogs, drawers, toasts).

**Focus**: a 3px `ring-ring/50` on every interactive element (`focus-visible`).

## 4. Core components (`components/ui`)

All primitives are shadcn/ui-style wrappers. Interactive ones sit on the already-installed unified `radix-ui` package. **No new UI dependencies were added.**

| Component     | File                 | Variants / API                                                                                                                                                        | Notes                                                                                                                                                                                           |
| ------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button        | `button.tsx`         | `default` (primary), `accent`, `secondary`, `outline`, `ghost`, `destructive`, `link` × `sm`, `default`, `lg`, `icon`, `icon-sm`; `loading`, `loadingText`, `asChild` | Loading disables, sets `aria-busy` and shows a spinner (prevents double submit). Icon-only buttons need `aria-label`.                                                                           |
| Input         | `input.tsx`          | `Input` (any text-like `type`), `SearchInput`                                                                                                                         | One implementation for text/email/number/tel/url/search.                                                                                                                                        |
| PasswordInput | `password-input.tsx` | —                                                                                                                                                                     | Show/hide toggle with `aria-pressed` and `aria-controls`.                                                                                                                                       |
| Field         | `field.tsx`          | `label`, `hint`, `error`, `optional`, `id`                                                                                                                            | Wires `id`, `aria-describedby` and `aria-invalid` onto its single child (Radix Slot). Errors have an icon + text.                                                                               |
| Label         | `label.tsx`          | —                                                                                                                                                                     | Radix Label.                                                                                                                                                                                    |
| Select        | `select.tsx`         | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` (`disabled`), `SelectGroup`, `SelectLabel`, `SelectSeparator`                                                | Radix: keyboard, typeahead, disabled options. **Wrap `Field` inside `Select`**, because the trigger must be Field's child (`<Select><Field><SelectTrigger/></Field><SelectContent/></Select>`). |
| Card          | `card.tsx`           | `default`, `flat`, `muted`, `brand`; `interactive`; `CardHeader/Title/Description/Action/Content/Footer`                                                              | `CardTitle` renders `h3` by default (`as` to change).                                                                                                                                           |
| Badge         | `badge.tsx`          | `default`, `secondary`, `accent`, `success`, `warning`, `info`, `destructive`, `outline`                                                                              | Concise status, not decoration.                                                                                                                                                                 |
| Alert         | `alert.tsx`          | `info`, `success`, `warning`, `error`; `title`                                                                                                                        | `role="alert"` for errors, `role="status"` otherwise.                                                                                                                                           |
| Modal         | `dialog.tsx`         | `Dialog*`                                                                                                                                                             | Focus trap, Escape, overlay click and focus restoration (Radix). Scrolls within `100dvh − 2rem`.                                                                                                |
| Drawer        | `drawer.tsx`         | `side`: `left`, `right`, `bottom`; `DrawerHeader/Body/Footer`                                                                                                         | Same Radix Dialog as the modal. Used for mobile nav and the sidebar.                                                                                                                            |
| Tabs          | `tabs.tsx`           | `Tabs*`                                                                                                                                                               | Arrow/Home/End keys. Long lists scroll horizontally.                                                                                                                                            |
| Accordion     | `accordion.tsx`      | `Accordion*`                                                                                                                                                          | Buttons inside headings, `aria-expanded`, rotating chevron, long text wraps.                                                                                                                    |
| Table         | `table.tsx`          | `Table` (`scrollLabel`), `TableEmpty`, standard parts                                                                                                                 | Horizontal scroll container. With `scrollLabel` it becomes a focusable, labelled region. `th` defaults to `scope="col"`.                                                                        |
| Pagination    | `pagination.tsx`     | `getHref` (link mode, server-friendly) **or** `onPageChange` (client)                                                                                                 | Never fetches data. `aria-current="page"` and disabled boundaries. Phones show "Page x of y". Range logic is in `lib/pagination.ts`.                                                            |
| Toast         | `toast.tsx`          | `toast.success/error/warning/info(title, { description })`, `<Toaster/>` (in root layout)                                                                             | Radix Toast. Errors are assertive, others polite. Icon + title per tone. Pauses on hover/focus; F8 jumps to the region.                                                                         |
| Tooltip       | `tooltip.tsx`        | `Tooltip*`                                                                                                                                                            | Opens on hover **and** focus; Escape closes. Supplementary only.                                                                                                                                |
| Avatar        | `avatar.tsx`         | `name`, `src`, `size` (`sm`…`xl`), `status` (`online`, `away`, `offline`)                                                                                             | Missing or failed images fall back to initials. Status is also given as screen-reader text.                                                                                                     |
| Progress      | `progress.tsx`       | `value`, `max`, `label` (required), `showValue`, `size`                                                                                                               | Clamped to 0…max. Missing values render "No progress data", not an indeterminate bar.                                                                                                           |
| Skeleton      | `skeleton.tsx`       | `Skeleton`, `SkeletonText`, `LoadingRegion`                                                                                                                           | Decorative. Wrap in `LoadingRegion` for one "Loading…" announcement. `CourseCardSkeleton` matches `CourseCard`.                                                                                 |

## 5. ASRA education components (`components/asra`)

These are presentational Server Components with typed props (`types/education.ts`). They render **only the data they are given**. They contain no fetching, no business rules and no invented prices, ratings, counts, credentials or testimonials. Every field except the title (or name) is optional.

| Component                             | Folder          | Key behaviour                                                                                                                                                                                   |
| ------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CourseCard` (+ `CourseCardSkeleton`) | `courses/`      | Cover via `next/image` (16:9) or a neutral fallback. Category/subject eyebrow. Instructor, duration and language metadata. `Draft`/`Archived` badges (published shows none). Optional `action`. |
| `FacultyCard`                         | `faculty/`      | Avatar with initials fallback, designation, subject badges, clamped bio, optional profile link.                                                                                                 |
| `FeatureCard`                         | `features/`     | Icon tile, title, description; `align` `start`/`center`.                                                                                                                                        |
| `CourseCategoryCard`                  | `categories/`   | Pastel `tone`. Count shown **only** when `courseCount` is a real number. `lang` sets `lang`/`dir` (RTL for `ar`/`ur`). With `href`, the whole tile is clickable through one stretched link.     |
| `TestimonialCard`                     | `testimonials/` | `figure`/`blockquote`/`figcaption`. Real use requires consent (U-04).                                                                                                                           |
| `LiveClassCard`                       | `live-classes/` | Status: scheduled, live, completed, cancelled. A **Join** link appears only when `status === 'live'` and `joinUrl` is http(s) (it opens in a new tab and says so). Provider-neutral (F-01).     |
| `AssignmentCard`                      | `assignments/`  | Status: not submitted, submitted, overdue, graded. Result is shown only when graded.                                                                                                            |
| `ExamCard`                            | `exams/`        | Status: scheduled, open, completed, cancelled. No exam logic.                                                                                                                                   |
| `ProgressCard`                        | `progress/`     | Clamped percentage, "Completed" state, and "No progress yet" for missing or invalid data.                                                                                                       |

Shared parts (`asra/shared/card-parts.tsx`): `StatusBadge` (icon + word), `MetaList` (icon + text rows; empty values skipped) and `CardLinkButton`.

**Dates** go through `lib/format.ts`. They are always formatted in an explicit time zone (default `Asia/Kolkata`) so server and client output match (no hydration mismatch), they render inside `<time dateTime>`, and invalid dates are omitted. **Status is passed in, never derived from the browser clock.**

**Images**: covers use `next/image`. Remote hosts must be added to `images.remotePatterns` once the storage provider is chosen (R-01).

## 6. Layouts (`components/layout`)

| Component                        | Responsibility                                                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Container`                      | Centred column: `px-gutter` plus `size` `page` (default), `narrow`, `prose` or `full`.                                                                                                                                         |
| `Section`                        | `py-section` band. Optional eyebrow, title (`headingLevel`), description and action. `tone` `default`/`muted`/`brand`. Labelled by its title.                                                                                  |
| `Navbar` (client)                | Brand, links from `config/navigation.ts`, optional `cta` and `actions` slot. Inline links from `lg`; below that, a focus-trapped drawer. Active link: `aria-current`, green text and a gold underline. Includes the skip link. |
| `Footer`                         | Brand, link columns, the **confirmed** email and founding line from `siteConfig`, and optional legal links (pass only links whose pages exist). Light surface (see V-01).                                                      |
| `Sidebar` (client)               | Grouped nav, icon elements, badges, `aria-current`; `tone` `default`/`admin`.                                                                                                                                                  |
| `DashboardLayout` (client shell) | Sidebar rail from `lg` up, a sticky top bar, and a drawer for the sidebar below `lg` (closes on navigation). Has `contextLabel`, `headerActions` and `sidebarFooter`. Children stay Server Components.                         |
| `AdminLayout`                    | `DashboardLayout` with the deep-green admin rail and an "Administration" badge. No duplicated layout code.                                                                                                                     |
| `PageHeader`                     | Breadcrumbs, the page `<h1>`, description and actions.                                                                                                                                                                         |
| `BrandMark`                      | Emblem on an ivory tile (legible on green) plus the name and tagline. It is an interim horizontal lockup until the client supplies one (V-01).                                                                                 |
| `SkipLink`, `PageTransition`     | See §9 and §7.                                                                                                                                                                                                                 |

**Security note.** Layouts and navigation are **not** access control. Portal and admin routes must be protected by the Phase 03 auth/RBAC layer (API `requireRole`/`requirePermission`, plus route-level checks when portals are built). Hiding a sidebar item is cosmetic.

**Session-aware UI.** `AuthProvider` deliberately lives only in the `(auth)` route group (public pages never call `/auth/refresh`). A signed-in user menu therefore belongs inside a future portal layout that mounts the provider, and is passed to `Navbar`/`DashboardLayout` through their `actions`/`headerActions` slots.

## 7. Motion

| Token             | Value                           | Use                        |
| ----------------- | ------------------------------- | -------------------------- |
| `duration-150`    | 150ms                           | Hover, focus, colour       |
| `duration-200`    | 200ms                           | Fade, scale, overlays      |
| `duration-300`    | 300ms                           | Slides, drawers, entrances |
| `ease-standard`   | `cubic-bezier(0.2, 0, 0, 1)`    | Default                    |
| `ease-emphasized` | `cubic-bezier(0.3, 0, 0, 1.15)` | Rare, slight overshoot     |

| Pattern              | Implementation                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fade / Slide / Scale | `animate-fade-in`, `animate-fade-up`, `animate-scale-in` (own keyframes); overlays use `tw-animate-css` enter/exit classes driven by Radix `data-state`. |
| Hover                | `Card interactive` / category tiles: `-translate-y-0.5` + `shadow-raised`, wrapped in `motion-safe:`.                                                    |
| Reveal               | `reveal` utility: CSS scroll-driven animation (`animation-timeline: view()`) inside `@supports`. **Content is visible without JS or support.**           |
| Progress             | Bar width transitions over 500ms; the value text changes immediately.                                                                                    |
| Page transition      | `PageTransition` (CSS `animate-page-in`, opacity + translateY) used from a segment's `template.tsx`, as in the dashboard and admin previews.             |

Rules: transform/opacity only (no layout shift), no continuous or parallax motion, and no JS animation library (none was installed, and CSS is sufficient). Under **`prefers-reduced-motion: reduce`**, all animations and transitions resolve in ~0ms, `reveal` is disabled, and hover lifts are skipped (`motion-safe:`). Dialogs, drawers, tabs, accordions and toasts remain fully functional (verified, §12).

## 8. Responsive design

Tailwind's default breakpoints are used, with no custom ones: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

| Category      | Verified at | Behaviour                                                                                                                 |
| ------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Mobile        | 375 × 812   | Single column; navbar and sidebar in drawers; 44px controls; pagination "Page x of y"; tables scroll inside their region. |
| Tablet        | 768 × 1024  | Two-column card grids; nav and sidebar still in drawers.                                                                  |
| Desktop       | 1440 × 900  | Inline nav, sidebar rail, three-column grids.                                                                             |
| Large desktop | 1920 × 1080 | Content capped at `max-w-page` (1216px) and centred.                                                                      |

Layouts change structure at breakpoints; they do not shrink the desktop UI. Grids are written mobile-first (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`).

## 9. Accessibility conventions

- Semantic landmarks: `header`, `nav` with distinct `aria-label`s, `main#main-content`, `footer`. A skip link is the first Tab stop.
- One `<h1>` per page (the auth card title is now the page `<h1>`), with a logical heading order and `headingLevel`/`as` props to keep it.
- Visible 3px focus ring on all interactive elements; never `outline: none` without a replacement.
- Links navigate and buttons act. Disabled pagination boundaries are disabled `<button>`s.
- Every icon-only control has an `aria-label`. Decorative icons are `aria-hidden`.
- Form errors: text + icon, `aria-invalid`, `aria-describedby`. Form-level summaries use `role="alert"`.
- Progress uses `role="progressbar"` with `aria-valuenow` and `aria-valuetext`; status badges include a word.
- Text and controls meet WCAG AA contrast (§1).
- Arabic/Urdu content sets `lang` and `dir="rtl"`.

**Claim boundary.** These are WCAG 2.1 AA-oriented conventions (NFR-009 target), checked with automated browser assertions and contrast calculations. **No full WCAG audit or screen-reader test pass has been performed.**

## 10. Adding a component consistently

1. Check `components/ui` first. If shadcn/ui has the primitive, add it via the CLI (`npx shadcn@latest add <name>` in `apps/web`), then restyle it with **semantic tokens** to match the files here.
2. Use the `type-*` roles, `h-control*` heights, `rounded-*` scale and `shadow-*` elevation. Avoid arbitrary values when a token exists.
3. Use `cn()` for class merging and `cva` for variants. Expose `className`; add `data-slot="…"`.
4. Default to a Server Component. Add `'use client'` only for state, effects or browser APIs, and keep non-component exports (class strings, helpers) out of client modules.
5. Pass icons as **elements** (`icon={<BookOpen />}`), not component references, so server code can hand them to client components.
6. Handle missing, invalid and long data. Never render "Invalid Date", `NaN%` or placeholder business data.
7. Add an example to the showcase and assertions to `apps/web/tests/components.test.tsx`.

## 11. The showcase (`/design-system`)

- **Route**: `apps/web/src/app/(internal)/design-system/`, with sections A–F (Brand, Core components, Education, Layouts, Motion, Responsive), and full-page previews at `/design-system/dashboard-preview` and `/design-system/admin-preview` (sub-routes work, to show active nav and page transitions).
- **Access**: always available in development and test. In **production builds it returns 404** unless `ENABLE_DESIGN_SYSTEM=true` is set. The check runs on the server per request (`await connection()` + `notFound()` in the segment layout), so one build can be promoted between environments. The page is `noindex`.
- **Data**: demo fixtures live in `_fixtures.tsx`, clearly marked "(demo)", and are never imported by product code. The showcase calls no API.

## 12. Verification (PHASE 04)

| Check                      | How                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit / component contracts | `npm run test -w @asra/web` (Node test runner + tsx, server-rendered markup): 46 tests                                                                                                                                                                                                                                                                                                                              |
| Responsive                 | Headless Chrome at 375×812, 768×1024, 1440×900 and 1920×1080 on the showcase, both previews, `/login`, `/register` and `/`: no horizontal overflow; content capped at 1216px                                                                                                                                                                                                                                        |
| Interactions               | Headless Chrome (DevTools Protocol): skip link, modal focus trap / Escape / focus return, drawer, tabs keyboard, accordion keyboard, form errors, select keyboard, toast, tooltip on focus, both pagination modes, table empty state, avatar fallback, progress clamping, mobile navbar drawer, mobile dashboard drawer navigation, admin rail, and reduced motion (19 checks, on both `next dev` and `next start`) |
| Auth regression            | Restyled `/login` and `/register` against the real local API (8 checks)                                                                                                                                                                                                                                                                                                                                             |

The browser scripts are not part of the repository, because they rely on a locally installed Chrome. To re-check manually, open `/design-system`, resize through the four viewports, and repeat the interactions listed above with the keyboard only and with OS "reduce motion" on.

## 13. Decisions pending client confirmation

| Item                                         | Current decision                                                                 | Ref        |
| -------------------------------------------- | -------------------------------------------------------------------------------- | ---------- |
| Official green/gold codes                    | Sampled from the logo PNG                                                        | V-02       |
| Brand fonts (Latin, Arabic/Urdu, Devanagari) | Plus Jakarta Sans + Inter; system fallback for other scripts                     | V-03       |
| Horizontal and reversed (light-on-dark) logo | Emblem-on-ivory `BrandMark`; light footer instead of the reference's dark footer | V-01       |
| Visual reference final?                      | Direction only; reference added to `docs/design/` still pending                  | V-04, V-06 |
| Hindi course tile in the reference           | Not in the confirmed course list; not shown                                      | B-07       |
| Display time zone                            | `Asia/Kolkata` for all dates                                                     | V-09       |
| UI language / RTL                            | English UI; content in Arabic/Urdu renders RTL                                   | V-05       |
