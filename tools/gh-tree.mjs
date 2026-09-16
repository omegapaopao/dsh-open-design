// Fetch the full recursive git tree of a public GitHub repo (single API request)
// and write it to disk. Usage: node gh-tree.mjs <owner/repo> <ref> <outFile>
import { writeFileSync } from 'node:fs';

const [repo, ref = 'main', out = 'tree.json'] = process.argv.slice(2);
if (!repo) {
  console.error('usage: node gh-tree.mjs <owner/repo> [ref] [outFile]');
  process.exit(2);
}

const url = `https://api.github.com/repos/${repo}/git/trees/${ref}?recursive=1`;
const res = await fetch(url, {
  headers: {
    accept: 'application/vnd.github+json',
    'user-agent': 'dsh-open-design-bridge',
  },
});
if (!res.ok) {
  console.error(`HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}
const data = await res.json();
writeFileSync(out, JSON.stringify(data));

const blobs = data.tree.filter((e) => e.type === 'blob');
const byTop = new Map();
for (const b of blobs) {
  const top = b.path.includes('/') ? b.path.split('/')[0] : '(root)';
  byTop.set(top, (byTop.get(top) ?? 0) + 1);
}
console.log(JSON.stringify({
  truncated: data.truncated,
  totalEntries: data.tree.length,
  blobs: blobs.length,
  totalBlobBytes: blobs.reduce((a, b) => a + (b.size ?? 0), 0),
  topLevel: [...byTop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
}, null, 2));
