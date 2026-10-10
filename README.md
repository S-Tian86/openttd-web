# openttd-web

A faithful web implementation of [OpenTTD](https://www.openttd.org) — the open-source
transport simulation based on _Transport Tycoon Deluxe_ — reimagined with a colourful
top-down look and playable in the browser.

> **Status:** Stage 0 (foundations). Nothing playable yet. See the
> [roadmap](docs/plan/00-master.md#6-roadmap).

## What this is

- **Faithful gameplay.** The simulation is ported from OpenTTD's source code (version 15.3):
  same rules, formulas and defaults. Every intentional difference is listed in
  [`docs/game/differences.md`](docs/game/differences.md).
- **New look.** A top-down 3/4 view with original, cute and colourful art instead of the
  isometric pixel art — and themes, so anyone can make their own style.
- **Desktop and phone.** Playable with mouse or touch.
- **In your language.** English and Spanish from day one, built to be translated.
- **Not a direct port.** Re-implemented in TypeScript, not compiled to WebAssembly.

## Run it

Requires Node 22.

```bash
npm ci
npm run dev        # http://localhost:5173
```

| Command                              | What it does                                          |
| ------------------------------------ | ----------------------------------------------------- |
| `npm test`                           | Unit, fidelity and architecture tests (Vitest)        |
| `npm run test:e2e`                   | End-to-end tests on the production build (Playwright) |
| `npm run lint` / `npm run typecheck` | Static checks                                         |
| `npm run build`                      | Production build in `dist/`                           |

## Documentation

- [Master plan](docs/plan/00-master.md) — architecture, decisions, roadmap
- [Tracking](docs/plan/TRACKING.md) — every task and its issue
- [Contributing](CONTRIBUTING.md) — how we work
- [Security](SECURITY.md) — reporting vulnerabilities

## Credits and license

OpenTTD is developed by the [OpenTTD team](https://github.com/OpenTTD/OpenTTD) and is based
on _Transport Tycoon Deluxe_ by Chris Sawyer. This project is not affiliated with or
endorsed by either. No OpenTTD graphics, sounds or music are used.

Licensed under the [GNU General Public License v2.0 or later](LICENSE), like OpenTTD.
