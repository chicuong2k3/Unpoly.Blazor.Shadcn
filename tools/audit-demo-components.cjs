#!/usr/bin/env node
// Direct example coverage, NOT render/style/interaction parity. Library-owned
// children do not substitute for an independently exercised public component.
const fs = require('node:fs');
const path = require('node:path');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() && file.endsWith('.razor') ? [file] : [];
  }).sort();
}

function tags(source) {
  // Razor and HTML comments frequently contain snippets, not working demos.
  const clean = source.replace(/@\*[\s\S]*?\*@|<!--[\s\S]*?-->/g, '');
  return new Set([...clean.matchAll(/<([A-Z][\w]*)(?=[\s/>])/g)].map(match => match[1]));
}

function audit(library, demoHeads) {
  const components = walk(library).map(file => path.basename(file, '.razor')).sort();
  if (!components.length) throw new Error('Empty library component source inventory');
  const resultSet = new Set(components);
  const composedBy = new Map(components.map(name => {
    const source = fs.readFileSync(path.join(library, `${name}.razor`), 'utf8');
    return [name, [...tags(source)].filter(tag => resultSet.has(tag))];
  }));
  const results = {};
  for (const [head, directory] of Object.entries(demoHeads)) {
    const sources = walk(directory);
    if (!sources.length) throw new Error(`Empty demo inventory: ${head}`);
    const used = new Map();
    for (const file of sources) {
      for (const tag of tags(fs.readFileSync(file, 'utf8'))) {
        if (!used.has(tag)) used.set(tag, []);
        used.get(tag).push(path.relative(directory, file).replaceAll('\\', '/'));
      }
    }
    const direct = new Set(components.filter(name => used.has(name)));
    const reachable = new Set(direct);
    const parent = new Map();
    const queue = [...direct];
    for (let index = 0; index < queue.length; index++) {
      for (const child of composedBy.get(queue[index])) {
        if (reachable.has(child)) continue;
        reachable.add(child);
        parent.set(child, queue[index]);
        queue.push(child);
      }
    }
    results[head] = {
      sourceComponents: components.length,
      demoSources: sources.length,
      direct: direct.size,
      missingDirect: components.filter(name => !direct.has(name)),
      composedOnly: components.filter(name => !direct.has(name) && reachable.has(name))
        .map(name => ({ component: name, via: parent.get(name) })),
      uncovered: components.filter(name => !reachable.has(name)),
      // Provenance for follow-up testing (one example is not state coverage).
      examples: Object.fromEntries(components.filter(name => used.has(name)).map(name => [name, used.get(name)])),
    };
  }
  return results;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const base = path.join(root, 'demo');
  const results = audit(path.join(root, 'src/Unpoly.Blazor.Shadcn/Components'), {
    web: path.join(base, 'Unpoly.Blazor.Shadcn.Demo/Components'),
    maui: path.join(base, 'Unpoly.Blazor.Shadcn.Maui/Components'),
  });
  if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
  else for (const [head, data] of Object.entries(results)) {
    console.log(`${head}: ${data.direct}/${data.sourceComponents} component source names occur as direct Razor tags in ${data.demoSources} demo files`);
    console.log(`COMPOSED ONLY (${data.composedOnly.length}): ${data.composedOnly.map(x => `${x.component} via ${x.via}`).join(', ')}`);
    console.log(`UNCOVERED (${data.uncovered.length}): ${data.uncovered.join(', ')}`);
  }
  // The tool exits nonzero while ANY source component lacks both a direct demo
  // example and an explicit library composition path. Composed is NOT state parity.
  if (Object.values(results).some(x => x.uncovered.length)) process.exitCode = 1;
}
module.exports = { walk, tags, audit };
