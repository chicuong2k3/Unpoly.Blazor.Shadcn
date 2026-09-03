#!/usr/bin/env python3
"""
Safari 15 compatibility checker.

Checks the built app.css and source stylesheets for patterns that Safari 15
(and Safari 15.x before 15.4) cannot handle:

1. color-mix() in the built CSS that sits OUTSIDE an @supports block.
   Safari 15 does not support color-mix() at all, so any use must be guarded.

2. Bare :popover-open selectors in src/ Styles that are not wrapped in
   :is() or :where().  A browser that does not recognise :popover-open drops
   the entire rule; wrapping does not change that, so the intended fix is to
   avoid the pseudo-class or guard it with @supports, and this check flags
   the bare occurrence so it cannot be missed.

 3. :has() selectors in src/ Styles.  Safari 15.0-15.3 does not support :has()
    and it cannot be polyfilled in pure CSS, so this section is REPORT-ONLY:
    it lists the gap for the Safari 15 tracker but never fails the build.

 Returns non-zero with file:line on any violation of (1) or (2).
 """

import re
import shutil
import subprocess
import sys
from pathlib import Path


# Selectors whose ungated static color-mix() is covered by an explicit rgba()
# fallback in src/Unpoly.Blazor.Shadcn/wwwroot/ui.safari15.css.  Adding a new
# opacity utility with a static colour here requires adding its fallback there
# first — otherwise this check fails.
# NOTE: matching is substring-based against the rule selector Tailwind emits.
COLOR_MIX_ALLOWLIST = [
    ".border-amber-500\\/40",
    ".bg-black\\/35",
    ".bg-black\\/60",
    ".dark\\:bg-amber-950\\/40",
    ".dark\\:bg-destructive\\/20",
]


def find_repo_root() -> Path:
    """tools/ is one level below the repository root."""
    return Path(__file__).parent.parent


def check_color_mix_outside_supports(css_path: Path) -> list:
    """
    Find color-mix( usages that are not inside an @supports block.
    Tailwind v4 output may contain nested @supports, so we track brace depth.
    Selectors covered by ui.safari15.css rgba() fallbacks (COLOR_MIX_ALLOWLIST)
    are skipped — the ungated declaration is intentional there.
    """
    violations = []
    lines = css_path.read_text(encoding="utf-8").splitlines()

    brace_depth = 0
    supports_brace_depth = -1
    in_supports = False
    current_selector = ""

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Remember the rule selector: the last non-empty line before its "{".
        if stripped.endswith("{") and not stripped.startswith("@"):
            current_selector = stripped[:-1].strip()

        # Detect @supports start
        if stripped.startswith("@supports"):
            supports_brace_depth = brace_depth
            in_supports = True

        # Check for violation BEFORE adjusting brace depth for this line's closing braces,
        # because the color-mix call is on this line.
        if "color-mix(" in line:
            if not in_supports:
                if not any(s in current_selector for s in COLOR_MIX_ALLOWLIST):
                    violations.append((css_path, i, stripped))

        # Adjust brace depth
        brace_depth += line.count("{")
        brace_depth -= line.count("}")

        # Detect @supports end
        if in_supports and brace_depth <= supports_brace_depth:
            in_supports = False
            supports_brace_depth = -1

    return violations


def check_js_syntax(repo: Path) -> list:
    """
    Run node --check over every shipped first-party script.  A stray */
    inside a block comment (e.g. a "src/*/wwwroot" path written into a
    header comment) silently terminates the comment and turns the rest of
    the comment into code — exactly the failure that once broke every
    behaviour test with "ReferenceError: wwwroot is not defined".
    node --check catches it; V8 version quirks in error classification
    do not matter for the verdict.  Skipped when node is unavailable.
    """
    violations = []
    if shutil.which("node") is None:
        print("WARNING: node not found; skipping JS syntax check.", file=sys.stderr)
        return violations
    roots = [
        repo / "src" / "Unpoly.Blazor.Shadcn" / "wwwroot",
        repo / "demo" / "Unpoly.Blazor.Shadcn.Demo" / "wwwroot",
    ]
    for root in roots:
        if not root.exists():
            continue
        for js in sorted(root.rglob("*.js")):
            if "node_modules" in js.parts:
                continue
            proc = subprocess.run(
                ["node", "--check", str(js)],
                capture_output=True,
                text=True,
            )
            if proc.returncode != 0:
                first = (proc.stderr.strip().splitlines() or ["syntax error"])[0]
                violations.append((js, 0, first))
    return violations


def check_bare_popover_open(src_dir: Path) -> list:
    """Find bare :popover-open selectors not inside :is() or :where()."""
    """Find bare :popover-open selectors not inside :is() or :where()."""
    violations = []
    for css_file in sorted(src_dir.rglob("*.css")):
        for i, line in enumerate(css_file.read_text(encoding="utf-8").splitlines(), 1):
            if ":popover-open" in line:
                if ":is(" not in line and ":where(" not in line:
                    violations.append((css_file, i, line.strip()))
    return violations


def check_has_selectors(src_dir: Path) -> list:
    """Find :has() selectors in source stylesheets."""
    violations = []
    for css_file in sorted(src_dir.rglob("*.css")):
        for i, line in enumerate(css_file.read_text(encoding="utf-8").splitlines(), 1):
            if ":has(" in line:
                violations.append((css_file, i, line.strip()))
    return violations


def main() -> int:
    repo = find_repo_root()
    app_css = repo / "demo" / "Unpoly.Blazor.Shadcn.Demo" / "wwwroot" / "app.css"
    src_styles = repo / "src" / "Unpoly.Blazor.Shadcn" / "Styles"

    violations: list = []
    violations.extend(check_js_syntax(repo))

    if app_css.exists():
        violations.extend(check_color_mix_outside_supports(app_css))
    else:
        print(
            f"WARNING: {app_css} not found; build CSS first with 'npm run css' "
            f"in the demo project.",
            file=sys.stderr,
        )

    if src_styles.exists():
        violations.extend(check_bare_popover_open(src_styles))
        known_has = check_has_selectors(src_styles)
    else:
        print(f"WARNING: {src_styles} not found.", file=sys.stderr)
        known_has = []

    if violations:
        print("Safari 15 compatibility violations found:", file=sys.stderr)
        for path, line_no, text in violations:
            print(f"  {path}:{line_no}: {text}", file=sys.stderr)
        return 1

    print("No Safari 15 compatibility violations found.")
    if known_has:
        # Report-only: :has() has no pure-CSS fallback on Safari 15.0-15.3.
        # Tracked in the Safari 15 work, not a build break.
        print("Known :has() gap (report-only, Safari 15.0-15.3):", file=sys.stderr)
        for path, line_no, text in known_has:
            print(f"  {path}:{line_no}: {text}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
