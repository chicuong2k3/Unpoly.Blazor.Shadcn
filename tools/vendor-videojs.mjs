#!/usr/bin/env node
// Copies the import closure of @videojs/cdn's video.js into wwwroot/videojs.
//   node tools/vendor-videojs.mjs <extracted-package-dir> <tarball-sha256>
// The package's README says "copy every file"; the closure is the subset the player needs, so a
// version bump is: download the tarball, extract it, run this script.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const IMPORT = /(?:from\s*|import\s*\(?\s*|import\s+)["'`](\.[^"'`]+)["'`]/g

export function closureOf(root, entry) {
  const seen = new Set()
  const stack = [entry]
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file)) continue
    const full = path.join(root, file)
    if (!fs.existsSync(full)) throw new Error(`unresolved import: ${file}`)
    seen.add(file)
    const text = fs.readFileSync(full, 'utf8')
    for (const m of text.matchAll(IMPORT)) {
      stack.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])))
    }
  }
  return [...seen].sort()
}

function main() {
  const [pkgDir, sha] = process.argv.slice(2)
  if (!pkgDir || !sha) throw new Error('usage: vendor-videojs.mjs <package-dir> <tarball-sha256>')
  const here = path.dirname(fileURLToPath(import.meta.url))
  const out = path.join(here, '..', 'src', 'Unpoly.Blazor.Shadcn', 'wwwroot', 'videojs')
  const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version

  const files = new Set()
  for (const entry of ['video.js', 'i18n.js', 'locales/vi.js']) {
    for (const f of closureOf(pkgDir, entry)) files.add(f)
  }

  fs.rmSync(out, { recursive: true, force: true })
  let bytes = 0
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true })
    fs.copyFileSync(path.join(pkgDir, f), path.join(out, f))
    bytes += fs.statSync(path.join(pkgDir, f)).size
  }
  fs.copyFileSync(path.join(pkgDir, 'LICENSE'), path.join(out, 'LICENSE'))
  fs.writeFileSync(path.join(out, 'VENDOR.md'),
    `# Vendored Video.js\n\n- Package: @videojs/cdn@${version} (Apache-2.0, see LICENSE)\n- Tarball sha256: ${sha}\n` +
    `- Files: ${files.size} (${Math.round(bytes / 1024)} KB), the import closure of video.js, i18n.js and locales/vi.js\n` +
    `- Regenerate: node tools/vendor-videojs.mjs <extracted package dir> <tarball sha256>\n`)
  console.log(`${files.size} files, ${Math.round(bytes / 1024)} KB -> ${out}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
