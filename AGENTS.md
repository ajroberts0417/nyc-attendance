<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design rules

Settled in the October 2026 redesign (Fractal Accelerator Graphic Design guide). Apply them to every new screen.

- **One job per screen.** Home: see the day's citywide number, then look up a school or district against it. School: this school vs. city and district. Admin: is collection healthy and does it match the source.
- **One home per fact.** Don't repeat a number in a stat card, a title and a table. The citywide figure lives in the hero; counts appear only when filtered.
- **No non-data ink.** No taglines, usage hints ("click to filter"), eyebrow labels, section titles that restate content, cards, gradients or shadows. Group with spacing and hairlines (`--line`). Keep words only when a value can't identify itself (e.g. "Citywide ·", "vs city", "District average").
- **Brand.** Fraunces (`font-display`) for names and headline numbers; Inter with tabular numerals for data. Paper `--page`, burgundy `--ink`; radius ≤ 6px. Muted text must be `--ink-2`/`--ink-3`, both ≥ 4.5:1 on paper.
- **Data color.** One burgundy ramp (`--seq-1…7`), darker = lower attendance, in fixed bins so a color means the same thing every day. Always pair color with a value (tooltip, list, label).
- **Design every state.** With one school day, show a strip of all schools instead of an empty trend chart; with history, show the trend. Not-submitted values render as "—".
- **Tap targets ≥ 40px** on phone; search stays sticky on phone.
- **Check by screenshot** at 1440px and 390px (`design-review/shoot.mjs` in the parent folder), including a blurred/grayscale squint pass.
