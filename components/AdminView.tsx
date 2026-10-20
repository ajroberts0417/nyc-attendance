"use client";

import { useEffect, useMemo, useState } from "react";
import { parseCsv } from "@/lib/csv";

export type DayLog = { date: string; citywide: string; schools: number; reported: number; fetchedAt: string };
type Row = { dbn: string; name: string; pct: string };
type Live = { fetchedAt: string; citywide: string; rows: (Row & { date: string })[] } | { error: string };

const toRows = (text: string): Row[] => parseCsv(text).map(([dbn, name, pct]) => ({ dbn, name, pct }));
const et = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });
const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

type Filter = "all" | "ns" | "new" | "missing" | "big";
const FILTERS: [Filter, string][] = [
  ["all", "All rows"],
  ["ns", "Not submitted"],
  ["new", "New vs. previous day"],
  ["missing", "Missing vs. previous day"],
  ["big", "Changed ≥ 10 pts"],
];

export default function AdminView({ log }: { log: DayLog[] }) {
  const [date, setDate] = useState(log[log.length - 1]?.date);
  const [files, setFiles] = useState<Record<string, Row[]>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [checking, setChecking] = useState(false);

  const idx = log.findIndex((d) => d.date === date);
  const prevDate = idx > 0 ? log[idx - 1].date : null;

  useEffect(() => {
    for (const d of [date, prevDate]) {
      if (!d || files[d]) continue;
      fetch(`/data/days/${d}.csv`)
        .then((r) => r.text())
        .then((t) => setFiles((f) => ({ ...f, [d]: toRows(t) })));
    }
  }, [date, prevDate, files]);

  const rows = useMemo(() => files[date] ?? [], [files, date]);
  const prev = useMemo(() => new Map((prevDate ? files[prevDate] ?? [] : []).map((r) => [r.dbn, r])), [files, prevDate]);

  const enriched = useMemo(() => {
    const here = new Set(rows.map((r) => r.dbn));
    const list = rows.map((r) => {
      const p = prev.get(r.dbn);
      const delta = p && r.pct && p.pct ? Number(r.pct) - Number(p.pct) : null;
      return { ...r, prevPct: p?.pct ?? null, delta, isNew: !!prevDate && !p, missing: false };
    });
    const gone = [...prev.values()]
      .filter((p) => !here.has(p.dbn))
      .map((p) => ({ dbn: p.dbn, name: p.name, pct: "", prevPct: p.pct, delta: null, isNew: false, missing: true }));
    return [...list, ...gone];
  }, [rows, prev, prevDate]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return enriched.filter((r) => {
      if (needle && !r.dbn.toLowerCase().includes(needle) && !r.name.toLowerCase().includes(needle)) return false;
      if (filter === "ns") return !r.missing && r.pct === "";
      if (filter === "new") return r.isNew;
      if (filter === "missing") return r.missing;
      if (filter === "big") return r.delta !== null && Math.abs(r.delta) >= 10;
      return true;
    });
  }, [enriched, q, filter]);

  const counts = useMemo(
    () => ({
      ns: enriched.filter((r) => !r.missing && r.pct === "").length,
      new: enriched.filter((r) => r.isNew).length,
      missing: enriched.filter((r) => r.missing).length,
      big: enriched.filter((r) => r.delta !== null && Math.abs(r.delta) >= 10).length,
    }),
    [enriched],
  );

  async function checkLive() {
    setChecking(true);
    try {
      setLive(await fetch("/api/source", { cache: "no-store" }).then((r) => r.json()));
    } catch (e) {
      setLive({ error: (e as Error).message });
    }
    setChecking(false);
  }

  const liveCheck = useMemo(() => {
    if (!live || "error" in live) return null;
    const liveDate = live.rows[0]?.date;
    const archived = log.find((d) => d.date === liveDate);
    const stored = liveDate ? files[liveDate] : undefined;
    if (!archived || !stored) return { liveDate, archived: !!archived, loaded: !!stored, diffs: [] as { dbn: string; name: string; stored: string | null; live: string | null }[] };
    const storedMap = new Map(stored.map((r) => [r.dbn, r]));
    const liveMap = new Map(live.rows.map((r) => [r.dbn, r]));
    const diffs: { dbn: string; name: string; stored: string | null; live: string | null }[] = [];
    for (const r of live.rows) {
      const s = storedMap.get(r.dbn);
      if (!s || s.pct !== r.pct || s.name !== r.name) diffs.push({ dbn: r.dbn, name: r.name, stored: s ? s.pct || "NS" : null, live: r.pct || "NS" });
    }
    for (const s of stored) if (!liveMap.has(s.dbn)) diffs.push({ dbn: s.dbn, name: s.name, stored: s.pct || "NS", live: null });
    return { liveDate, archived: true, loaded: true, diffs };
  }, [live, log, files]);

  // Load the archived file for the live date so the comparison can run.
  useEffect(() => {
    const d = liveCheck?.liveDate;
    if (d && liveCheck?.archived && !files[d]) {
      fetch(`/data/days/${d}.csv`)
        .then((r) => r.text())
        .then((t) => setFiles((f) => ({ ...f, [d]: toRows(t) })));
    }
  }, [liveCheck, files]);

  const result = !live
    ? null
    : "error" in live
      ? `Source unreachable: ${live.error}`
      : !liveCheck?.archived
        ? `Source shows ${liveCheck?.liveDate ? day(liveCheck.liveDate) : "—"}, not yet saved`
        : !liveCheck.loaded
          ? "Comparing…"
          : liveCheck.diffs.length
            ? `${liveCheck.diffs.length} rows differ from the source`
            : `Matches the source: ${live.rows.length.toLocaleString()} rows, ${live.citywide}%`;

  const th = "px-3 py-2 font-normal whitespace-nowrap";
  const bad = !!live && ("error" in live || !!liveCheck?.diffs.length);
  return (
    <div className="mt-10 space-y-14">
      <section className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          onClick={checkLive}
          disabled={checking}
          className="h-10 rounded-md bg-ink px-5 font-medium text-page hover:bg-accent disabled:opacity-50"
        >
          {checking ? "Checking…" : "Check source"}
        </button>
        {result && (
          <span className={bad ? "font-medium text-accent" : "text-ink-2"}>
            <span aria-hidden className="mr-1.5">{bad ? "✕" : liveCheck?.archived && liveCheck.loaded ? "✓" : "·"}</span>
            {result}
          </span>
        )}
      </section>

      {liveCheck && liveCheck.diffs.length > 0 && (
        <section className="max-h-72 overflow-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-page text-left text-ink-3">
              <tr className="border-b border-ink">
                <th className={th}>DBN</th>
                <th className={th}>School</th>
                <th className={`${th} text-right`}>Saved</th>
                <th className={`${th} text-right`}>Source</th>
              </tr>
            </thead>
            <tbody>
              {liveCheck.diffs.map((d) => (
                <tr key={d.dbn} className="border-b border-line">
                  <td className="px-3 py-1.5 text-ink-2">{d.dbn}</td>
                  <td className="px-3 py-1.5">{d.name}</td>
                  <td className="px-3 py-1.5 text-right">{d.stored ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right">{d.live ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-ink-3">
            <tr className="border-b border-ink">
              <th className={th}>Day</th>
              <th className={`${th} text-right`}>City</th>
              <th className={`${th} hidden text-right sm:table-cell`}>Schools</th>
              <th className={`${th} text-right`}>Not submitted</th>
              <th className={`${th} hidden text-right sm:table-cell`}>Saved (ET)</th>
              <th className={`${th} text-right`}>
                <a href="/data/citywide.csv" className="-my-2 inline-block py-2 hover:text-ink">CSV</a>
              </th>
            </tr>
          </thead>
          <tbody>
            {[...log].reverse().map((d) => (
              <tr
                key={d.date}
                onClick={() => setDate(d.date)}
                className={`cursor-pointer border-b border-line ${d.date === date ? "bg-hover" : "hover:bg-hover"}`}
              >
                <td className="px-3 py-2 whitespace-nowrap">{shortDay(d.date)}</td>
                <td className="px-3 py-2 text-right">{d.citywide || "—"}</td>
                <td className="hidden px-3 py-2 text-right sm:table-cell">{d.schools.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{(d.schools - d.reported).toLocaleString()}</td>
                <td className="hidden px-3 py-2 text-right text-ink-2 sm:table-cell">{et(d.fetchedAt)}</td>
                <td className="px-3 py-2 text-right">
                  <a href={`/data/days/${d.date}.csv`} onClick={(e) => e.stopPropagation()} className="-my-2 inline-block px-3 py-2 text-ink-2 hover:text-ink" aria-label={`Download ${d.date}.csv`}>
                    ↓
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink pb-3">
          <h2 className="mr-auto w-full font-display text-2xl sm:w-auto">{date ? day(date) : "—"}</h2>
          <select className="field" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Rows">
            {FILTERS.filter(([k]) => k === "all" || k === "ns" || prevDate).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
                {k !== "all" ? ` (${counts[k]})` : ""}
              </option>
            ))}
          </select>
          <input className="field min-w-0 flex-1 sm:w-56 sm:flex-none" placeholder="DBN or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search rows" />
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-page text-left text-ink-3">
              <tr className="border-b border-line">
                <th className={th}>DBN</th>
                <th className={th}>School</th>
                <th className={`${th} text-right`}>Attendance</th>
                {prevDate && <th className={`${th} hidden text-right sm:table-cell`}>{shortDay(prevDate)}</th>}
                {prevDate && <th className={`${th} text-right`}>Δ</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.dbn} className="border-b border-line hover:bg-hover">
                  <td className="px-3 py-1.5 text-ink-2">{r.dbn}</td>
                  <td className="px-3 py-1.5">
                    {r.name}
                    {r.isNew && <span className="ml-2 rounded bg-hover px-1.5 text-xs text-ink-2">new</span>}
                    {r.missing && <span className="ml-2 rounded bg-hover px-1.5 text-xs text-ink-2">gone</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right">{r.missing ? "" : r.pct || <span className="text-ink-3">NS</span>}</td>
                  {prevDate && <td className="hidden px-3 py-1.5 text-right text-ink-2 sm:table-cell">{r.prevPct === null ? "" : r.prevPct || "NS"}</td>}
                  {prevDate && (
                    <td className={`px-3 py-1.5 text-right ${r.delta !== null && Math.abs(r.delta) >= 10 ? "font-semibold text-accent" : "text-ink-2"}`}>
                      {r.delta === null ? "" : `${r.delta > 0 ? "+" : "−"}${Math.abs(r.delta).toFixed(2)}`}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!files[date] && <p className="py-4 text-ink-3">…</p>}
        </div>
        {shown.length !== enriched.length && (
          <p className="mt-3 text-sm text-ink-3 tabular-nums">
            {shown.length.toLocaleString()} / {enriched.length.toLocaleString()}
          </p>
        )}
      </section>
    </div>
  );
}
