// Fetches the NYC DOE daily attendance page and saves it to data/.
// The DOE shows a single day at a time and replaces it the next school day,
// so this runs on a schedule and git history keeps every revision.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const URL = "https://www.nycenet.edu/PublicApps/Attendance.aspx";
const UA = "Mozilla/5.0 (nyc-attendance archive)";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DAYS_DIR = join(ROOT, "data", "days");
const CITYWIDE = join(ROOT, "data", "citywide.csv");

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// "10/19/2026 12:00:00 AM" -> "2026-10-19"
function isoDate(s) {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) throw new Error(`Unrecognized date: ${s}`);
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

async function fetchWithRetry(url, init, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i >= tries) throw err;
      console.warn(`Attempt ${i} failed (${err.message}), retrying…`);
      await new Promise((r) => setTimeout(r, 5000 * i));
    }
  }
}

async function scrape() {
  const page = await fetchWithRetry(URL, { headers: { "User-Agent": UA } });
  const cookies = page.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const html = await page.text();

  const citywide = html.match(/id="ctl00_ContentPlaceHolder1_lblPcnt"[^>]*>\s*([\d.]+)\s*%/)?.[1] ?? "";

  // Replay the "Microsoft Excel" postback, which returns every school as one HTML table.
  const form = new URLSearchParams();
  for (const [, name, value] of html.matchAll(/<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"/g)) {
    form.set(name, decode(value));
  }
  form.set("__EVENTTARGET", "ctl00$ContentPlaceHolder1$btnExport");
  form.set("__EVENTARGUMENT", "");
  for (const [, name] of html.matchAll(/<select name="([^"]+)"/g)) {
    form.set(name, name.endsWith("ddlPageSize") ? "20" : "1");
  }

  const exp = await fetchWithRetry(URL, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies },
    body: form,
  });
  const table = await exp.text();

  const rows = [];
  for (const [, tr] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => decode(m[1]));
    if (cells.length !== 4) continue;
    const [dbn, name, date, pct] = cells;
    rows.push({ dbn, name, date: isoDate(date), pct: /^[\d.]+$/.test(pct) ? pct : "" });
  }
  if (rows.length < 500) throw new Error(`Only ${rows.length} schools parsed; page layout may have changed`);
  return { citywide, rows };
}

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
