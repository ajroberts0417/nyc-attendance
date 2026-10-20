"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type SchoolMeta = { dbn: string; name: string; borough: string; district: string; avg: number | null };
type Shapes = { width: number; height: number; districts: Record<string, { d: string; cx: number; cy: number }> };

const BOROUGHS = ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"];
// Fixed bins so colors mean the same thing every day.
const BINS = [84, 86, 88, 90, 92, 94];
const binColor = (v: number | null) => {
  if (v === null) return "var(--nodata)";
  const i = BINS.findIndex((b) => v < b);
  return `var(--seq-${(i === -1 ? BINS.length : i) + 1})`;
};

const mean = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v.toFixed(d)}%`);
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });

function parseDay(text: string): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const line of text.trim().split("\n").slice(1)) {
    const dbn = line.slice(0, line.indexOf(","));
    const last = line.slice(line.lastIndexOf(",") + 1);
    out[dbn] = last === "" ? null : Number(last);
  }
  return out;
}

type SortKey = "name" | "borough" | "district" | "pct" | "avg";

export default function Explorer({
  schools,
  dates,
  initialDate,
  initialDay,
  shapes,
}: {
  schools: SchoolMeta[];
  dates: string[];
  initialDate: string;
  initialDay: Record<string, number | null>;
  shapes: Shapes;
}) {
  const [date, setDate] = useState(initialDate);
  const [days, setDays] = useState<Record<string, Record<string, number | null>>>({ [initialDate]: initialDay });
  const [borough, setBorough] = useState("");
  const [district, setDistrict] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "pct", dir: 1 });
  const [limit, setLimit] = useState(50);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  const day = days[date];

  async function pickDate(d: string) {
    setDate(d);
    if (!days[d]) {
      const text = await fetch(`/data/days/${d}.csv`).then((r) => r.text());
      setDays((prev) => ({ ...prev, [d]: parseDay(text) }));
    }
  }

  const districtAvg = useMemo(() => {
    const groups: Record<string, (number | null)[]> = {};
    for (const s of schools) (groups[s.district] ??= []).push(day?.[s.dbn]);
    return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, mean(v)]));
  }, [schools, day]);

  const boroughAvg = useMemo(
    () =>
      BOROUGHS.map((b) => {
        const xs = schools.filter((s) => s.borough === b);
        return { name: b, avg: mean(xs.map((s) => day?.[s.dbn])), count: xs.length };
      }),
    [schools, day],
  );

  const mapDistricts = Object.keys(shapes.districts).sort();
  const ranked = mapDistricts.map((id) => ({ id, avg: districtAvg[id] ?? null })).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = schools
      .filter((s) => (!borough || s.borough === borough) && (!district || s.district === district))
      .filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.dbn.toLowerCase().includes(needle))
      .map((s) => ({ ...s, pct: day?.[s.dbn] ?? null }));
    const val = (r: (typeof list)[number]) => r[sort.key];
    return list.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [schools, day, borough, district, q, sort]);

  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" || key === "borough" || key === "district" ? 1 : -1 }));

  const th = (key: SortKey, label: string, cls = "") => (
    <th className={`px-3 py-2 font-medium ${cls}`}>
      <button onClick={() => setSortKey(key)} className="inline-flex items-center gap-1 hover:text-ink">
        {label}
        <span className="text-[10px]">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );

  const toggleDistrict = (id: string) => {
    setDistrict((d) => (d === id ? "" : id));
    setLimit(50);
  };

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="field" value={date} onChange={(e) => pickDate(e.target.value)} aria-label="Day">
          {[...dates].reverse().map((d) => (
            <option key={d} value={d}>
              {longDate(d)}
            </option>
          ))}
        </select>
        <select className="field" value={borough} onChange={(e) => setBorough(e.target.value)} aria-label="Borough">
          <option value="">All boroughs</option>
          {BOROUGHS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <select className="field" value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="District">
          <option value="">All districts</option>
          {[...new Set(schools.map((s) => s.district))].sort().map((d) => (
            <option key={d} value={d}>
              District {Number(d)}
            </option>
          ))}
        </select>
        <input
          className="field min-w-0 flex-1 sm:max-w-xs"
          placeholder="Search school or DBN…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {(borough || district || q) && (
          <button className="text-sm text-accent hover:underline" onClick={() => (setBorough(""), setDistrict(""), setQ(""))}>
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {boroughAvg.map((b) => (
          <button
            key={b.name}
            onClick={() => setBorough((x) => (x === b.name ? "" : b.name))}
            className={`card px-4 py-3 text-left transition-colors last:col-span-2 sm:last:col-span-1 ${borough === b.name ? "ring-2 ring-accent" : "hover:border-ink-3"}`}
          >
            <div className="text-xl font-semibold">{pct(b.avg)}</div>
            <div className="text-[11px] uppercase tracking-wide text-ink-3">
              {b.name} · {b.count.toLocaleString()}
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card relative p-4">
          <h2 className="text-sm font-semibold">By district</h2>
          <p className="text-xs text-ink-3">Average school attendance · click to filter</p>
          <svg viewBox={`0 0 ${shapes.width} ${shapes.height}`} className="mx-auto mt-2 block h-auto w-full max-w-[460px]">
            {mapDistricts.map((id) => (
              <path
                key={id}
                d={shapes.districts[id].d}
                fill={binColor(districtAvg[id] ?? null)}
                stroke={district === id ? "var(--ink)" : "var(--surface)"}
                strokeWidth={district === id ? 2.5 : 1}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onClick={() => toggleDistrict(id)}
                onPointerMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                  setHover({ id, x: e.clientX - box.left, y: e.clientY - box.top });
                }}
                onPointerLeave={() => setHover(null)}
              />
            ))}
          </svg>
          {hover && (
            <div className="tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
              <div className="font-medium">District {Number(hover.id)}</div>
              <div className="text-ink-2">{pct(districtAvg[hover.id], 2)}</div>
            </div>
          )}
          <div className="mt-2 flex items-center justify-center gap-0.5 text-[11px] text-ink-3">
            <span className="mr-1">&lt;84%</span>
            {[...BINS, 100].map((b, i) => (
              <span key={b} className="h-2.5 w-7 first:rounded-l last:rounded-r" style={{ background: `var(--seq-${i + 1})` }} />
            ))}
            <span className="ml-1">94%+</span>
          </div>
        </div>

        <div>
          <div className="card h-full p-4">
            <h2 className="text-sm font-semibold">Districts, ranked</h2>
            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-1 lg:gap-y-[3px]">
              {ranked.map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggleDistrict(r.id)}
                  className={`group flex items-center gap-2 rounded px-1 text-left text-xs ${district === r.id ? "bg-page" : ""}`}
                >
                  <span className="w-5 shrink-0 text-right text-ink-3">{Number(r.id)}</span>
                  <span className="relative h-2.5 flex-1 rounded-sm bg-page">
                    <span
                      className="absolute inset-y-0 left-0 rounded-sm group-hover:opacity-80"
                      style={{ width: `${r.avg === null ? 0 : Math.max(2, ((r.avg - 75) / 25) * 100)}%`, background: binColor(r.avg) }}
                    />
                  </span>
                  <span className="w-11 shrink-0 text-right font-medium">{pct(r.avg)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Schools</h2>
          <span className="text-xs text-ink-3">
            {rows.length.toLocaleString()} of {schools.length.toLocaleString()}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
              <tr className="border-b border-border">
                {th("name", "School")}
                {th("borough", "Borough", "hidden sm:table-cell")}
                {th("district", "Dist.", "hidden sm:table-cell")}
                {th("pct", longDate(date).replace(/, \d{4}$/, ""), "text-right")}
                {th("avg", "Avg, all days", "hidden text-right md:table-cell")}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((r) => (
                <tr key={r.dbn} className="border-b border-border last:border-0 hover:bg-page">
                  <td className="px-3 py-2">
                    <Link href={`/school/${r.dbn}`} className="font-medium hover:text-accent">
                      {r.name}
                    </Link>
                    <div className="font-mono text-[11px] text-ink-3">{r.dbn}</div>
                  </td>
                  <td className="hidden px-3 py-2 text-ink-2 sm:table-cell">{r.borough}</td>
                  <td className="hidden px-3 py-2 text-ink-2 sm:table-cell">{Number(r.district)}</td>
                  <td className="px-3 py-2 text-right">
                    {r.pct === null ? (
                      <span className="text-xs text-ink-3">Not submitted</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="hidden h-1.5 w-16 rounded-full bg-page sm:inline-block">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${r.pct}%` }} />
                        </span>
                        <span className="w-14 font-medium">{r.pct.toFixed(2)}%</span>
                      </span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2 text-right text-ink-2 md:table-cell">{pct(r.avg, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <button onClick={() => setLimit((l) => l + 100)} className="w-full border-t border-border py-3 text-sm text-accent hover:bg-page">
            Show more
          </button>
        )}
      </div>
    </section>
  );
}
