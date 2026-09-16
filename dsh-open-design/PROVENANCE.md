# Provenance

Bundled skill content is derived from [nexu-io/open-design](https://github.com/nexu-io/open-design)
at ref `main` (tree `eca7c7ab989852fb586384e19bcb6a6f2d7321f4`), fetched 2026-09-16T06:42:14.229Z.

- Upstream license: Apache-2.0. Bundled skills that carry their own `LICENSE`
  files retain those licenses.
- Only text resources are bundled (`.md .html .css .js .mjs .json .txt .yaml .yml .svg`);
  upstream preview images and example binaries are omitted.
- Each upstream `SKILL.md` is copied verbatim except that a missing or
  non-kebab-case `name` field is rewritten to match its directory, as DeepSeek
  Harness requires.
- `skills/open-design/` is authored for this bridge (router instructions plus
  the `design-systems/` token library); it does not exist upstream.

Regenerate with `node tools/od-build.mjs`.
