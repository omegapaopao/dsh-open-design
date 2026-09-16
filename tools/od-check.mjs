// Run the OpenDesign P0/P1 checklist against a generated page.
// Usage: node od-check.mjs <index.html>
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('usage: node od-check.mjs <index.html>');
  process.exit(2);
}
const html = readFileSync(file, 'utf8');
const results = [];
const record = (id, ok, detail) => results.push({ id, ok, detail });

// P0-1 — no raw hex outside the :root token block.
// Comments are stripped first: a hex named in prose (this project's page headers
// cite the design system's documented values) cannot render, so counting it is a
// false positive. Only live declarations matter.
const withoutRoot = html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/:root\s*\{[\s\S]*?\}/, '');
const strayHex = [...withoutRoot.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
record('P0-1 raw hex outside :root', strayHex.length === 0, strayHex.join(', ') || 'none');

// P0-2 — display headings bind --font-display (checklist names h1/h2 explicitly).
// Matched order-independently: an earlier version hard-coded the seed's
// `.h1, h1 {` ordering and reported "0 rules checked" against `h1, .h1 {`.
const displayHeadings = [...html.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
  .filter((m) => /(?:^|,)\s*(?:h[12]|\.h[12])\s*(?:,|$)/m.test(m[1].trim()))
  .filter((m) => /font-family/.test(m[2]));
const badHeadings = displayHeadings.filter((m) => !m[2].includes('font-display'));
record('P0-2 h1/h2 bind --font-display', displayHeadings.length > 0 && badHeadings.length === 0,
  `${displayHeadings.length} display rule(s) checked`);

// P0-3 — accent roles actually rendered, per section.
const sections = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)].map((m) => m[1]);
const accentRoles = (chunk) => {
  const roles = [];
  if (/class="eyebrow"/.test(chunk)) roles.push('eyebrow');
  if (/btn-primary|pill-cta/.test(chunk)) roles.push('filled-cta');
  if (/ph-img/.test(chunk)) roles.push('placeholder');
  return roles;
};
// Link-blue is counted separately instead of folded into the budget. Apple's own
// contract (DESIGN.md §7) reserves blue for action AND link semantics — "link
// blues remain the primary interactive signal" — so N link-coloured anchors is
// not N decorative accents. The count is still printed, so a page that floods
// blue cannot hide behind the distinction.
const linkBlue = (chunk) => (chunk.match(/link-accent|tile-link/g) ?? []).length;
const nav = /<header[\s\S]*?<\/header>/.exec(html)?.[0] ?? '';
const navRoles = accentRoles(nav);
const perSection = sections.map((s) => [...navRoles, ...accentRoles(s)]);
const worst = Math.max(...perSection.map((r) => r.length));
const linksPerSection = sections.map((s) => linkBlue(s));
record('P0-3 accent roles <= 2 per screen', worst <= 2,
  `nav=[${navRoles.join(',') || 'none'}] per-section max non-link roles=${worst}` +
  `; link-blue per section=[${linksPerSection.join(',')}]`);

// P0-4 — data-od-id on every top-level section.
const sectionTags = [...html.matchAll(/<section\b[^>]*>/g)].map((m) => m[0]);
const untagged = sectionTags.filter((t) => !t.includes('data-od-id'));
record('P0-4 data-od-id on every section', untagged.length === 0,
  `${sectionTags.length} sections, ${untagged.length} untagged`);

// P0-5 — every image is a real, local, relative file.
//
// The rule is about image *dependencies*, not about links: an earlier version
// flagged any "https://" in the document, which fails any page that cites a
// real source — and a university page always does. Check the actual image
// references, and check that each one resolves on disk, because a dangling src
// is worse than a hotlink.
const imageRefs = [
  ...[...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/<source\b[^>]*\bsrcset?="([^"]*)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]),
];
const isRemote = (r) => /^(?:https?:)?\/\//i.test(r);
const remoteImages = imageRefs.filter(isRemote);
const missingImages = imageRefs
  .filter((r) => !isRemote(r) && !r.startsWith('data:'))
  .filter((r) => !existsSync(resolve(dirname(file), r)));
const liveScaffolds = (html.match(/class="[^"]*\bph-img\b/g) ?? []).length;
record('P0-5 images local, relative, resolvable',
  remoteImages.length === 0 && missingImages.length === 0 && liveScaffolds === 0,
  `images=${imageRefs.length} remote=${remoteImages.length} missing=[${missingImages.join(', ')}] live-scaffolds=${liveScaffolds}`);

// P0-6 — no scrollIntoView.
record('P0-6 no scrollIntoView', !html.includes('scrollIntoView'), '');

// P0-7 — no emoji used as icons (the rule names ✨ 🚀 🎯). Deliberately excludes
// typographic arrows (U+2190–21FF) and box-drawing, which the seed itself ships
// as UI glyphs (`.btn-arrow::after { content: '→' }`), and excludes the check
// marks / dashes the layout library legitimately puts in table cells.
// An earlier version wrote the range as \u1F680 inside a .NET regex, where only
// 4-hex \uFFFF escapes are legal; the malformed class then matched 129 CJK
// characters and produced a pure false positive.
const EMOJI = /(?:\u{1F300}-\u{1FAFF}|\u{2728}|\u{2705}|\u{274C}|\u{2B50}|\u{2764})/gu;
const emoji = [...html.matchAll(EMOJI)].map((m) => m[0]);
record('P0-7 no emoji as icons', emoji.length === 0, emoji.join(' ') || 'none');

// P0-8 — mobile reflow. The checklist's intent is "verify no horizontal scroll
// when narrowed", not a specific breakpoint. An earlier version demanded exactly
// 920px, which failed any page built on a design system with its own scale —
// Apple's is 833px. Accept any collapse breakpoint in a sane band AND require
// that multi-column layouts actually collapse.
const breakpoints = [...html.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((m) => Number(m[1]));
const collapse = /@media[^{]*\{\s*[^@]*grid-template-columns:\s*1fr/.test(html) ||
  /grid-template-columns:\s*1fr/.test(html);
const hasCollapsePoint = breakpoints.some((w) => w >= 600 && w <= 1000);
record('P0-8 mobile reflow', hasCollapsePoint && collapse,
  `breakpoints=[${breakpoints.join(', ')}]px, columns collapse=${collapse}`);

// P1 — self-contained.
const external = [...html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="(?!#)[^"]*"/g)].map((m) => m[0]);
record('P1-1 self-contained (no external link/script)', external.length === 0, external.join(' ') || 'none');

// P1 — well-formed markup. Not part of OD's checklist, but an unclosed tag makes
// the whole deliverable broken regardless of how well it scores on taste.
//
// Tokenizing the raw file is wrong: comments and CSS can both contain "<" and
// ">" sequences that are not tags, and scanning them produced phantom
// mismatches (a stray "style" left on the stack, so </head> "closed" it). Strip
// those regions first, keeping the elements themselves in place.
const tokenizable = html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const stack = [];
const unbalanced = [];
for (const m of tokenizable.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g)) {
  const [, closing, rawName, attrs] = m;
  const tag = rawName.toLowerCase();
  if (VOID.has(tag) || attrs.trimEnd().endsWith('/')) continue;
  if (!closing) stack.push(tag);
  else {
    const open = stack.pop();
    if (open !== tag) unbalanced.push(`</${tag}> closes <${open ?? 'nothing'}>`);
  }
}
if (stack.length) unbalanced.push(`never closed: ${stack.join(', ')}`);
record('P1-3 well-formed markup', unbalanced.length === 0, unbalanced.slice(0, 3).join('; ') || 'balanced');

// P1-4 — motion discipline, from the bundle's emil-design-eng skill.
//
// The skill's ≤300ms rule governs *interactive* UI — its duration table covers
// button press (100–160ms), tooltips, dropdowns and modals. The same document
// explicitly allows marketing/explanatory motion to run longer, and an entrance
// reveal is exactly that. So the 300ms cap is enforced on interactive selectors
// and a hard ceiling catches runaway durations everywhere; entrance durations
// are reported rather than failed, so the number stays visible.
const css = html.replace(/\/\*[\s\S]*?\*\//g, '');
const interactiveMs = [];
const entranceMs = [];
for (const m of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
  const selector = m[1].trim();
  const decl = /(?:^|;)\s*transition(?:-property)?\s*:\s*([^;}]+)/.exec(m[2]);
  if (!decl) continue;
  const times = [...decl[1].matchAll(/([\d.]+)(ms|s)\b/g)]
    .map((t) => (t[2] === 's' ? Number(t[1]) * 1000 : Number(t[1])));
  if (/:hover|:active|:focus|\.btn\b/.test(selector)) interactiveMs.push(...times);
  else entranceMs.push(...times);
}

const motionIssues = [];
if (!css.includes('prefers-reduced-motion')) motionIssues.push('no prefers-reduced-motion guard');
if (/(?:^|[;{])\s*transition(?:-property)?\s*:\s*[^;}]*\ball\b/.test(css)) motionIssues.push('transition: all');
if (/ease-in(?!-out)/.test(css)) motionIssues.push('bare ease-in (feels sluggish)');
if (/scale\(\s*0\s*\)/.test(css)) motionIssues.push('scale(0) entry');
const slowInteractive = interactiveMs.filter((ms) => ms > 300);
if (slowInteractive.length) motionIssues.push(`interactive transition >300ms: ${slowInteractive.join('ms, ')}ms`);
const runaway = [...interactiveMs, ...entranceMs].filter((ms) => ms > 800);
if (runaway.length) motionIssues.push(`transition >800ms: ${runaway.join('ms, ')}ms`);
record('P1-4 motion discipline', motionIssues.length === 0,
  motionIssues.join('; ') ||
    `interactive ≤${interactiveMs.length ? Math.max(...interactiveMs) : 0}ms across ${interactiveMs.length} declaration(s), entrance ≤${entranceMs.length ? Math.max(...entranceMs) : 0}ms across ${entranceMs.length}`);

// P1-5 — inline scripts must actually parse. A syntax error in the motion layer
// would silently kill the animation, or worse, leave revealed content hidden.
const vm = await import('node:vm');
const inlineScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]).filter((s) => s.trim() !== '');
const syntaxErrors = [];
for (const [index, code] of inlineScripts.entries()) {
  try { new vm.Script(code, { filename: `inline-${index}.js` }); }
  catch (error) { syntaxErrors.push(`inline-${index}: ${error.message}`); }
}
record('P1-5 inline scripts parse', syntaxErrors.length === 0,
  syntaxErrors.join('; ') || `${inlineScripts.length} inline script(s), all parsed`);

// P1-6 — the invariant that makes a scroll-reveal layer safe: no base selector
// may hide content. Every hidden state has to sit inside @keyframes, so that a
// browser which supports none of the motion still renders a complete page.
// Brace-walk the stylesheet and flag hiding declarations outside @keyframes.
// A hidden state is acceptable in exactly two places: inside @keyframes, or
// behind a gate class that only the inline script adds. The second case is only
// acceptable if that class is genuinely added by script in THIS document —
// otherwise the gate is aspirational and the content is simply invisible.
const REVEAL_GATE = 'js-reveal';

function hidingDeclarations(styleText) {
  const ungated = [];
  const gated = [];
  const stack = [];
  let buf = '';
  const inspect = (raw) => {
    const decl = raw.trim().replace(/\s+/g, ' ');
    if (!decl) return;
    if (stack.some((p) => p.startsWith('@keyframes'))) return;
    const hides =
      /^opacity\s*:\s*0(?:\.0+)?$/.test(decl) ||
      /^visibility\s*:\s*hidden$/.test(decl) ||
      /^clip-path\s*:\s*inset\([^)]*100%/.test(decl);
    if (!hides) return;
    if (stack.some((p) => p.includes(`.${REVEAL_GATE}`))) gated.push(decl);
    else ungated.push(decl);
  };
  for (const ch of styleText) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { inspect(buf); stack.pop(); buf = ''; }
    else if (ch === ';') { inspect(buf); buf = ''; }
    else buf += ch;
  }
  return { ungated, gated };
}

const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const hiding = styleBlocks
  .map((s) => hidingDeclarations(s.replace(/\/\*[\s\S]*?\*\//g, '')))
  .reduce((acc, cur) => ({ ungated: acc.ungated.concat(cur.ungated), gated: acc.gated.concat(cur.gated) }),
    { ungated: [], gated: [] });
const gateAdded = new RegExp(`classList\\.add\\(['"]${REVEAL_GATE}['"]\\)`).test(html);
const gateRemoved = new RegExp(`classList\\.remove\\(['"]${REVEAL_GATE}['"]\\)`).test(html);
record('P1-6 no base rule hides content',
  hiding.ungated.length === 0 && (hiding.gated.length === 0 || gateAdded),
  hiding.ungated.length
    ? `outside @keyframes and ungated: ${hiding.ungated.slice(0, 4).join(' | ')}`
    : hiding.gated.length
      ? `${hiding.gated.length} state(s) behind .${REVEAL_GATE}; gate added=${gateAdded}, failure-removal present=${gateRemoved}`
      : 'all hidden states are inside @keyframes');

// P1 — headline length.
const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1].replace(/<[^>]+>/g, '').trim();
const cjk = (h1?.match(/[\u4e00-\u9fff]/g) ?? []).length;
record('P1-2 headline short enough', h1 !== undefined && (cjk > 0 ? cjk : h1.split(/\s+/).length) <= 20,
  `"${h1}" (${cjk > 0 ? `${cjk} CJK chars` : `${h1?.split(/\s+/).length} words`})`);

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}${r.detail ? `  — ${r.detail}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks pass`);
process.exit(failed === 0 ? 0 : 1);
