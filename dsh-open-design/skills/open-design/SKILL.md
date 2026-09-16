---
name: open-design
description: >-
  Route any web page, landing page, dashboard, deck, or UI request through
  OpenDesign's rendering templates and brand-grade design systems. Binds a
  template seed plus a real token contract, then enforces the P0 anti-slop
  checklist so the output is a finished page rather than generic AI markup.
  Use whenever the user asks to build, design, restyle, or redesign a page,
  screen, prototype, or deck.
---

# OpenDesign bridge

This bundle ships two OpenDesign (OD) assets into DeepSeek Harness:

1. **Rendering templates** — sibling skills in this same bundle:
   `web-prototype`, `saas-landing`, `dashboard`, `pricing-page`, `docs-page`,
   `blog-post`, `waitlist-page`, `contact-widget`, `magazine-poster`,
   `social-carousel`, `email-marketing`, `live-artifact`, `live-dashboard`,
   `github-dashboard`, `kanban-board`, `mobile-app`, `mobile-onboarding`,
   `pm-spec`, `team-okrs`, `weekly-update`, `faq-page`, `critique`, `tweaks`,
   `guizang-ppt`, `simple-deck`, `web-prototype-taste-*` and more. Each carries
   a seed `assets/template.html` and paste-ready section skeletons in
   `references/layouts.md`. **The template's own `SKILL.md` is the authority on
   its workflow — load it with the `skill` tool and follow it.**
2. **Design systems** — `design-systems/<name>/` under this skill's base
   directory: `DESIGN.md` (the brand contract), `tokens.css` (real CSS custom
   properties), `manifest.json`.

Craft skills that shape taste and polish rather than layout:
`taste-skill`, `soft-skill`, `brutalist-skill`, `minimalist-skill`,
`gpt-tasteskill`, `web-design-guidelines`, `frontend-design`,
`impeccable-design-polish`, `emil-design-eng`, `redesign-skill`,
`image-to-code-skill`, `design-review`, `design-brief`,
`reference-design-contract`, `writing-guidelines`, `web-clone`,
`brand-extract`, `ui-ux-pro-max`, `deck-swiss-international`.

## Workflow

**Step 0 — ask only what actually changes the output.** If the brief is one
sentence, do not interrogate: state the template + design system you picked,
the section list, and the accent budget in one short line, then build. The user
redirects cheaply at that point; they cannot redirect after 200 lines of HTML.

**Step 1 — pick one template skill.** Landing/marketing → `saas-landing` or
`web-prototype`; app UI → `dashboard`; mobile → `mobile-app`; slides →
`guizang-ppt` / `simple-deck`; docs → `docs-page`. If the request has no clear
match, `web-prototype` is the default.

**Step 2 — pick one design system and READ ITS TOKENS.** Open
`design-systems/INDEX.md` (this skill's base directory) for the catalog, then
read `design-systems/<name>/tokens.css` for the real values and
`design-systems/<name>/DESIGN.md` for the usage rules, voice, and
anti-patterns. Map those values onto the seed's `:root` variables — **never
invent colors from memory, and never hand-tune a hex you did not read.**
If the user names a brand that exists in the library, that choice wins.

> **`tokens.css` outranks `DESIGN.md` on values.** They disagree in this
> catalog: `editorial/DESIGN.md` advertises primary `#111111` and surface
> `#FFFFFF`, while `editorial/tokens.css` carries the actual curated palette
> (`--accent: #9a5a2f`, `--bg: #fbf7f0`). The Markdown side is style-foundation
> boilerplate — it even names typefaces (`Gelasio`, `Ubuntu Mono`) that appear
> nowhere else. The compiled token file is self-consistent with its own header
> and with the rendering templates, so take values from `tokens.css` and take
> rules, voice, and anti-patterns from `DESIGN.md`.

**Step 3 — load the template skill.** Call `skill` with the template's exact
name. It returns a base directory; resolve `assets/template.html`,
`references/layouts.md`, and `references/checklist.md` against it. **Read the
seed end-to-end before writing anything** — the seed already encodes
typography, spacing, and accent budget, and the class inventory must exist in
its `<style>` block.

**Step 4 — compose, don't invent.** Start from the seed; paste the chosen
section skeletons from `references/layouts.md` and replace every bracketed
placeholder with specific copy from the brief. If a slot has nothing real to
fill it, the section is the wrong choice — pick a different layout rather than
padding it with filler.

**Step 5 — run the P0 gate.** Walk `references/checklist.md`. Every P0 item
must pass before you deliver; P1 should pass. Fix and re-check rather than
shipping a known failure.

**Step 6 — write the file and report once.** Write the finished page to
`index.html` (or the project's stated entry file) and close with one short
summary naming the file, the template, the design system, and any deliberate
limitation. Do not paste the HTML source into chat.

## Non-negotiables (inherited from OpenDesign)

- **Exactly one accent**, used at most twice per screen — eyebrow plus primary
  CTA is the default budget.
- **Serif display, sans body, mono for numerics/captions/eyebrows.** A single
  sans used as the display face is the most common tell of generated UI.
- **Banned outright:** aggressive purple-to-blue gradients on white, emoji as
  icons, rounded cards with a thick left accent bar, hand-drawn SVG humans,
  invented metrics ("10× faster") with nothing behind them.
- **Honest placeholders beat fake data** — an em dash or a labelled grey block
  is correct when no real number exists.
- **Imagery must be real.** Never hotlink a remote image into a deliverable and
  never fabricate a real-world referent. Fetch or generate a genuine asset; if
  none is compliant, keep an intentional labelled placeholder and say so in the
  delivery summary.
- **One self-contained HTML file** with the seed's mobile reflow left intact —
  do not add fixed widths that break the 920px media query.
- **Every `<section>` carries `data-od-id`**, and real content images get
  matching intrinsic `width`/`height` with no `object-fit: cover` cropping.

## Field notes measured in this installation

**The sticky topnav CTA is the accent-budget trap.** The seed ships a
`.btn-primary` inside `<header class="topnav">`, which is `position: sticky` and
therefore present on *every* screen. Spending accent there makes a hero screen
show three accent roles at once (nav button + eyebrow + hero CTA) and fails the
≤2 rule. Demote the nav CTA to `.btn-secondary` and keep the section-level
primary CTA as the one filled accent. Do **not** "fix" the budget by demoting
the seed's accent-coloured `.stat-num` — the stat numbers are not the problem.

**CJK copy needs an explicit display-face fallback.** The seed's
`--font-display` is `'Iowan Old Style', 'Charter', Georgia, serif`; none of
those carry Chinese glyphs, so `h1`/`h2` silently render in a sans fallback and
the "serif display" law fails invisibly. When the page is Chinese, extend the
stack, e.g. `..., Georgia, 'Songti SC', 'Noto Serif CJK SC', 'Source Han Serif
SC', serif`, and add a CJK sans (`'PingFang SC'`, `'Microsoft YaHei'`) to
`--font-body`. Chinese body text in sans and headings in serif is the readable
choice, even where a design system specifies a serif body.

**`h3` legitimately stays sans.** The P0 line "All headings use
`var(--font-display)`" is clarified by its own next clause — "No sans-serif
`<h1>` / `<h2>`". The seed leaves `.h3` on the body face for UI-level headings.
Do not "fix" this either; a checker that demands `font-display` on `h3` is
stricter than the rule.

**Typographic arrows are not emoji.** `.btn-arrow::after { content: '→' }` ships
in the seed. A naive emoji scan that includes U+2190–U+21FF will flag it, and
writing such a class as `\u1F680` in a .NET/PowerShell regex is illegal (only
4-hex `\uFFFF` escapes are) — the malformed class matches large ranges of CJK
text and reports hundreds of phantom hits.

**Verify mechanically, do not eyeball it.** `node tools/od-check.mjs
<index.html>` runs the P0 gate as code (stray hex, display-face binding, accent
roles per screen, `data-od-id`, remote/leftover imagery, emoji, 920px reflow,
self-containment). A page is not delivered until it reports `N/N checks pass`.

## Notes on OD-app-only behaviour

The upstream templates assume the OpenDesign daemon injects the active
`DESIGN.md` into the system prompt and derives its preview from the written
project file. In DeepSeek Harness nothing is injected: **you** read the token
files in Step 2, and the written file *is* the deliverable. Skills that emit
app-side manifests — `tweaks` (tweaks-panel manifest) and `critique`
(five-dimension scoresheet) — still work as review aids; just treat their
output as a report for the user, not something the harness consumes.
