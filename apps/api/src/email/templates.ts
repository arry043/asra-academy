import { z } from 'zod';

/**
 * ASRA Academy branded email layout (PHASE 11, docs/NOTIFICATIONS.md §5). One layout for every
 * notification: heading, greeting, intro, an optional details table, an optional call-to-action
 * and a footnote. Every value is escaped, so nothing a user typed (class titles, names) can inject
 * markup. A plain-text version is always produced alongside the HTML.
 *
 * Colours follow docs/DESIGN-SYSTEM.md: ASRA Green #034729, Deep Green #012114, ASRA Gold #E4A735,
 * Ivory #FDFBF5, Ink #13211A, muted text #51625A, border #DFE5DC.
 */

const line = (max: number) => z.string().trim().min(1).max(max);

/** Links in emails must be absolute http(s) URLs (the app URL may be http://localhost in dev). */
const linkSchema = z.url({ protocol: /^https?$/ }).max(2048);

export const brandedEmailSchema = z
  .object({
    recipientName: line(150),
    subject: line(200),
    heading: line(200),
    intro: line(1000),
    details: z
      .array(z.object({ label: line(60), value: line(500) }).strict())
      .max(10)
      .default([]),
    action: z
      .object({ label: line(60), url: linkSchema })
      .strict()
      .optional(),
    /** Secondary links shown as plain text (e.g. a meeting link next to the portal link). */
    links: z
      .array(z.object({ label: line(60), url: linkSchema }).strict())
      .max(3)
      .default([]),
    footnote: z.string().trim().max(500).optional(),
  })
  .strict();

export type BrandedEmailInput = z.input<typeof brandedEmailSchema>;

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

/** Validates the input (throws ZodError on programming errors) and renders text + HTML. */
export function renderBrandedEmail(input: BrandedEmailInput): RenderedEmail {
  const data = brandedEmailSchema.parse(input);

  const text = [
    `Hello ${data.recipientName},`,
    '',
    data.intro,
    ...(data.details.length > 0
      ? ['', ...data.details.map((detail) => `${detail.label}: ${detail.value}`)]
      : []),
    ...(data.action ? ['', `${data.action.label}: ${data.action.url}`] : []),
    ...data.links.map((link) => `${link.label}: ${link.url}`),
    ...(data.footnote ? ['', data.footnote] : []),
    '',
    '— ASRA Academy',
  ].join('\n');

  const details =
    data.details.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;border-collapse:collapse;">${data.details
          .map(
            (detail) =>
              `<tr><td style="padding:8px 12px 8px 0;border-top:1px solid #DFE5DC;color:#51625A;font-size:14px;white-space:nowrap;vertical-align:top;">${escapeHtml(detail.label)}</td><td style="padding:8px 0;border-top:1px solid #DFE5DC;color:#13211A;font-size:14px;">${escapeHtml(detail.value)}</td></tr>`,
          )
          .join('')}</table>`
      : '';
  const action = data.action
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(data.action.url)}" style="display:inline-block;background:#034729;color:#FFFEFB;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(data.action.label)}</a></p>`
    : '';
  const links = data.links
    .map(
      (link) =>
        `<p style="margin:8px 0;font-size:14px;color:#51625A;">${escapeHtml(link.label)}: <a href="${escapeHtml(link.url)}" style="color:#034729;">${escapeHtml(link.url)}</a></p>`,
    )
    .join('');
  const footnote = data.footnote
    ? `<p style="margin:16px 0 0;font-size:13px;color:#51625A;">${escapeHtml(data.footnote)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(data.subject)}</title></head>
<body style="margin:0;padding:0;background:#FDFBF5;font-family:Arial,Helvetica,sans-serif;color:#13211A;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FDFBF5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#FFFEFB;border:1px solid #DFE5DC;border-radius:12px;overflow:hidden;">
<tr><td style="background:#012114;padding:16px 24px;border-bottom:4px solid #E4A735;"><span style="color:#FFFEFB;font-size:18px;font-weight:700;letter-spacing:0.3px;">ASRA Academy</span></td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#012114;">${escapeHtml(data.heading)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hello ${escapeHtml(data.recipientName)},</p>
<p style="margin:0;font-size:15px;line-height:1.5;white-space:pre-line;">${escapeHtml(data.intro)}</p>
${details}${action}${links}${footnote}
</td></tr>
<tr><td style="padding:16px 24px;background:#F6F1E4;font-size:12px;color:#51625A;">You received this email because you have an ASRA Academy account. Notifications are also listed in your portal.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: data.subject, text, html };
}
