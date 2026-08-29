# Behaviour tests

What a component **does**, in a real browser, against the real demo.

The suite next door proves a component *renders* shadcn's classes. It cannot prove the panel
closes, the sidebar collapses, the arrow key moves the right way or the toast's Undo is
reachable — and every one of those has been broken here while the whole class-parity suite
stayed green. That is what these are for.

```bash
dotnet test tests/Unpoly.Blazor.Shadcn.Behaviour
```

The demo is started for you on a free port and stopped afterwards. Two environment variables
change that:

| Variable | Effect |
|---|---|
| `BEHAVIOUR_URL` | drive an app you already have running, and start nothing |
| `BEHAVIOUR_BROWSER` | path to a real installed browser — the run is then headed |

`BEHAVIOUR_BROWSER` is not a convenience. Several faults in this repository only ever appeared
in one engine, and a report that says "it does not close in Opera" is answered by running the
suite in Opera:

```bash
BEHAVIOUR_BROWSER="C:/Users/.../opera.exe" dotnet test tests/Unpoly.Blazor.Shadcn.Behaviour
```

## Three things worth knowing before adding one

**The demo runs in Development, deliberately.** `UseStaticWebAssets` is wired only there, and it
is what maps `/_content/Unpoly.Blazor.Shadcn/…` to the library's `wwwroot` from a build output.
Anywhere else `ui.js` and `app.css` both 404 — every component is unstyled and inert, which looks
exactly like a component that does not work.

**One behaviour per test, named as a sentence.** A failure should say what stopped being true
without anyone opening the file.

**Assert relations, not pixels.** Every placement fault this library has had was of one shape —
the panel opened somewhere unrelated to the control that opened it. `dx` from the trigger catches
that; a coordinate catches a font change.

## Console errors are failures

Every test ends with `AssertQuiet()`. Half the faults found while writing these announced
themselves in the console first — `toast.info is not a function` was there for weeks — and
nobody was listening.
