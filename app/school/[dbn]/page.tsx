import Link from "next/link";
import { notFound } from "next/navigation";
import TrendChart from "@/components/TrendChart";
import { fmtDate, fmtPct, getDays, getSchools, mean } from "@/lib/data";

export async function generateStaticParams() {
  return (await getSchools()).map((s) => ({ dbn: s.dbn }));
}

export async function generateMetadata({ params }: PageProps<"/school/[dbn]">) {
  const { dbn } = await params;
  const school = (await getSchools()).find((s) => s.dbn === dbn);
  return { title: school ? `${school.name} · NYC School Attendance` : "NYC School Attendance" };
}

export default async function SchoolPage({ params }: PageProps<"/school/[dbn]">) {
  const { dbn } = await params;
  const [schools, days] = await Promise.all([getSchools(), getDays()]);
  const school = schools.find((s) => s.dbn === dbn);
  if (!school) notFound();

  const reported = school.history.filter((h): h is { date: string; pct: number } => h.pct !== null);
  const latest = school.history[school.history.length - 1];
  const stats = [
    [fmtPct(latest?.pct ?? null, 2), fmtDate(latest.date, { month: "short", day: "numeric" })],
    [fmtPct(mean(reported.map((h) => h.pct)), 2), "Average"],
    [fmtPct(reported.length ? Math.min(...reported.map((h) => h.pct)) : null, 2), "Lowest day"],
    [reported.length.toLocaleString(), reported.length === 1 ? "Day recorded" : "Days recorded"],
  ];
  const citywide = new Map(days.map((d) => [d.date, d.citywide]));

  return (
    <main>
      <Link href="/" className="text-sm text-accent hover:underline">
        ← All schools
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{school.name}</h1>
      <p className="mt-1 text-sm text-ink-3">
        <span className="font-mono">{school.dbn}</span> · {school.borough} · District {Number(school.district)}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([v, k]) => (
          <div key={k} className="card flex flex-col-reverse px-4 py-3">
            <dd className="text-2xl font-semibold">{v}</dd>
            <dt className="text-[11px] uppercase tracking-wider text-ink-3">{k}</dt>
          </div>
        ))}
      </dl>

      <section className="card mt-6 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Daily attendance</h2>
          <div className="flex gap-4 text-xs text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded bg-accent" />
              This school
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: "var(--ref)" }} />
              Citywide
            </span>
          </div>
        </div>
        <div className="mt-3">
          <TrendChart
            series={[
              { name: "Citywide", color: "var(--ref)", dashed: true, points: days.map((d) => ({ date: d.date, value: d.citywide })) },
              { name: "This school", color: "var(--accent)", points: school.history.map((h) => ({ date: h.date, value: h.pct })) },
            ]}
          />
        </div>
      </section>

      <section className="card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 text-right font-medium">Attendance</th>
              <th className="px-4 py-2 text-right font-medium">Citywide</th>
            </tr>
          </thead>
          <tbody>
            {[...school.history].reverse().map((h) => (
              <tr key={h.date} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{fmtDate(h.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</td>
                <td className="px-4 py-2 text-right font-medium">
                  {h.pct === null ? <span className="text-xs font-normal text-ink-3">Not submitted</span> : `${h.pct.toFixed(2)}%`}
                </td>
                <td className="px-4 py-2 text-right text-ink-2">{fmtPct(citywide.get(h.date) ?? null, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
