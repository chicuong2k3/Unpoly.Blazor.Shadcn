#!/usr/bin/env python3
"""
Real old-WebKit probe: loads the demo in WebKitGTK (the engine family Safari
15.x ships) and asserts the Safari 15 compat work with the actual engine,
not a stub simulation.

Run: xvfb-run -a python3 webkitgtk_probe.py http://127.0.0.1:8080 results/

Writes results/results.json + results/results.md + a few PNG snapshots.
Every assertion prints as "ASSERT <name>: PASS|FAIL <detail>" so CI logs and
the results branch carry the verdict in plain text.
"""

import json
import os
import sys
import time
import traceback

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.0")
from gi.repository import Gtk, GLib, WebKit2  # noqa: E402

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8080"
OUT = sys.argv[2] if len(sys.argv) > 2 else "results"
os.makedirs(OUT, exist_ok=True)

DESKTOP = (1280, 900)
MOBILE = (390, 844)

results = []  # (name, ok, detail)
console_errors = []
shots = []


def assert_(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)))
    print(f"ASSERT {name}: {'PASS' if ok else 'FAIL'} {detail}", flush=True)


class Probe:
    def __init__(self):
        self.view = WebKit2.WebView()
        # The signal name differs across bindings; console capture also runs
        # through the injected document-start script below, so this is a bonus.
        try:
            self.view.connect("console-message", self.on_console)
        except TypeError:
            pass
        content = self.view.get_user_content_manager()
        content.add_script(WebKit2.UserScript(
            "window.__errs = [];"
            "var __e = console.error.bind(console);"
            "console.error = function(){ window.__errs.push(Array.prototype.join.call(arguments, ' ')); __e.apply(null, arguments); };"
            "window.addEventListener('error', function(ev){ window.__errs.push('pageerror: ' + ev.message); });",
            WebKit2.UserContentInjectedFrames.ALL_FRAMES,
            WebKit2.UserScriptInjectionTime.AT_DOCUMENT_START,
        ))
        self.win = Gtk.OffscreenWindow()
        self.win.add(self.view)
        self.win.set_default_size(*DESKTOP)
        self.win.resize(*DESKTOP)

    def on_console(self, view, level, message, line, source):
        if level in (WebKit2.ConsoleMessageLevel.ERROR, WebKit2.ConsoleMessageLevel.WARNING):
            console_errors.append(f"[{level}] {message} ({source}:{line})")

    def js(self, code, timeout_s=15):
        """Run JS, return the string the code evaluates to (caller uses JSON)."""
        holder = {}

        def done(view, task):
            try:
                res = view.run_javascript_finish(task)
                holder["value"] = res.get_js_value().to_string() if res else ""
            except Exception as e:  # noqa: BLE001
                holder["error"] = str(e)
            holder["done"] = True

        def timeout():
            holder.setdefault("done", True)
            holder["error"] = "js timeout"
            return False

        GLib.timeout_add_seconds(timeout_s, timeout)
        self.view.run_javascript(code, None, done)
        while not holder.get("done"):
            Gtk.main_iteration_do(True)
        if "error" in holder:
            raise RuntimeError(holder["error"])
        return holder.get("value", "")

    def goto(self, path, settle=1.5):
        loaded = {}
        self.view.load_uri(BASE + path)

        def done(view, event):
            if event == WebKit2.LoadEvent.FINISHED:
                loaded["ok"] = True

        hid = self.view.connect("load-changed", done)
        start = time.time()
        while not loaded.get("ok") and time.time() - start < 30:
            Gtk.main_iteration_do(True)
        self.view.disconnect(hid)
        deadline = time.time() + settle
        while time.time() < deadline:
            Gtk.main_iteration_do(False)

    def snapshot(self, name):
        path = os.path.join(OUT, name + ".png")

        def done(view, task):
            try:
                surf = view.get_snapshot_finish(task)
                surf.write_to_png(path)
                shots.append(path)
            except Exception as e:  # noqa: BLE001
                print(f"snapshot {name} failed: {e}", flush=True)

        self.view.get_snapshot(
            WebKit2.SnapshotRegion.FULL_DOCUMENT,
            WebKit2.SnapshotOptions.NONE,
            None,
            done,
        )
        # give the callback a chance to run
        end = time.time() + 10
        while time.time() < end and not any(p.endswith(name + ".png") for p in shots):
            Gtk.main_iteration_do(False)

    def resize(self, w, h):
        self.win.resize(w, h)
        self.pump(0.3)

    def pump(self, seconds):
        deadline = time.time() + seconds
        while time.time() < deadline:
            Gtk.main_iteration_do(False)
        while Gtk.events_pending():
            Gtk.main_iteration_do(False)


STATE_JS = """(() => {
  const cs = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
  const btn = document.querySelector('[data-slot="button"]');
  return JSON.stringify({
    booted: typeof up !== 'undefined' ? up.version : null,
    compilers: typeof window.shadcnCompiler !== 'undefined',
    bodyBg: cs(document.body, 'background-color'),
    bodyFg: cs(document.body, 'color'),
    btnBg: cs(btn, 'background-color'),
    btnFg: cs(btn, 'color'),
    primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
    background: getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
    mq640: matchMedia('(min-width: 640px)').matches,
    popoverApi: typeof HTMLElement.prototype.showPopover,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    errs: (window.__errs || []).slice(0, 20)
  });
})()"""


def is_rgb_nontransparent(v):
    if not v:
        return False
    v = v.strip()
    if v.startswith("rgba") and v.rstrip(")").endswith(" 0"):
        return False
    return v not in ("", "transparent", "rgba(0, 0, 0, 0)")


def run():
    probe = Probe()
    try:
        probe.goto("/", settle=2.0)
        s = json.loads(probe.js(STATE_JS))
        print("STATE /: " + json.dumps(s), flush=True)
        console_errors.extend("[js] " + e for e in s.get("errs", []))

        assert_("unpoly-booted", s["booted"] is not None, f"up.version={s['booted']}")
        assert_("body-has-background", is_rgb_nontransparent(s["bodyBg"]), s["bodyBg"])
        assert_("body-has-foreground", is_rgb_nontransparent(s["bodyFg"]), s["bodyFg"])
        assert_("token--primary-resolves", is_rgb_nontransparent(s["primary"]), s["primary"])
        assert_("token--background-resolves", is_rgb_nontransparent(s["background"]), s["background"])
        assert_("button-painted", is_rgb_nontransparent(s["btnBg"]), s["btnBg"])
        assert_("desktop-mq-640-applies", s["mq640"] is True, f"mq640={s['mq640']}")
        assert_("no-toReversed-crash",
                not any("toReversed" in e for e in console_errors),
                "console clean" if console_errors else "console empty")

        probe.snapshot("home-desktop")

        # Select opens under the polyfill and the page is usable.
        probe.goto("/components/select", settle=2.0)
        s2 = json.loads(probe.js(STATE_JS))
        assert_("select-page-booted", s2["booted"] is not None, f"up.version={s2['booted']}")

        probe.js(
            "(() => {"
            " const t = document.querySelector('[data-slot=\"select-trigger\"]');"
            " if (t) t.click();"
            "})()"
        )
        probe.pump(1.2)
        final = None
        start = time.time()
        while time.time() - start < 5:
            raw = probe.js(
                "(() => {"
                " const p = document.querySelector('[data-slot=\"select-content\"]');"
                " if (!p) return '{}';"
                " return JSON.stringify({"
                "  state: p.getAttribute('data-state'),"
                "  openCls: p.className.indexOf(':popover-open') !== -1,"
                "  display: getComputedStyle(p).display,"
                "  items: p.querySelectorAll('[data-slot=\"select-item\"]').length"
                " });"
                "})()"
            )
            final = json.loads(raw) if raw else {}
            if final.get("display") not in (None, "none"):
                break
            time.sleep(0.25)
        print("SELECT: " + json.dumps(final), flush=True)
        assert_(
            "select-panel-opens",
            final.get("display") not in (None, "none") and final.get("items", 0) > 0,
            json.dumps(final),
        )
        probe.snapshot("select-open")

        # Mobile header must not overflow the viewport.
        probe.resize(*MOBILE)
        probe.goto("/", settle=2.0)
        m = json.loads(probe.js(STATE_JS))
        print("STATE mobile: " + json.dumps(m), flush=True)
        console_errors.extend("[js] " + e for e in m.get("errs", []))
        assert_("mobile-no-horizontal-overflow",
                m["scrollWidth"] <= m["innerWidth"] + 1,
                f"scrollWidth={m['scrollWidth']} innerWidth={m['innerWidth']}")
        assert_("mobile-mq-correctly-inactive", m["mq640"] is False, f"mq640={m['mq640']}")
        probe.snapshot("home-mobile-390")

    except Exception:
        assert_("probe-crashed", False, traceback.format_exc()[-400:])
    finally:
        # console errors that are compat-relevant fail the run
        relevant = [e for e in console_errors
                    if "toReversed" in e or "reportError" in e
                    or "Unpoly cannot boot" in e or "showPopover" in e]
        assert_("no-compat-console-errors", not relevant,
                (relevant[:3] if relevant else f"{len(console_errors)} other messages"))

        engine = ".".join(map(str, [
            WebKit2.get_major_version(), WebKit2.get_minor_version(),
            WebKit2.get_micro_version()]))
        failed = [n for n, ok, _ in results if not ok]
        summary = {
            "engine": f"WebKitGTK {engine}",
            "base": BASE,
            "passed": len(results) - len(failed),
            "failed": len(failed),
            "asserts": [{"name": n, "ok": ok, "detail": d} for n, ok, d in results],
            "console_errors": console_errors[:40],
        }
        with open(os.path.join(OUT, "results.json"), "w") as f:
            json.dump(summary, f, indent=2)
        lines = [
            "# Safari 15 real-engine probe results",
            "",
            f"Engine: **WebKitGTK {engine}** (Safari 15.4 family)",
            f"Base: {BASE}",
            f"Passed: {summary['passed']} / {summary['passed'] + summary['failed']}",
            "",
        ]
        for n, ok, d in results:
            lines.append(f"- {'✅' if ok else '❌'} **{n}** — {d[:220]}")
        lines += ["", "## Console (first 40)", ""]
        lines += [f"- `{e[:200]}`" for e in console_errors[:40]]
        with open(os.path.join(OUT, "results.md"), "w") as f:
            f.write("\n".join(lines) + "\n")
        print(f"ENGINE WebKitGTK {engine}", flush=True)
        print(f"SUMMARY passed={summary['passed']} failed={summary['failed']}", flush=True)
        if failed:
            print("FAILED: " + ", ".join(failed), flush=True)
        GLib.idle_add(Gtk.main_quit)


GLib.timeout_add_seconds(240, Gtk.main_quit)
GLib.idle_add(run)
try:
    Gtk.main()
except KeyboardInterrupt:
    pass
