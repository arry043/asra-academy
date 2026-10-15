# ASRA Academy — Public Website (PHASE 05)

Version 0.5.0 (unreleased) · Implemented in `apps/web/src/app/(public)`

The public website is usable without signing in. It contains only facts from the client's Project Development Order, the confirmed brand details (logo, tagline, "Founded by students of AMU", asraacademy1@gmail.com) and the visual-reference headline. Anything not confirmed is either left out, shown as "to be announced", or replaced by an honest empty state. The open questions are listed in [CLIENT-CLARIFICATIONS.md](./CLIENT-CLARIFICATIONS.md) §Y.

## 1. Routes

| Route                                                                           | File                               | Rendering                         | Content status                                                   |
| ------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `/`                                                                             | `(public)/page.tsx`                | Static                            | Confirmed facts; copy awaiting approval (Y-01)                   |
| `/about`                                                                        | `(public)/about/page.tsx`          | Static                            | Purpose and approach from Order §1, §2, §8 (Y-01)                |
| `/courses`                                                                      | `(public)/courses/page.tsx`        | Static + client filter (Suspense) | Full catalogue                                                   |
| `/classes/6-10`, `/classes/11-12`                                               | `(public)/classes/[band]/page.tsx` | SSG, `dynamicParams = false`      | Subjects provisional (A-01, A-02)                                |
| `/courses/english`, `/entrepreneurship`, `/quranic-studies`, `/arabic`, `/urdu` | `(public)/courses/[slug]/page.tsx` | SSG, `dynamicParams = false`      | Topics from Order §2B; fees, levels and duration TBA (B-01–B-04) |
| `/faculty`                                                                      | `(public)/faculty/page.tsx`        | Static                            | Empty state (C-01, C-02)                                         |
| `/admission`                                                                    | `(public)/admission/page.tsx`      | Static                            | Provisional steps (Y-02)                                         |
| `/contact`                                                                      | `(public)/contact/page.tsx`        | Dynamic (reads `?topic=`)         | Email hand-off (Y-05)                                            |
| `/blog`                                                                         | `(public)/blog/page.tsx`           | Static, `noindex` while empty     | Empty state (X-03)                                               |
| `/privacy-policy`, `/terms`, `/refund-policy`                                   | `(public)/<slug>/page.tsx`         | Static                            | **Draft outline, pending approval** (U-01, N-01)                 |
| `/login`                                                                        | `(auth)/login/page.tsx` (Phase 03) | unchanged                         | Linked from header, footer and admission page                    |
| `/sitemap.xml`, `/robots.txt`                                                   | `app/sitemap.ts`, `app/robots.ts`  | Static                            | §7                                                               |

Unknown programme slugs (e.g. `/courses/hindi`, `/classes/1-5`) return 404. Shared shell: `(public)/layout.tsx` (Navbar, `<main id="main-content">`, Footer), `template.tsx` (CSS fade-in that respects reduced motion) and `error.tsx` (retry and home links).

**No authentication on public routes.** The `(public)` layout has no `AuthProvider`, and no middleware or proxy guards these routes. In browser checks the public pages made **zero** API requests; only `/login` calls `/auth/refresh`, as before.

## 2. Homepage structure

`(public)/page.tsx` renders, in the reference order: **Hero** → **Platform Highlights** (six `FeatureCard`s for confirmed platform capabilities, introduced as features that "open to enrolled students as the platform launches") → **Courses** (`ProgrammeGrid` of all seven programmes plus a "Find the right course" tile) → **Why ASRA** (four confirmed points) → **Live Classes** (`LiveClassCard`s when `content/live-classes.ts` has sessions; otherwise an explanation and a "What to expect" list, never invented schedules or join links) → **Faculty** (`FacultyCard`s or an empty state) → **Learning Process** (`LearningSteps`) → **Testimonials** (`TestimonialCard`s or a neutral message) → **CTA** (`CtaBand`). Navbar and footer come from the layout. Sections live in `(public)/_home/sections.tsx`.

## 3. Reusable public components (`components/public/`)

| Component                                                   | Purpose                                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `PageHero`                                                  | Inner-page intro: visible breadcrumbs + BreadcrumbList JSON-LD, eyebrow, the page `<h1>`, actions, aside |
| `ProgrammePage`                                             | One template for all class-band and special-course pages                                                 |
| `ProgrammeGrid`                                             | `CourseCard` grid (3 or 4 columns) with an optional "view all" tile                                      |
| `CourseDirectory`                                           | Client search and filter for `/courses` (§4)                                                             |
| `ContactForm`                                               | Enquiry form (§5)                                                                                        |
| `WhatsAppLink`                                              | Click-to-chat button; renders nothing until configured (§6)                                              |
| `CtaBand`                                                   | Green closing call-to-action band                                                                        |
| `EmptyState`                                                | Honest placeholder with a real next step                                                                 |
| `LegalPage`                                                 | Shared legal-document layout with a pending-approval banner                                              |
| `LearningSteps`, `CheckList`, `JsonLd`, `programme-visuals` | Steps list, check list, structured-data script, icon/tone per programme                                  |

Shared Phase 04 components are reused: `Navbar` (now with a Courses disclosure menu and a Login `secondaryCta`), `Footer`, `Section`, `Container`, and the `CourseCard`, `FacultyCard`, `FeatureCard`, `LiveClassCard`, `TestimonialCard` and `CourseCategoryCard` cards. `CourseCard` gained optional `icon`/`tone` for imageless covers.

## 4. Course search and filtering

- Data: `content/programmes.ts`, seven programmes (two class bands, five special courses).
- **Search** (`lib/programmes.ts → filterProgrammes`): case-insensitive and accent-insensitive; `&` is treated as "and"; punctuation is ignored. Every word must match somewhere in the title, summary, category, curriculum label, topics or provisional subjects, in any order. Example: "planning business" finds Entrepreneurship & Business.
- **Filter**: one category facet — School education, Languages, Entrepreneurship & Business, Quranic Studies — shown with counts as radio "chips" (native radios, so arrow keys work). The catalogue supports no other facets.
- Search and filter combine. "Clear filters" (toolbar and empty state) restores all seven.
- **URL state**: `?q=…&category=…` is written with `history.replaceState` (shareable, survives refresh, no history spam) and read on load. Unknown categories are ignored and the query is capped at 80 characters. The query is only compared as text, never rendered as HTML.
- No network requests: the catalogue is local, so there is nothing to debounce. Without JavaScript the server-rendered full list is shown (the Suspense fallback).
- A polite live region announces "Showing N of 7 programmes…".

## 5. Contact form and enquiries

- Fields: full name, email, phone (optional), topic (programmes, admission, general), message (10–1,500 characters). Validation uses `enquirySchema` from `@asra/validation`, the same schema a future API must enforce server-side.
- Errors are inline, linked to their fields (`aria-invalid`, `aria-describedby`), and focus moves to the first invalid field. `?topic=<slug>` preselects the topic (course and admission pages link this way).
- **Delivery:** there is **no enquiry endpoint** in the API (only `/health` and `/auth/*`). The page states this up front. On a valid submit it opens the visitor's email app with a prefilled message to asraacademy1@gmail.com (`lib/enquiry.ts → buildEnquiryMailto`) and explains that the enquiry is sent only when the visitor presses Send. It never claims delivery and offers a retry link and the plain address.
- **To integrate an API later** (Y-05): add `POST /api/v1/enquiries` validating `enquirySchema` (strict), with rate limiting, spam protection (e.g. a honeypot or captcha, to be chosen) and delivery through the existing email service. Then replace `handOff` in `ContactForm` with `apiRequest('/enquiries', { method: 'POST', body })`, show a pending state with `Button loading` (which already prevents double submission), and show success only after a 2xx response. Do not log message bodies.

## 6. WhatsApp

- `NEXT_PUBLIC_WHATSAPP_NUMBER` holds digits with country code. Spaces, `+`, `-` and brackets are stripped, and anything other than 8–15 digits fails the build with a clear error. **Empty means no WhatsApp button anywhere**: no placeholder number is ever rendered.
- `buildWhatsAppUrl` → `https://wa.me/<digits>?text=<message>` (`%20` spaces, max 500 chars). Messages are neutral and contain no personal data ("Hello, I would like to know more about the Arabic Language course at ASRA Academy.").
- The button opens in a new tab with `rel="noopener noreferrer"` and an sr-only "(opens WhatsApp in a new tab)". It appears in the CTA bands, programme pages, admission page and contact page once configured.
- It is a click-to-chat link only. WhatsApp Business API (P-01/P-03) is out of scope.

## 7. SEO

- **Metadata** (`lib/seo.ts → buildPageMetadata`): every page gets a unique title (template `%s | ASRA Academy`, absolute on home), a unique description, a canonical path, and Open Graph/Twitter tags with the shared share image. Programme SEO strings live in `content/programmes.ts`.
- **Canonical origin** = `NEXT_PUBLIC_APP_URL` (root `metadataBase`). Production must set `https://www.asraacademy.in` once the domain is live (W-04). No domain is hard-coded.
- **Indexing** is opt-in: `SITE_INDEXING_ENABLED=true` in the **production build** environment switches the root `meta robots` to `index, follow` and robots.txt to `Allow: /` (with `Disallow: /design-system` and the sitemap URL). Otherwise every page is `noindex, nofollow` and robots.txt is `Disallow: /`, so preview and staging builds are never indexed. Account pages and the empty blog are always `noindex`. robots.txt is crawler guidance, not access control.
- **Sitemap** (`lib/sitemap.ts`): `/`, `/about`, `/courses`, the 7 programme pages, `/faculty`, `/admission`, `/contact` and the 3 legal pages (16 URLs). It excludes `/login` and the other auth pages, `/design-system` and `/blog` while it is empty. Blog article URLs will be added only from a real published-posts source.
- **Structured data**: `EducationalOrganization` (name, URL, logo, slogan, description, email) and `WebSite` on the homepage, and `BreadcrumbList` matching the visible breadcrumbs on inner pages. No address, phone, social profiles, ratings, prices or Course offers are claimed. JSON-LD is escaped so it cannot close its script tag.
- **Semantics**: one `<h1>` per page (verified on all 18 routes), logical heading levels, `header`/`nav`/`main`/`footer` landmarks, labelled navs (Main, Breadcrumb, Legal, footer columns), descriptive link text.

## 8. Data sources and future integration

| Data         | Source today                                      | Future source                                                                                                                                                                                   |
| ------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Programmes   | `content/programmes.ts` (Order §2 facts)          | Public catalogue endpoint over Prisma `Course`/`CourseCategory`/`Subject` (PHASE 06), returning the `Programme` shape or mapped to it; published courses only                                   |
| Faculty      | `content/faculty.ts` (empty)                      | Public endpoint returning only `FacultyProfile.isPublic = true` rows and only public fields (name, designation, subjects, bio, photo URL) — never email, phone, roles, status or `employeeCode` |
| Live classes | `content/live-classes.ts` (empty)                 | Public schedule summary without join links (PHASE 11)                                                                                                                                           |
| Testimonials | `content/testimonials.ts` (empty)                 | Approved, consented entries (U-04)                                                                                                                                                              |
| Blog         | `content/blog.ts` (empty)                         | A CMS or blog model to be decided (X-03); add `/blog/[slug]` and sitemap entries together                                                                                                       |
| Legal text   | `content/legal.ts` (outlines, `pending-approval`) | Client-approved text; set `status: 'approved'` and `effectiveDate`                                                                                                                              |
| Enquiries    | Email hand-off (§5)                               | `POST /api/v1/enquiries` (Y-05)                                                                                                                                                                 |

Pages depend only on the types, so swapping a source does not change page code. No backend endpoints, database schema or RBAC rules were changed in Phase 05.

## 9. Verification (Phase 05)

- Automated: `npm run test -w @asra/web` (84 tests, 38 of them new in `tests/public-website.test.tsx`), `npm test` (API, 118), `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`.
- Browser (headless Chrome via the DevTools protocol, production build):
  - All 18 routes at 375×812, 768×1024, 1440×900 and 1920×1080: no horizontal overflow, no broken images, one `<h1>` and one `<main>` per page, inline nav from 1024 px with a drawer below that, no console errors, no API calls from public pages.
  - Course search, category filter, combination, both clear-filter buttons, URL sync and direct loads with params.
  - Courses disclosure: opens; Escape closes it and returns focus; a link navigates; the parent is marked active.
  - Mobile drawer: opens, a link navigates, the drawer closes.
  - First Tab reaches the skip link.
  - Contact form: required errors with focus on the first invalid field; invalid phone rejected; `?topic=` preselects; a valid submit produces the mailto hand-off with no delivery claim.
  - Live `/login` round-trip on the dev server: the API answered "Invalid email or password" for unknown credentials.
- Manual steps still worth doing before launch: test with a real screen reader (VoiceOver/NVDA), check the mailto hand-off on mobile devices, and check the WhatsApp button with the real number.
- Not done: a formal WCAG audit and a Lighthouse/Core Web Vitals run.
