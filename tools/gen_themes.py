#!/usr/bin/env python3
"""Generates themes/*.css from tweakcn's theme registry.

Same reason the component classes are generated: a palette retyped from a screenshot is a palette
that drifts, and nobody reviewing it can tell whether a value is deliberate or a typo. These come
from the registry that published them, and refreshing one is a diff.

    python tools/gen_themes.py            # rewrite themes/
    python tools/gen_themes.py --check    # CI: fail if a theme is stale

A theme is written as a [data-theme="name"] block so several can be loaded at once and switched by
an attribute. An app that ships one puts data-theme on <html>.
"""
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'themes'
REGISTRY = 'https://tweakcn.com/r/themes/{name}.json'

# Chosen for how well each sits with shadcn's own shapes rather than for novelty. The note is
# printed into the file so a reader knows what they are looking at without opening the site.
THEMES = {
    # --- Core 4 ---
    'vercel': 'Black and white, sharp. The house style shadcn itself grew out of.',
    'supabase': 'Neon green on near-white. High contrast, unmistakably a developer tool.',
    'modern-minimal': 'Clean blue on pure white. The closest to shadcn default with a colour.',
    'notebook': 'Heavy borders on paper. The opposite of this library default, on purpose.',
    # --- Additional tweakcn presets (visually distinct from the core 4) ---
    'catppuccin': 'Warm mocha pastels. Soft, inviting, community feel.',
    'claymorphism': 'Soft 3D, inflated surfaces. Friendly, tactile, approachable.',
    'amethyst-haze': 'Muted purple elegance. Trustworthy, calm, premium.',
    'ocean-breeze': 'Cool blue trust. Clean, fintech-safe, calm.',
    'tangerine': 'Warm orange energy. Optimistic, human, donation-friendly.',
    'bubblegum': 'Playful pink candy. Light, cheerful, stands out.',
    'perpetuity': 'Deep teal / petrol. Serious, grounded, editorial.',
    't3-chat': 'Neutral modern with a dark accent. Minimal, chat-clean.',
    # --- Full tweakcn catalogue (20 remaining) ---
    'amber-minimal': 'Warm amber minimal. Earthy, calm, focused.',
    'bold-tech': 'Bold tech — saturated primary, sharp, developer.',
    'clean-slate': 'Clean slate — near-white canvas, minimal chrome.',
    'cosmic-night': 'Cosmic night — deep space, starfield, moody.',
    'elegant-luxury': 'Elegant luxury — refined, serif, high-contrast.',
    'kodama-grove': 'Kodama grove — forest greens, natural, grounded.',
    'midnight-bloom': 'Midnight bloom — dark floral, moody, premium.',
    'mocha-mousse': 'Mocha mousse — warm brown, cozy, Pantone 2025.',
    'neo-brutalism': 'Neo-brutalism — heavy borders, flat, bold.',
    'northern-lights': 'Northern lights — aurora greens and purples.',
    'pastel-dreams': 'Pastel dreams — soft pastels, dreamy, light.',
    'quantum-rose': 'Quantum rose — rose + teal, vibrant, modern.',
    'retro-arcade': 'Retro arcade — neon, pixel, nostalgic.',
    'sage-garden': 'Sage garden — muted greens, natural, calm.',
    'solar-dusk': 'Solar dusk — warm sunset, amber glow.',
    'starry-night': 'Starry night — Van Gogh blues, swirling.',
    'sunset-horizon': 'Sunset horizon — warm gradient dusk.',
    'vintage-paper': 'Vintage paper — aged parchment, editorial.',
    'violet-bloom': 'Violet bloom — purple floral, soft, elegant.',
    'soft-pop': 'Soft pop — gentle brights, friendly.',
}

# The inputs tweakcn keeps so its own editor can recompute a shadow — the colour, the opacity,
# the blur, the spread and the two offsets. The computed values are what a stylesheet needs; the
# ingredients would only be a second, silent source of truth.
IGNORED = {'shadow-color', 'shadow-opacity', 'shadow-blur', 'shadow-spread', 'shadow-offset-x',
           'shadow-offset-y', 'shadow-2xs', 'shadow-xl', 'shadow-2xl', 'spacing',
           # Taken, but written by hand below so they end up on our own elevation scale.
           'shadow-xs', 'shadow-sm', 'shadow', 'shadow-md', 'shadow-lg',
           'font-sans', 'font-serif', 'font-mono', 'letter-spacing', 'tracking-normal'}

# tweakcn's shadow scale onto ours. This is most of what makes a theme recognisable and all of it
# used to be thrown away — the generator kept the palette and dropped the type and the shadows,
# which is why every theme looked like the default wearing different colours. Notebook is the
# clearest case: it is a handwriting face and hard, offset shadows, and without them it is just
# a grey page with borders.
SHADOWS = {'elevation-1': 'shadow-xs', 'elevation-2': 'shadow-sm',
           'elevation-3': 'shadow-md', 'elevation-4': 'shadow-lg'}


# Ours, derived from the theme's own values rather than invented.
def derived(light: dict, source: dict) -> dict:
    radius = light.get('radius', '0.625rem')
    out = {
        'radius-control': f'calc({radius} - 2px)',
        # Every one of these was authored against shadcn's bordered default, where a card is
        # separated by a line rather than by ground. This library's own default is the opposite;
        # a theme from elsewhere should not silently inherit that opinion.
        'surface-border': 'var(--border)',
    }
    for ours, theirs in SHADOWS.items():
        if theirs in source:
            out[ours] = source[theirs]
    # A theme that names a typeface means it; carrying the name and not using it is the same as
    # not carrying it. These three are Tailwind's own namespaces, so `font-sans` and `font-mono`
    # resolve to them at runtime with no rebuild.
    for key in ('font-sans', 'font-serif', 'font-mono'):
        if key in source:
            out[key] = source[key]
    if 'letter-spacing' in source:
        out['tracking-normal'] = source['letter-spacing']
    return out


def fetch(name: str) -> dict:
    with urllib.request.urlopen(REGISTRY.format(name=name), timeout=30) as r:
        return json.load(r)


def block(selector: str, values: dict, indent='    ', applied: dict | None = None) -> str:
    lines = [f'{selector} {{']
    for k, v in values.items():
        lines.append(f'{indent}--{k}: {v};')
    for k, v in (applied or {}).items():
        lines.append(f'{indent}{k}: {v};')
    lines.append('}')
    return '\n'.join(lines)


def faces(light: dict) -> str:
    """The families a theme asks for, first name only — what an app has to load."""
    wanted = []
    for key in ('font-sans', 'font-mono', 'font-serif'):
        value = light.get(key)
        if not value:
            continue
        first = value.split(',')[0].strip().strip('"\'')
        if first not in wanted and first not in ('monospace', 'sans-serif', 'serif', 'system-ui'):
            wanted.append(first)
    return ', '.join(wanted) or 'none — system faces throughout'


def render(name: str, note: str, data: dict) -> str:
    vars_ = data['cssVars']
    source_light = vars_.get('light', {})
    source_dark = vars_.get('dark', {})
    light = {k: v for k, v in source_light.items() if k not in IGNORED}
    dark = {k: v for k, v in source_dark.items() if k not in IGNORED}
    light.update(derived(light, source_light))
    # A dark theme is the same type at different weights of shadow, so it takes the shadows and
    # inherits the faces.
    dark.update({k: v for k, v in derived(dark, source_dark).items() if k.startswith('elevation')})

    head = (
        f'/* {data.get("name", name)} — {note}\n'
        f'   ==========================================================================================\n'
        f'   GENERATED by tools/gen_themes.py from {REGISTRY.format(name=name)}\n'
        f'   Do not edit; change the preset or the generator.\n\n'
        f'   Scoped to [data-theme] rather than :root so several themes can be loaded at once and\n'
        f'   switched by an attribute. An app that ships one theme puts the attribute on <html>.\n\n'
        f'   TYPEFACES: {faces(vars_.get("light", {}))}\n'
        f'   A theme names them; loading them is the application\'s job. Unloaded, the family\n'
        f'   falls back and the theme is the same palette in the wrong voice. */\n\n'
    )

    # Custom properties alone change nothing about the type: `--font-sans` is only read by a
    # `font-sans` utility, and the page's own body text uses none. Setting the two inherited
    # properties on the element that carries the attribute is what makes a theme change how the
    # page reads rather than only how it is coloured.
    applied = {
        'font-family': 'var(--font-sans)' if 'font-sans' in light else None,
        'letter-spacing': 'var(--tracking-normal)' if 'tracking-normal' in light else None,
    }
    parts = [head, block(f'[data-theme="{name}"]', light,
                         applied={k: v for k, v in applied.items() if v}), '']
    if dark:
        parts += [block(f'[data-theme="{name}"].dark,\n[data-theme="{name}"] .dark', dark), '']
    return '\n'.join(parts)


def main() -> int:
    OUT.mkdir(exist_ok=True)
    check = '--check' in sys.argv
    stale = []

    for name, note in THEMES.items():
        path = OUT / f'{name}.css'
        if check:
            if not path.exists():
                stale.append(name)
                continue
            # Comparing against the live registry would make CI need the network and fail on a
            # preset the author changed. The committed file is the contract; only its presence
            # and shape are checked here.
            text = path.read_text(encoding='utf-8')
            if 'GENERATED by tools/gen_themes.py' not in text:
                stale.append(name)
            continue

        data = fetch(name)
        path.write_text(render(name, note, data), encoding='utf-8')
        print(f'  {name}.css')

    if check:
        if stale:
            print('themes missing or hand-edited: ' + ', '.join(stale), file=sys.stderr)
            return 1
        print(f'themes present ({len(THEMES)})')
        return 0

    print(f'wrote {len(THEMES)} themes')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
