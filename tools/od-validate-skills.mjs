// Validate a skills root against DeepSeek Harness' ACTUAL discovery rules.
//
// This is a line-for-line replica of @deepseek-ai/dsh-skill-filesystem's
// parseSkillFile + parseFrontmatter + parseInvocationPolicy, using the same
// `yaml` parser instance the provider uses. It exists because a hand-rolled
// regex check agreed with the provider by luck, not by construction.
//
// Usage: node od-validate-skills.mjs <skillsRoot>
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = process.argv[2];
if (!root) {
  console.error('usage: node od-validate-skills.mjs <skillsRoot>');
  process.exit(2);
}

const require = createRequire(
  'E:/DSH-HOME/profiles/node_modules/@deepseek-ai/dsh-skill-filesystem/lib/index.js',
);
const { parse } = require('yaml');

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function findClosingFrontmatter(raw, start) {
  let lineStart = start;
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf('\n', lineStart);
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline;
    if (raw.slice(lineStart, lineEnd).replace(/\r$/, '') === '---') {
      return { start: lineStart, bodyStart: nextNewline < 0 ? raw.length : nextNewline + 1 };
    }
    if (nextNewline < 0) return void 0;
    lineStart = nextNewline + 1;
  }
}

function parseFrontmatter(raw) {
  const firstLineEnd = raw.indexOf('\n');
  if (firstLineEnd < 0) return void 0;
  if (raw.slice(0, firstLineEnd).replace(/\r$/, '') !== '---') return void 0;
  const start = firstLineEnd + 1;
  const closing = findClosingFrontmatter(raw, start);
  if (closing === void 0) return void 0;
  let parsed;
  try {
    parsed = parse(raw.slice(start, closing.start));
  } catch (error) {
    return { yamlError: String(error) };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return void 0;
  return { data: parsed, body: raw.slice(closing.bodyStart) };
}

const stringField = (data, key) => {
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : void 0;
};

function frontmatterBoolean(data, key) {
  if (!Object.hasOwn(data, key)) return void 0;
  const value = data[key];
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    switch (value.toLowerCase()) {
      case 'true': case 'yes': case 'on': return true;
      case 'false': case 'no': case 'off': return false;
    }
  }
  throw new TypeError(`frontmatter field "${key}" must be a boolean`);
}

function rejectLegacyInvocationKey(data, legacy, canonical) {
  if (Object.hasOwn(data, legacy)) {
    throw new Error(`frontmatter field "${legacy}" is unsupported; use "${canonical}"`);
  }
}

function parseInvocationPolicy(data) {
  rejectLegacyInvocationKey(data, 'disableModelInvocation', 'disable-model-invocation');
  rejectLegacyInvocationKey(data, 'modelInvocable', 'disable-model-invocation');
  rejectLegacyInvocationKey(data, 'userInvocable', 'user-invocable');
  const disableModelInvocation = frontmatterBoolean(data, 'disable-model-invocation');
  const userInvocable = frontmatterBoolean(data, 'user-invocable');
  return { modelInvocable: disableModelInvocation !== true, userInvocable: userInvocable !== false };
}

// ---------------------------------------------------------------- discovery

const entries = readdirSync(root).sort();
const discovered = [];
const skipped = [];
const fatal = [];

for (const entry of entries) {
  const full = join(root, entry);
  const isDir = statSync(full).isDirectory();
  const skillFile = isDir ? join(full, 'SKILL.md') : full.endsWith('.md') ? full : undefined;
  if (skillFile === undefined) continue;
  if (!existsSync(skillFile)) {
    if (isDir) skipped.push({ skill: entry, why: 'directory without SKILL.md (not discovered)' });
    continue;
  }

  const parsed = parseFrontmatter(readFileSync(skillFile, 'utf8'));
  if (parsed === undefined) { skipped.push({ skill: entry, why: 'missing or malformed YAML frontmatter' }); continue; }
  if (parsed.yamlError) { skipped.push({ skill: entry, why: `YAML parse error: ${parsed.yamlError}` }); continue; }

  const name = stringField(parsed.data, 'name');
  const description = stringField(parsed.data, 'description');
  if (name === undefined || description === undefined) {
    skipped.push({ skill: entry, why: 'frontmatter requires non-empty name and description' }); continue;
  }

  let invocation;
  try {
    invocation = parseInvocationPolicy(parsed.data);
  } catch (error) {
    skipped.push({ skill: entry, why: `invalid invocation frontmatter: ${error.message}` }); continue;
  }

  // The registry (dsh-skill) throws on a non-kebab name rather than skipping.
  if (!SKILL_NAME.test(name)) { fatal.push({ skill: entry, name, why: 'invalid kebab-case name' }); continue; }
  if (name !== entry && isDir) {
    fatal.push({ skill: entry, name, why: 'directory name and frontmatter name disagree' }); continue;
  }

  discovered.push({
    dir: entry,
    name,
    invocation,
    descriptionLength: description.length,
    bodyLines: parsed.body.trim().split('\n').length,
  });
}

// A discovered bundle is only useful if the skill's own resources travelled with it.
const withAssets = discovered.filter((d) => existsSync(join(root, d.dir, 'assets')));
const withReferences = discovered.filter((d) => existsSync(join(root, d.dir, 'references')));

console.log(`root: ${root}`);
console.log(`discovered: ${discovered.length}`);
console.log(`  carrying assets/:     ${withAssets.length}`);
console.log(`  carrying references/: ${withReferences.length}`);
console.log(`  model-invocable:      ${discovered.filter((d) => d.invocation.modelInvocable).length}`);

if (skipped.length) {
  console.log(`\nskipped (provider ignores these with a warning): ${skipped.length}`);
  for (const s of skipped) console.log(`  - ${s.skill}: ${s.why}`);
}
if (fatal.length) {
  console.log(`\nFATAL (registry throws on these): ${fatal.length}`);
  for (const s of fatal) console.log(`  - ${s.skill}: ${s.why}`);
}

const dupes = discovered.map((d) => d.name).filter((n, i, a) => a.indexOf(n) !== i);
if (dupes.length) console.log(`\nDUPLICATE names: ${[...new Set(dupes)].join(', ')}`);

const ok = skipped.length === 0 && fatal.length === 0 && dupes.length === 0;
console.log(`\n${ok ? 'VALID' : 'PROBLEMS FOUND'}`);
process.exit(ok ? 0 : 1);
