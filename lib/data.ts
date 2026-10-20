import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";

const DATA = join(process.cwd(), "data");

export type Day = {
  date: string;
  citywide: number | null;
  schools: number;
  reported: number;
  fetchedAt: string;
};

export type SchoolDay = { dbn: string; name: string; pct: number | null };

export type School = {
  dbn: string;
  name: string;
  borough: string;
  district: string;
  history: { date: string; pct: number | null }[];
};

export const BOROUGHS: Record<string, string> = {
  M: "Manhattan",
  X: "Bronx",
  K: "Brooklyn",
  Q: "Queens",
  R: "Staten Island",
};

export const boroughOf = (dbn: string) => BOROUGHS[dbn[2]] ?? "Other";
export const districtOf = (dbn: string) => dbn.slice(0, 2);

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.trim().split("\n").slice(1)) {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") {
        cells.push(cur);
        cur = "";
      } else cur += c;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const num = (s: string) => (s === "" ? null : Number(s));

export const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export async function getDays(): Promise<Day[]> {
  "use cache";
  cacheLife("max");
  const rows = parseCsv(await readFile(join(DATA, "citywide.csv"), "utf8"));
  return rows.map(([date, citywide, schools, reported, fetchedAt]) => ({
    date,
    citywide: num(citywide),
    schools: Number(schools),
    reported: Number(reported),
    fetchedAt,
  }));
}

export async function getDay(date: string): Promise<SchoolDay[]> {
  "use cache";
  cacheLife("max");
  const rows = parseCsv(await readFile(join(DATA, "days", `${date}.csv`), "utf8"));
  return rows.map(([dbn, name, pct]) => ({ dbn, name, pct: num(pct) }));
}

export async function getSchools(): Promise<School[]> {
  "use cache";
  cacheLife("max");
  const dates = (await readdir(join(DATA, "days"))).map((f) => f.replace(".csv", "")).sort();
  const schools = new Map<string, School>();
  for (const date of dates) {
    for (const { dbn, name, pct } of await getDay(date)) {
      let s = schools.get(dbn);
      if (!s) {
        s = { dbn, name, borough: boroughOf(dbn), district: districtOf(dbn), history: [] };
        schools.set(dbn, s);
      }
      s.name = name;
      s.history.push({ date, pct });
    }
  }
  return [...schools.values()].sort((a, b) => a.dbn.localeCompare(b.dbn));
}

export async function getDistrictShapes() {
  "use cache";
  cacheLife("max");
  return JSON.parse(await readFile(join(DATA, "geo", "districts.json"), "utf8")) as {
    width: number;
    height: number;
    districts: Record<string, { d: string; cx: number; cy: number }>;
  };
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

export const fmtPct = (x: number | null, digits = 1) => (x === null ? "—" : `${x.toFixed(digits)}%`);
