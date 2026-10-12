# ASRA Academy — Brand Assets

| Item       | Value                  | Source                    |
| ---------- | ---------------------- | ------------------------- |
| Name       | ASRA Academy           | Client                    |
| Tagline    | Learn • Grow • Succeed | Client logo               |
| Founded by | Students of AMU        | Client (2026-10-12)       |
| Email      | asraacademy1@gmail.com | Client (2026-10-12)       |
| Website    | www.asraacademy.in     | Project Development Order |

## Logo files

| File                                                                          | Use                                                                              |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `docs/brand/asra-academy-logo-source.png`                                     | Master file as supplied by the client (1254×1254, transparent PNG). Do not edit. |
| `apps/web/public/brand/asra-academy-logo.png`                                 | Full logo, trimmed (1007×1126). Light backgrounds only.                          |
| `apps/web/public/brand/asra-academy-emblem.png`                               | Crest only (crescent, ring, "A", open book), 512×512, transparent.               |
| `apps/web/src/app/favicon.ico`                                                | 16/32/48 px emblem on an ivory rounded tile.                                     |
| `apps/web/src/app/icon.png`                                                   | 512 px emblem on an ivory rounded tile.                                          |
| `apps/web/src/app/apple-icon.png`                                             | 180 px, full-bleed ivory (iOS applies its own rounding).                         |
| `apps/web/public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Web app manifest icons.                                                          |
| `apps/web/public/brand/og-image.png`                                          | 1200×630 social share image (declared in `layout.tsx` metadata).                 |

### Usage rules

- The logo's dark green is near-black (`#012114`). On dark or green backgrounds the "A" and book disappear, so **always place the logo on a light (ivory/white) surface**. A light-on-dark logo variant is needed for dark sections.
- Small sizes (≤ 48 px) use the **emblem**, not the full logo, because the wordmark becomes unreadable.
- Do not recolour, stretch or add effects to the logo.

## Colours (sampled from the logo)

| Token            | Hex       | Role                                                | Contrast on ivory `#fdfbf5`  |
| ---------------- | --------- | --------------------------------------------------- | ---------------------------- |
| `asra-green-900` | `#012114` | Logo green; headings and body text                  | 16.5:1                       |
| `asra-green-700` | `#034729` | Logo green highlight; primary buttons and links     | 10.8:1 (white text on it)    |
| `asra-gold-600`  | `#c88717` | Logo gold; **graphics and decoration only**         | 2.9:1 ✗ (fails as text)      |
| `asra-gold-500`  | `#e4a735` | Logo gold highlight; accent buttons with green text | 8.0:1 (green-950 text on it) |
| `asra-gold-800`  | `#8a5a0b` | Gold **text** on light backgrounds                  | 5.7:1                        |
| `asra-ivory`     | `#fdfbf5` | Page background                                     | —                            |

The values were sampled from the supplied PNG. The client should confirm official brand codes (see CLIENT-CLARIFICATIONS V-02).

## Still needed from the client

- A vector logo (SVG/AI/PDF) for crisp print, certificate and large-format use.
- A light-on-dark (reversed) logo variant.
- The official brand fonts, if any.
