// Fetches the NYC DOE daily attendance page and saves it to data/.
// The DOE shows a single day at a time and replaces it the next school day,
// so this runs on a schedule and git history keeps every revision.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scrape } from "../lib/source.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DAYS_DIR = join(ROOT, "data", "days");
const CITYWIDE = join(ROOT, "data", "citywide.csv");

const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

async function upsertCitywide(entry) {
  const header = "date,citywide_pct,schools,reported,fetched_at";
  let lines = [];
  try {
    lines = (await readFile(CITYWIDE, "utf8")).trim().split("\n").slice(1);
  } catch {}
  const byDate = new Map(lines.filter(Boolean).map((l) => [l.split(",")[0], l]));
  const prev = byDate.get(entry.date);
  const next = [entry.date, entry.citywide, entry.schools, entry.reported].join(",");
  if (prev?.startsWith(next + ",")) return false;
  byDate.set(entry.date, `${next},${entry.fetched_at}`);
  const sorted = [...byDate.keys()].sort().map((d) => byDate.get(d));
  await writeFile(CITYWIDE, [header, ...sorted].join("\n") + "\n");
  return true;
}

const { citywide, rows } = await scrape();
const dates = new Set(rows.map((r) => r.date));
await mkdir(DAYS_DIR, { recursive: true });

for (const date of dates) {
  const dayRows = rows.filter((r) => r.date === date).sort((a, b) => a.dbn.localeCompare(b.dbn));
  const csv = ["dbn,name,pct", ...dayRows.map((r) => [r.dbn, csvCell(r.name), r.pct].join(","))].join("\n") + "\n";
  const file = join(DAYS_DIR, `${date}.csv`);
  const old = await readFile(file, "utf8").catch(() => null);
  if (old !== csv) await writeFile(file, csv);

  const reported = dayRows.filter((r) => r.pct).length;
  const changed = await upsertCitywide({
    date,
    citywide: dates.size === 1 ? citywide : "",
    schools: dayRows.length,
    reported,
    fetched_at: new Date().toISOString(),
  });
  console.log(`${date}: ${dayRows.length} schools, ${reported} reported, citywide ${citywide}% ${old !== csv || changed ? "(updated)" : "(unchanged)"}`);
}
