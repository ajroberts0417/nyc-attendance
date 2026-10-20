# NYC School Attendance Tracker

The NYC DOE posts per-school attendance for one day at
[nycenet.edu/PublicApps/Attendance.aspx](https://www.nycenet.edu/PublicApps/Attendance.aspx)
and replaces it the next school day. This repo archives it.

- **Collect:** `.github/workflows/collect.yml` runs `scripts/collect.mjs` hourly and commits any change.
- **Data:** `data/days/YYYY-MM-DD.csv` (dbn, name, pct; blank pct = not submitted) and `data/citywide.csv`.
  Git history keeps every revision the DOE makes to a day's preliminary numbers.
- **Site:** Next.js, statically built from `data/`. `pnpm dev` to run locally.

```bash
pnpm collect   # fetch today's data locally
pnpm dev
```
