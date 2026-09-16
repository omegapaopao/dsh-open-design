// Build the dsh-open-design skill plugin from the OpenDesign repository tree.
//
//   node od-build.mjs <tree.json> <selection.json> <outDir>
//
// Downloads the selected SKILL.md bundles + design-system token files from
// raw.githubusercontent.com (Node's OpenSSL TLS stack), validates every skill
// against DeepSeek Harness discovery rules, and scaffolds the plugin package.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';

const [treeFile, selectionFile, outDir] = process.argv.slice(2);
if (!treeFile || !selectionFile || !outDir) {
  console.error('usage: node od-build.mjs <tree.json> <selection.json> <outDir>');
  process.exit(2);
}

const selection = JSON.parse(readFileSync(selectionFile, 'utf8'));
const tree = JSON.parse(readFileSync(treeFile, 'utf8'));
const blobs = new Map(tree.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.size ?? 0]));

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const textExt = new Set(selection.textExtensions);

// ---------------------------------------------------------------- plan files

/** @type {{src:string,dest:string}[]} */
const plan = [];
const problems = [];

function addPackage(srcDir, destDir, filter) {
  const prefix = `${srcDir}/`;
  const files = [...blobs.keys()].filter((p) => p.startsWith(prefix));
  if (files.length === 0) {
    problems.push(`missing package in tree: ${srcDir}`);
    return 0;
  }
  let n = 0;
  for (const f of files) {
    const rel = f.slice(prefix.length);
    if (!filter(rel)) continue;
    plan.push({ src: f, dest: posix.join(destDir, rel) });
    n += 1;
  }
  return n;
}

const skipBinary = (rel) => textExt.has(rel.slice(rel.lastIndexOf('.')));

let templateFiles = 0;
for (const name of selection.templates) {
  if (!KEBAB.test(name)) problems.push(`non-kebab template name: ${name}`);
  templateFiles += addPackage(`design-templates/${name}`, `skills/${name}`, skipBinary);
}

let skillFiles = 0;
for (const name of selection.skills) {
  if (!KEBAB.test(name)) problems.push(`non-kebab skill name: ${name}`);
  skillFiles += addPackage(`skills/${name}`, `skills/${name}`, skipBinary);
}

// A skill dir claimed by both source trees would silently merge two bundles.
const pkgSources = new Map();
for (const p of plan) {
  const [pkgTop, pkgName] = p.dest.split('/');
  if (pkgTop !== 'skills') continue;
  if (!pkgSources.has(pkgName)) pkgSources.set(pkgName, new Set());
  pkgSources.get(pkgName).add(p.src.split('/').slice(0, 2).join('/'));
}
for (const [pkgName, sources] of pkgSources) {
  if (sources.size > 1) problems.push(`skill dir claimed by multiple sources: ${pkgName} <- ${[...sources].join(', ')}`);
}

let dsFiles = 0;
for (const brand of selection.designSystems) {
  for (const file of selection.designSystemFiles) {
    const src = `design-systems/${brand}/${file}`;
    if (!blobs.has(src)) {
      problems.push(`missing design system file: ${src}`);
      continue;
    }
    plan.push({ src, dest: `skills/open-design/design-systems/${brand}/${file}` });
    dsFiles += 1;
  }
}

console.log(`planned: ${plan.length} files (templates ${templateFiles}, skills ${skillFiles}, design-systems ${dsFiles})`);
console.log(`planned bytes: ${(plan.reduce((a, p) => a + (blobs.get(p.src) ?? 0), 0) / 1024).toFixed(0)} KB`);
if (problems.length) console.log(`problems:\n  ${problems.join('\n  ')}`);

// ---------------------------------------------------------------- download

const base = `https://raw.githubusercontent.com/${selection.repo}/${selection.ref}/`;
const results = { ok: 0, failed: [] };

async function fetchOne(src) {
  const url = base + src.split('/').map(encodeURIComponent).join('/');
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'dsh-open-design-bridge' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  throw new Error(`${src}: ${lastError?.message}`);
}

const queue = [...plan];
let done = 0;
async function worker() {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    try {
      const buf = await fetchOne(item.src);
      const target = join(outDir, item.dest);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, buf);
      results.ok += 1;
    } catch (error) {
      results.failed.push(String(error.message));
    }
    done += 1;
    if (done % 25 === 0) console.log(`  ${done}/${plan.length} files`);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));
console.log(`downloaded ${results.ok}/${plan.length}`);
if (results.failed.length) {
  console.log(`failures:\n  ${results.failed.join('\n  ')}`);
  process.exit(1);
}

// ------------------------------------------------- validate / sanitize skills

const skillsRoot = join(outDir, 'skills');
const entries = [];
const bundles = readdirSync(skillsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());

let sanitized = 0;
for (const bundle of bundles) {
  const dir = bundle.name;
  const skillFile = join(skillsRoot, dir, 'SKILL.md');
  // `open-design` is the hand-written router skill: design-systems/ is nested
  // data, intentionally not a discovered bundle.
  if (!existsSync(skillFile)) {
    problems.push(`bundle without SKILL.md (will not be discovered): ${dir}`);
    continue;
  }
  let text = readFileSync(skillFile, 'utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) {
    problems.push(`no YAML frontmatter: ${dir}`);
    continue;
  }
  const block = fm[1];
  const nameLine = /^name:[ \t]*(.+)$/m.exec(block);
  const declared = nameLine ? nameLine[1].trim().replace(/^["']|["']$/g, '') : undefined;
  if (!/^description:/m.test(block)) {
    problems.push(`frontmatter missing description: ${dir}`);
    continue;
  }
  if (declared !== dir || !KEBAB.test(dir)) {
    if (!nameLine) problems.push(`frontmatter missing name, forced to dir: ${dir}`);
    const fixed = block.replace(/^name:.*$/m, `name: ${dir}`);
    const next = nameLine ? fixed : `name: ${dir}\n${block}`;
    text = text.replace(block, next);
    writeFileSync(skillFile, text);
    sanitized += 1;
    entries.push({ dir, declared: declared ?? '(none)', final: dir });
  } else {
    entries.push({ dir, declared, final: dir });
  }
}

console.log(`skills discovered: ${entries.length}, frontmatter sanitized: ${sanitized}`);
if (problems.length) console.log(`validation notes:\n  ${problems.join('\n  ')}`);

// ---------------------------------------------------------------- scaffold

const pkg = {
  name: 'dsh-open-design',
  version: '0.1.0',
  private: true,
  description: 'DeepSeek Harness skill bundle bringing OpenDesign design templates and DESIGN.md design systems into dsh.',
  license: 'Apache-2.0',
  type: 'module',
  main: './lib/index.js',
  exports: { '.': './lib/index.js', './package.json': './package.json' },
  files: ['lib', 'cordis.patch.yml', 'skills', 'README.md', 'PROVENANCE.md', 'LICENSE'],
  keywords: ['dsh-plugin', 'deepseek-harness', 'agent-skill', 'open-design', 'design-system'],
  engines: { node: '^22.19.0 || >=24.0.0' },
  dsh: { bundle: { patch: './cordis.patch.yml' } },
};
writeFileSync(join(outDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

const patch = `# OpenDesign filesystem Skill provider for DeepSeek Harness.
# Resolves the packaged Skill root from the installed npm identity anchored at
# the DSH profile (Loader baseUrl), never as a path concatenated onto baseUrl.
- insert:
    - id: open-design-skill-filesystem
      name: '@deepseek-ai/dsh-skill-filesystem'
      config:
        providerName: open-design
        includeDefaultRoots: false
        bundledSkillDir: !!js process.getBuiltinModule('node:path').join(process.getBuiltinModule('node:path').dirname(process.getBuiltinModule('node:module').createRequire(baseUrl).resolve('dsh-open-design/package.json')), 'skills')
`;
writeFileSync(join(outDir, 'cordis.patch.yml'), patch);

const lib = `import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const name = 'dsh-open-design';
export const PACKAGE_NAME = 'dsh-open-design';

/**
 * Resolve the packaged OpenDesign skill root from the DSH profile.
 * @param {string} profileBaseUrl - the Loader baseUrl of the owning profile.
 * @returns {string} absolute path of the bundled skills directory.
 */
export function resolveOpenDesignSkillRoot(profileBaseUrl) {
  if (!profileBaseUrl) {
    throw new Error('dsh-open-design: missing DSH profile baseUrl for package resolution');
  }
  let manifestPath;
  try {
    manifestPath = createRequire(profileBaseUrl).resolve(\`\${PACKAGE_NAME}/package.json\`);
  } catch (error) {
    throw new Error(
      \`dsh-open-design: cannot resolve \${PACKAGE_NAME}/package.json from the DSH profile\`,
      { cause: error },
    );
  }
  return join(dirname(manifestPath), 'skills');
}
`;
mkdirSync(join(outDir, 'lib'), { recursive: true });
writeFileSync(join(outDir, 'lib', 'index.js'), lib);

const prov = `# Provenance

Bundled skill content is derived from [${selection.repo}](https://github.com/${selection.repo})
at ref \`${selection.ref}\` (tree \`${tree.sha}\`), fetched ${new Date().toISOString()}.

- Upstream license: Apache-2.0. Bundled skills that carry their own \`LICENSE\`
  files retain those licenses.
- Only text resources are bundled (\`${selection.textExtensions.join(' ')}\`);
  upstream preview images and example binaries are omitted.
- Each upstream \`SKILL.md\` is copied verbatim except that a missing or
  non-kebab-case \`name\` field is rewritten to match its directory, as DeepSeek
  Harness requires.
- \`skills/open-design/\` is authored for this bridge (router instructions plus
  the \`design-systems/\` token library); it does not exist upstream.

Regenerate with \`node tools/od-build.mjs\`.
`;
writeFileSync(join(outDir, 'PROVENANCE.md'), prov);

const index = [
  '# Bundled design systems',
  '',
  'Token sources for the OpenDesign router skill. Each directory holds the',
  'upstream `DESIGN.md` contract, compiled `tokens.css`, and `manifest.json`.',
  '',
  ...selection.designSystems.map((b) => `- \`${b}\``),
  '',
].join('\n');
mkdirSync(join(skillsRoot, 'open-design', 'design-systems'), { recursive: true });
writeFileSync(join(skillsRoot, 'open-design', 'design-systems', 'INDEX.md'), index);

console.log(`\nscaffolded plugin at ${outDir}`);
console.log(`  package.json, cordis.patch.yml, lib/index.js, PROVENANCE.md`);
console.log(`  skills/: ${bundles.length} bundles`);
