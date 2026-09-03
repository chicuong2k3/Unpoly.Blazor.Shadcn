#!/usr/bin/env python3
"""
Generate :has() fallback rules for Safari 15.0-15.3.

Tailwind v4 emits :has() selectors that pre-16.4 WebKit drops along with the
whole rule. The vendored runtime (compat/css-has-pseudo.js, @csstools
browser build) maintains csstools-has-* attributes, but only for rules that
reference those attributes — so this script runs the REFERENCE css-has-pseudo
PostCSS plugin over the BUILT demo stylesheets and copies its emitted
fallback rules (the .js-has-pseudo-scoped ones) into ui.safari15.css.

Nothing here parses selectors by hand: an earlier version did and produced
subtly wrong output twice (inner-vs-full encoding, escaped brackets). The
plugin owns emission; this script only extracts, dedupes and splices.

Usage:
    python tools/gen_has_fallback.py            # rewrite the generated section
    python tools/gen_has_fallback.py --check    # fail if the section is stale

Inputs are the COMMITTED built outputs of both demo heads (union — one shared
fallback file). Requires repo-root node_modules (npm ci) for postcss and
css-has-pseudo, both pinned exact in package.json. In CI the web output is
regenerated first; see build.yml.
"""

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

MARK_BEGIN = "/* ==== generated :has() fallbacks — DO NOT EDIT (run: python tools/gen_has_fallback.py) ==== */"
MARK_END = "/* ==== end generated :has() fallbacks ==== */"


def normalize(rule: str) -> str:
    """Collapse whitespace runs so minified and expanded forms dedupe."""
    return re.sub(r"\s+", " ", rule).strip()


def run_plugin(css_path: Path, helper: Path) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "fallback.css"
        proc = subprocess.run(
            ["node", str(helper), str(css_path), str(out)],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"plugin failed on {css_path}:\n{proc.stderr}")
        skipped = [line for line in proc.stderr.splitlines() if line.startswith("SKIP ")]
        for line in skipped:
            print(f"WARNING: {line}", file=sys.stderr)
        return out.read_text(encoding="utf-8")


def main() -> int:
    repo = Path(__file__).parent.parent
    if shutil.which("node") is None:
        print("node is required (npm ci at repo root).", file=sys.stderr)
        return 2
    for pkg in ("postcss", "css-has-pseudo"):
        if not (repo / "node_modules" / pkg).exists():
            print(f"node_modules/{pkg} missing; run 'npm ci' at repo root.", file=sys.stderr)
            return 2

    inputs = [
        repo / "demo" / "Unpoly.Blazor.Shadcn.Demo" / "wwwroot" / "app.css",
        repo / "demo" / "Unpoly.Blazor.Shadcn.Maui" / "wwwroot" / "app.css",
    ]
    missing = [str(p) for p in inputs if not p.exists()]
    if missing:
        print(f"Missing built CSS (build both demos first): {missing}", file=sys.stderr)
        return 2

    helper = repo / "tools" / "gen_has_fallback_run.cjs"
    seen = set()
    chunks = []
    for path in inputs:
        for chunk in run_plugin(path, helper).split("\n\n"):
            chunk = chunk.strip("\n")
            if not chunk:
                continue
            key = normalize(chunk)
            if key in seen:
                continue
            seen.add(key)
            chunks.append(chunk.strip() + "\n")

    section = MARK_BEGIN + "\n" + "\n".join(chunks) + MARK_END + "\n"
    target = repo / "src" / "Unpoly.Blazor.Shadcn" / "wwwroot" / "ui.safari15.css"
    current = target.read_text(encoding="utf-8") if target.exists() else ""

    if MARK_BEGIN in current and MARK_END in current:
        head, _, rest = current.partition(MARK_BEGIN)
        _, _, tail = rest.partition(MARK_END)
        tail = tail.lstrip("\n")
        updated = head.rstrip("\n") + "\n\n" + section + ("" if not tail else "\n" + tail)
    else:
        updated = current.rstrip("\n") + "\n\n" + section

    def section_of(text: str) -> str:
        if MARK_BEGIN not in text:
            return ""
        _, _, rest = text.partition(MARK_BEGIN)
        mid, _, _ = rest.partition(MARK_END)
        return MARK_BEGIN + mid + MARK_END + "\n"

    if "--check" in sys.argv:
        if section_of(current) != section_of(updated):
            print(
                "ui.safari15.css :has() fallbacks are stale. "
                "Run: python tools/gen_has_fallback.py",
                file=sys.stderr,
            )
            return 1
        print(f":has() fallbacks current ({len(chunks)} rules).")
        return 0

    target.write_text(updated, encoding="utf-8")
    print(f"Wrote {len(chunks)} fallback rules.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
