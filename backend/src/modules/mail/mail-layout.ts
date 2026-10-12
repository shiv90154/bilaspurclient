/**
 * One branded layout for every email (OTP, registrations, payments, admissions).
 * Email clients ignore <style> blocks and flexbox, so this is table layout with inline styles,
 * kept in the website's colours. Every piece of text is escaped here; callers pass plain strings.
 */

export interface EmailContent {
  /** Grey preview line next to the subject in the inbox. */
  preheader: string;
  heading: string;
  /** "Hello Ravi," */
  greeting?: string;
  paragraphs: string[];
  /** A one-time code, shown large. */
  code?: string;
  /** Label/value lines, e.g. amount and course of a payment. */
  rows?: { label: string; value: string }[];
  button?: { label: string; url: string };
  /** Small grey line under the content. */
  footnote?: string;
}

export interface EmailBrand {
  instituteName: string;
  /** Website origin, e.g. https://dhiayurved.com (for the logo and links). */
  site: string;
  contactEmail?: string;
  contactPhone?: string;
}

const C = {
  page: '#f5f1e6',
  card: '#ffffff',
  line: '#e6e0cc',
  primary: '#1f4d2c',
  primaryDark: '#0d301c',
  ink: '#1a2b20',
  sub: '#5a6659',
  accent: '#ab803b',
  accentTint: '#f5e8c8',
};
const FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function renderEmail(c: EmailContent, brand: EmailBrand): { html: string; text: string } {
  const e = escapeHtml;
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.ink}">${e(t)}</p>`;

  const code = c.code
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr>
<td align="center" style="background:${C.accentTint};border:1px dashed ${C.accent};border-radius:10px;padding:18px 10px">
<div style="font-family:Consolas,'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${C.primaryDark}">${e(c.code)}</div>
</td></tr></table>`
    : '';

  const rows = c.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border:1px solid ${C.line};border-radius:10px;border-collapse:separate">${c.rows
        .map(
          (r, i) => `<tr>
<td style="padding:11px 14px;font-size:14px;color:${C.sub};${i ? `border-top:1px solid ${C.line};` : ''}">${e(r.label)}</td>
<td align="right" style="padding:11px 14px;font-size:14px;font-weight:600;color:${C.ink};${i ? `border-top:1px solid ${C.line};` : ''}">${e(r.value)}</td></tr>`,
        )
        .join('')}</table>`
    : '';

  const button = c.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr>
<td style="background:${C.primary};border-radius:8px">
<a href="${e(c.button.url)}" style="display:inline-block;padding:12px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${e(c.button.label)}</a>
</td></tr></table>`
    : '';

  const contact = [
    brand.contactPhone && e(brand.contactPhone),
    brand.contactEmail && `<a href="mailto:${e(brand.contactEmail)}" style="color:${C.sub}">${e(brand.contactEmail)}</a>`,
  ].filter(Boolean);
  const host = brand.site.replace(/^https?:\/\//, '');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${e(c.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FONT}">
<tr><td style="background:${C.primary};border-radius:14px 14px 0 0;padding:18px 24px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px"><img src="${e(brand.site)}/apple-icon.png" width="44" height="44" alt="" style="display:block;border-radius:10px;border:0"></td>
<td style="font-size:18px;font-weight:700;color:#ffffff">${e(brand.instituteName)}</td>
</tr></table></td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-top:0;border-radius:0 0 14px 14px;padding:28px 24px 14px">
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:${C.primaryDark}">${e(c.heading)}</h1>
${c.greeting ? p(c.greeting) : ''}${c.paragraphs.map(p).join('')}${code}${rows}${button}
${c.footnote ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:${C.sub}">${e(c.footnote)}</p>` : ''}
</td></tr>
<tr><td align="center" style="padding:18px 12px 0;font-size:12px;line-height:1.6;color:${C.sub}">
${e(brand.instituteName)} · <a href="${e(brand.site)}" style="color:${C.sub}">${e(host)}</a>${contact.length ? `<br>${contact.join(' · ')}` : ''}
<br>This email was sent automatically.
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    brand.instituteName,
    '',
    c.heading,
    '',
    ...(c.greeting ? [c.greeting, ''] : []),
    ...c.paragraphs.flatMap((t) => [t, '']),
    ...(c.code ? [`Code: ${c.code}`, ''] : []),
    ...(c.rows ?? []).map((r) => `${r.label}: ${r.value}`),
    ...(c.rows?.length ? [''] : []),
    ...(c.button ? [`${c.button.label}: ${c.button.url}`, ''] : []),
    ...(c.footnote ? [c.footnote, ''] : []),
    `${brand.instituteName} · ${host}`,
    ...(contact.length ? [[brand.contactPhone, brand.contactEmail].filter(Boolean).join(' · ')] : []),
  ].join('\n');

  return { html, text };
}
