// Copies the archive into public/data so the site can serve CSV downloads and per-day files.
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data");

await mkdir(OUT, { recursive: true });
await cp(join(ROOT, "data", "days"), join(OUT, "days"), { recursive: true });
await cp(join(ROOT, "data", "citywide.csv"), join(OUT, "citywide.csv"));

const files = (await readdir(join(ROOT, "data", "days"))).sort();
const lines = ["date,dbn,name,pct"];
for (const f of files) {
  const date = f.replace(".csv", "");
  const rows = (await readFile(join(ROOT, "data", "days", f), "utf8")).trim().split("\n").slice(1);
  for (const r of rows) lines.push(`${date},${r}`);
}
await writeFile(join(OUT, "all-days.csv"), lines.join("\n") + "\n");
await writeFile(join(OUT, "days.json"), JSON.stringify(files.map((f) => f.replace(".csv", ""))));
console.log(`Exported ${files.length} days, ${lines.length - 1} rows`);
