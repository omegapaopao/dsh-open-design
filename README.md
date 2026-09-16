# dsh-open-design

An **OpenDesign bridge for DeepSeek Harness (`dsh`)** — installs OpenDesign's
rendering templates, brand-grade design systems, and anti-slop design gate as
**52 native `dsh` skills**, so a one-sentence request in `dsh` produces a
finished, self-contained HTML page instead of generic AI markup.

OpenDesign ships as a desktop app and as skills for Claude Code / Codex / Cursor
and friends. It has no `dsh` integration of its own, so this project packages the
part that matters — the skills and token contracts — into a plugin `dsh` can
mount.

## What you get

| | |
|---|---|
| **28 rendering templates** | `web-prototype`, `saas-landing`, `dashboard`, `pricing-page`, `docs-page`, `blog-post`, `faq-page`, `waitlist-page`, `contact-widget`, `magazine-poster`, `social-carousel`, `email-marketing`, `live-artifact`, `live-dashboard`, `github-dashboard`, `kanban-board`, `mobile-app`, `mobile-onboarding`, `pm-spec`, `team-okrs`, `weekly-update`, `critique`, `tweaks`, `motion-frames`, `guizang-ppt`, `simple-deck`, and three `web-prototype-taste-*` variants |
| **23 craft skills** | `taste-skill`, `soft-skill`, `brutalist-skill`, `minimalist-skill`, `emil-design-eng`, `emilkowalski-motion`, `review-animations`, `web-design-guidelines`, `frontend-design`, `impeccable-design-polish`, `redesign-skill`, `image-to-code-skill`, `web-clone`, `design-brief`, `design-review`, `reference-design-contract`, `writing-guidelines`, `output-skill`, `brand-extract`, `deck-swiss-international`, `gpt-tasteskill`, `ui-ux-pro-max`, `faq-page` |
| **32 design systems** | `tokens.css` + `DESIGN.md` + `manifest.json` per system: `apple`, `stripe`, `vercel`, `linear-app`, `notion`, `figma`, `supabase`, `airbnb`, `shopify`, `nvidia`, `tesla`, `spotify`, `github`, `openai`, `xiaohongshu`, plus style systems (`editorial`, `minimal`, `brutalism`, `glassmorphism`, `bento`, `mono`, `retro`, …) |
| **1 router skill** | `open-design` — the workflow that binds a template to a token contract and enforces the gate |

Total ~2.6 MB of plain files. No runtime dependencies, no network calls at use
time.

## How it works

`dsh` profiles compose an ordered stack of plugin bundles. A bundle is an npm
package that declares `dsh.bundle.patch`, and that patch can mount
`@deepseek-ai/dsh-skill-filesystem` pointed at a directory of `SKILL.md`
bundles:

```yaml
# dsh-open-design/cordis.patch.yml
- insert:
    - id: open-design-skill-filesystem
      name: '@deepseek-ai/dsh-skill-filesystem'
      config:
        providerName: open-design
        includeDefaultRoots: false
        bundledSkillDir: !!js ...createRequire(baseUrl).resolve('dsh-open-design/package.json'), 'skills')
```

The skill root is resolved from the installed npm identity anchored at the
profile, exactly as `@tt-a1i/archify-dsh` does — that package is the working
precedent this one mirrors.

## Install

Requires `dsh` with a profile, and `pnpm` for the documented path.

### Option A — the documented path

```powershell
dsh plugin --profile web add "E:\path\to\dsh-open-design"
```

This forwards to `pnpm` and then reconciles `dsh.profile.bundles` automatically:
pnpm writes the real installed name, and any dependency whose package declares
`dsh.bundle` joins the layer stack.

> **If `dsh web` is currently running, this may fail** on Windows:
> pnpm re-resolves the whole profile tree and then tries to swap packages the
> live server already has mapped, which Windows refuses:
> `failed to remove existing directory "...\lightningcss-win32-x64-msvc" prior to swap: Access is denied`.
> The failure is clean — the profile manifest is left untouched — but nothing is
> installed. Stop the server first, or use Option B.

### Option B — link by hand, no pnpm

`loadProfileDirectory` resolves each `dsh.profile.bundles` entry through plain
Node `node_modules` lookup and **never consults `dependencies`**, so a junction
plus one bundles entry is a complete install:

```powershell
New-Item -ItemType Junction `
  -Path   "$env:DSH_HOME\profiles\web\node_modules\dsh-open-design" `
  -Target "E:\path\to\dsh-open-design"

# then append "dsh-open-design" to dsh.profile.bundles in
# $env:DSH_HOME\profiles\web\package.json
```

### Then restart once

A **bundle** change is resolved into the layer stack at boot, so the plugin
enters the skill catalog on the next start of `dsh web`.

After that you do **not** need to restart for skill work: the filesystem provider
watches its root, and adding, removing or renaming a skill directory propagates
without a restart.

## Verify

```powershell
# 1 · did DSH compose the layer, and is it enabled?
dsh --profile web --dump-config | Select-String 'open-design' -Context 2,6
```

The composed tree must contain `open-design-skill-filesystem` with **no
`disabled:` key**. (`--dump-config` needs write access to the profile directory,
because it rewrites `cordis.yml` before dumping.)

```powershell
# 2 · do the skills satisfy DeepSeek Harness' real discovery rules?
node tools/od-validate-skills.mjs dsh-open-design/skills
```

This is a line-for-line replica of the provider's `parseFrontmatter`,
`parseInvocationPolicy` and the registry's `SKILL_NAME` regex, driven by the
same `yaml` parser the provider loads. It matters because the provider *throws*
on legacy camelCase invocation keys, so one bad file is not merely skipped.
Expected: `discovered: 52 … VALID`.

## Rebuild, or curate your own selection

`selection.json` lists exactly which upstream packages are bundled. Edit it, then:

```powershell
node tools/gh-tree.mjs nexu-io/open-design main tree.json
node tools/od-build.mjs tree.json selection.json dsh-open-design
```

`gh-tree.mjs` fetches the upstream file tree in one API request;
`od-build.mjs` downloads only text resources with 8-way concurrency, rewrites
any non-kebab frontmatter `name` to match its directory, and reports what it
skipped.

> Build to a new directory, validate, then swap. Replacing the live directory in
> place fails while `dsh web` runs — the watcher holds it, and Windows refuses
> the rename.

## Known limitations

- **A later `pnpm install` prunes a hand-linked install.** Option B above leaves
  the package out of `dependencies` and the lockfile, so pnpm treats the junction
  as extraneous and removes it — while the `bundles` entry remains, and the
  loader then **throws** rather than degrading:
  `cannot resolve profile bundle "dsh-open-design"`. Recreate the junction.
- **Only one accent per screen.** Every template enforces this, and the sticky
  nav is the trap: a filled accent button there is present on *every* screen and
  spends the budget three times over. Keep the nav CTA neutral.
- **`tokens.css` outranks `DESIGN.md` on values.** They disagree upstream — the
  Markdown side carries generic style-foundation boilerplate while the compiled
  token file matches the actual design language.
- **CJK copy needs an explicit display face.** The templates' Latin serif stack
  carries no Chinese glyphs, so `h1`/`h2` silently fall back to sans and the
  "serif display" law fails invisibly.
- **`review-animations` is deliberately model-invisible.** Its upstream
  frontmatter sets `disable-model-invocation: true`; it is user-invocable only.

## Verify a page you generated

```powershell
node tools/od-check.mjs path/to/index.html
```

Runs the design gate as code: stray hex, display-face binding, accent roles per
screen, `data-od-id` coverage, image locality and resolvability, emoji, mobile
reflow, self-containment, motion discipline (no `transition: all`, no bare
`ease-in`, no `scale(0)`, duration ceilings), inline-script syntax, and the
invariant that **no base selector hides content** — hidden states must live in
`@keyframes` or behind a class the inline script adds.

`_selftest/` holds fixtures for that last check: `violating.html` must fail it and
`compliant.html` must pass, so the check cannot silently become a no-op.

## Examples

`examples-web-prototype/index.html` is a page generated through the bridge —
the `web-prototype` seed bound to the `editorial` design system — and it is
deliberately image-free: no photographs, no external requests, 19 KB, one file.
Open it directly. It exercises the seed's typography, spacing and accent
discipline without depending on any asset this repository would have to
redistribute.

## Licence and attribution

Apache-2.0 for this repository. The bundled skill content is OpenDesign's, also
Apache-2.0, and 15 bundled skills ship their own licence files which are
preserved alongside them. **Read [`NOTICE`](NOTICE)** — it records the upstream
revision, the one modification applied, and every component licence.

## Credits

- [OpenDesign](https://github.com/nexu-io/open-design) — the skills and design
  systems this bridges. Apache-2.0.
- [archify](https://github.com/tt-a1i/archify) — its DeepSeek Harness
  integration established the skill-provider pattern used here.
- [Emil Kowalski](https://animations.dev/) — the motion philosophy behind
  `emil-design-eng`, whose review checklist is encoded in `tools/od-check.mjs`.
