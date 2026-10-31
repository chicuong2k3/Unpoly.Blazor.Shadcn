import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closureOf } from './vendor-videojs.mjs'

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vjs-'))
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    fs.writeFileSync(path.join(dir, name), text)
  }
  return dir
}

test('follows static, side-effect and dynamic relative imports once each', () => {
  const dir = fixture({
    'video.js': 'import "./ui/a.js";import {x} from "./chunk-1.js";const m=()=>import("./lazy.js");',
    'ui/a.js': 'import "../chunk-1.js";',
    'chunk-1.js': 'export const x=1;',
    'lazy.js': 'export default 1;',
    'unrelated.js': 'export default 2;',
  })
  assert.deepEqual(closureOf(dir, 'video.js'), ['chunk-1.js', 'lazy.js', 'ui/a.js', 'video.js'])
})

test('ignores bare and absolute specifiers', () => {
  const dir = fixture({ 'video.js': 'import "https://x.example/a.js";import "bare-pkg";' })
  assert.deepEqual(closureOf(dir, 'video.js'), ['video.js'])
})

test('throws when an import cannot be resolved so a partial copy is never produced', () => {
  const dir = fixture({ 'video.js': 'import "./missing.js";' })
  assert.throws(() => closureOf(dir, 'video.js'), /missing\.js/)
})
