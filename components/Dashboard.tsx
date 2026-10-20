"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import StripPlot from "@/components/StripPlot";
import TrendChart from "@/components/TrendChart";
import { longDate, schoolName } from "@/lib/format";

export type SchoolMeta = { dbn: string; name: string; district: string };
type Shapes = { width: number; height: number; districts: Record<string, { d: string; cx: number; cy: number }> };
type DayValues = Record<string, number | null>;

// Fixed bins so a color means the same thing every day; darker = lower attendance.
const BINS = [84, 86, 88, 90, 92, 94];
const binColor = (v: number | null) => {
  if (v === null) return "var(--nodata)";
  const i = BINS.findIndex((b) => v < b);
  return `var(--seq-${BINS.length + 1 - (i === -1 ? BINS.length : i)})`;
};

// Row bars run from the city value: ±SPAN points fills half the track.
const SPAN = 25;

const mean = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function parseDay(text: string): DayValues {
  const out: DayValues = {};
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const last = line.slice(line.lastIndexOf(",") + 1);
    out[line.slice(0, line.indexOf(","))] = last === "" ? null : Number(last);
  }
  return out;
}

export default function Dashboard({
  days,
  schools,
  initialDay,
  shapes,
}: {
  days: { date: string; citywide: number | null }[];
  schools: SchoolMeta[];
  initialDay: DayValues;
  shapes: Shapes;
}) {
  const latest = days[days.length - 1].date;
  const [date, setDate] = useState(latest);
  const [loaded, setLoaded] = useState<Record<string, DayValues>>({ [latest]: initialDay });
  const [district, setDistrict] = useState("");
  const [q, setQ] = useState("");
  const [asc, setAsc] = useState(true);
  const [limit, setLimit] = useState(60);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // School pages link here with ?district=NN.
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("district");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the URL after hydration
    if (d && shapes.districts[d.padStart(2, "0")]) setDistrict(d.padStart(2, "0"));
  }, [shapes]);

  const values = loaded[date];
  const idx = days.findIndex((d) => d.date === date);
  const city = days[idx]?.citywide ?? null;

  async function pick(d: string) {
    setDate(d);
    if (!loaded[d]) {
      const text = await fetch(`/data/days/${d}.csv`).then((r) => r.text());
      setLoaded((prev) => ({ ...prev, [d]: parseDay(text) }));
    }
  }

  const districtAvg = useMemo(() => {
    const groups: Record<string, (number | null)[]> = {};
    for (const s of schools) (groups[s.district] ??= []).push(values?.[s.dbn]);
    return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, mean(v)]));
  }, [schools, values]);

  // "D5" or "district 5" in the search box filters to that district.
  const dq = q.match(/^\s*d(?:istrict)?\s*(\d{1,2})\s*$/i)?.[1]?.padStart(2, "0");
  const activeDistrict = dq ?? district;

  const rows = useMemo(() => {
    const needle = dq ? "" : q.trim().toLowerCase();
    return schools
      .filter((s) => !activeDistrict || s.district === activeDistrict)
      .filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.dbn.toLowerCase().includes(needle))
      .map((s) => ({ ...s, pct: values?.[s.dbn] ?? null }))
      .sort((a, b) => (a.pct === null ? 1 : b.pct === null ? -1 : (a.pct - b.pct) * (asc ? 1 : -1)));
  }, [schools, values, activeDistrict, dq, q, asc]);

  const toggleDistrict = (id: string) => {
    setQ("");
    setDistrict((d) => (d === id ? "" : id));
    setLimit(60);
    if (window.innerWidth < 1024) listRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const all = values ? Object.values(values).filter((v): v is number => v !== null) : [];

  return (
    <>
      <section className="mt-10 grid items-end gap-x-14 gap-y-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <div className="-ml-2.5 flex items-center text-ink-2">
            <button
              aria-label="Previous school day"
              disabled={idx <= 0}
              onClick={() => pick(days[idx - 1].date)}
              className="grid size-10 place-items-center rounded-md text-lg hover:bg-hover disabled:opacity-30"
            >
              ‹
            </button>
            <span>
              Citywide · <span className="whitespace-nowrap">{longDate(date)}</span>
            </span>
            <button
              aria-label="Next school day"
              disabled={idx >= days.length - 1}
              onClick={() => pick(days[idx + 1].date)}
              className="grid size-10 place-items-center rounded-md text-lg hover:bg-hover disabled:opacity-30"
            >
              ›
            </button>
          </div>
          <div className="font-display text-[80px] leading-[0.9] font-light tracking-tight sm:text-[104px]" title="Preliminary, as of 4 pm">
            {city === null ? "—" : city.toFixed(1)}
            <span className="text-[0.45em] text-ink-2">%</span>
          </div>
        </div>
        {days.length > 1 ? (
          <TrendChart
            height={150}
            selected={date}
            onSelect={pick}
            series={[{ name: "Citywide", color: "var(--ink)", points: days.map((d) => ({ date: d.date, value: d.citywide })) }]}
          />
        ) : (
          all.length > 0 && <StripPlot values={all} mark={null} city={city} label={`${all.length.toLocaleString()} schools`} />
        )}
      </section>

      <section className="mt-14 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">
          <div className="relative lg:sticky lg:top-8">
            <svg viewBox={`0 0 ${shapes.width} ${shapes.height}`} className="mx-auto block h-auto w-full max-w-[400px]" role="img" aria-label="Attendance by school district">
              {Object.keys(shapes.districts).map((id) => (
                <path
                  key={id}
                  d={shapes.districts[id].d}
                  fill={binColor(districtAvg[id] ?? null)}
                  stroke={activeDistrict === id ? "var(--ink)" : "var(--page)"}
                  strokeWidth={activeDistrict === id ? 3 : 1}
                  className="cursor-pointer outline-none transition-opacity hover:opacity-75"
                  tabIndex={0}
                  aria-label={`District ${Number(id)}`}
                  onClick={() => toggleDistrict(id)}
                  onKeyDown={(e) => e.key === "Enter" && toggleDistrict(id)}
                  onPointerMove={(e) => {
                    const box = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                    setHover({ id, x: e.clientX - box.left, y: e.clientY - box.top });
                  }}
                  onPointerLeave={() => setHover(null)}
                />
              ))}
            </svg>
            {hover && (
              <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
                District {Number(hover.id)} <span className="ml-2 font-medium tabular-nums">{districtAvg[hover.id]?.toFixed(1) ?? "—"}%</span>
              </div>
            )}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-2 tabular-nums">
              <span>District average</span>
              <span>&lt;{BINS[0]}</span>
              <span className="flex outline outline-1 outline-line">
                {[...BINS, 100].map((b, i) => (
                  <span key={b} className="h-2.5 w-5" style={{ background: `var(--seq-${BINS.length + 1 - i})` }} />
                ))}
              </span>
              <span>{BINS[BINS.length - 1]}%+</span>
            </div>
          </div>
        </div>

        <div ref={listRef} className="order-1 min-w-0 scroll-mt-4 lg:order-2">
          <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b-2 border-ink bg-page px-4 py-2 sm:static sm:mx-0 sm:px-0">
            <svg viewBox="0 0 20 20" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4.5 4.5" strokeLinecap="round" />
            </svg>
            <input
              className="h-10 min-w-0 flex-1 bg-transparent text-xl outline-none placeholder:text-ink-2"
              placeholder="School, DBN or district"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search schools"
            />
            {district && !dq && (
              <button onClick={() => setDistrict("")} className="h-10 shrink-0 rounded-md bg-hover px-3 text-sm">
                District {Number(district)} <span className="tabular-nums text-ink-2">{districtAvg[district]?.toFixed(1)}%</span>
                <span className="ml-2 text-ink-2" aria-label="Clear district">
                  ×
                </span>
              </button>
            )}
            <button onClick={() => setAsc((a) => !a)} className="h-10 shrink-0 rounded-md px-2 text-sm text-ink-2 hover:bg-hover hover:text-ink">
              {asc ? "Lowest first" : "Highest first"}
            </button>
          </div>

          <ol>
            {rows.slice(0, limit).map((r) => {
              const d = r.pct !== null && city !== null ? Math.max(-SPAN, Math.min(SPAN, r.pct - city)) : null;
              return (
                <li key={r.dbn}>
                  <Link href={`/school/${r.dbn}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-2.5 hover:bg-hover">
                    <span className="min-w-0 group-hover:text-accent sm:truncate">
                      {schoolName(r.name)}
                      <span className="block text-xs text-ink-3 sm:ml-2 sm:inline">{r.dbn}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="relative hidden h-3 w-32 sm:block" title={d === null ? undefined : `${d >= 0 ? "+" : "−"}${Math.abs(r.pct! - city!).toFixed(1)} vs city`}>
                        <span className="absolute inset-y-0 left-1/2 w-px bg-ink-3" />
                        {d !== null && (
                          <span
                            className="absolute top-1/2 h-1 -translate-y-1/2"
                            style={{
                              left: d < 0 ? `${50 + (d / SPAN) * 50}%` : "50%",
                              width: `${(Math.abs(d) / SPAN) * 50}%`,
                              background: d < 0 ? "var(--ink)" : "var(--seq-3)",
                            }}
                          />
                        )}
                      </span>
                      <span className="w-10 text-right tabular-nums">{r.pct === null ? <span className="text-ink-3">—</span> : r.pct.toFixed(1)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          {rows.length > limit && (
            <button onClick={() => setLimit((l) => l + 200)} className="mt-2 h-12 w-full text-ink-2 hover:text-ink">
              {(rows.length - limit).toLocaleString()} more
            </button>
          )}
          {rows.length === 0 && <p className="py-6 text-ink-2">No school matches “{q}”.</p>}
        </div>
      </section>
    </>
  );
}
