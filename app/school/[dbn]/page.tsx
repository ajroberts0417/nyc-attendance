import Link from "next/link";
import { notFound } from "next/navigation";
import StripPlot from "@/components/StripPlot";
import TrendChart from "@/components/TrendChart";
import { fmtPct, getDay, getDays, getSchools, mean } from "@/lib/data";
import { longDate, schoolName, shortDate } from "@/lib/format";

export async function generateStaticParams() {
  return (await getSchools()).map((s) => ({ dbn: s.dbn }));
}

export async function generateMetadata({ params }: PageProps<"/school/[dbn]">) {
  const { dbn } = await params;
  const school = (await getSchools()).find((s) => s.dbn === dbn);
  return { title: school ? `${schoolName(school.name)} · Attendance` : "Attendance" };
}

export default async function SchoolPage({ params }: PageProps<"/school/[dbn]">) {
  const { dbn } = await params;
  const [schools, days] = await Promise.all([getSchools(), getDays()]);
  const school = schools.find((s) => s.dbn === dbn);
  if (!school) notFound();

  const latest = school.history[school.history.length - 1];
  const cityByDate = new Map(days.map((d) => [d.date, d.citywide]));
  const city = cityByDate.get(latest.date) ?? null;
  const diff = latest.pct !== null && city !== null ? latest.pct - city : null;
  const history = days.length > 1;
  const sameDay = await getDay(latest.date);
  const everyone = sameDay.map((r) => r.pct).filter((v): v is number => v !== null);
  const districtAvg = mean(sameDay.filter((r) => r.dbn.slice(0, 2) === school.district).map((r) => r.pct));
  const vsDistrict = latest.pct !== null && districtAvg !== null ? latest.pct - districtAvg : null;
  const signed = (x: number) => {
    const r = Math.abs(x).toFixed(1);
    return r === "0.0" ? r : `${x > 0 ? "+" : "−"}${r}`;
  };

  return (
    <main className="mt-10">
      <h1 className="max-w-3xl font-display text-[32px] leading-tight font-medium tracking-tight sm:text-[44px]">{schoolName(school.name)}</h1>
      <p className="mt-2 text-ink-2">
        {school.dbn} · {school.borough} ·{" "}
        <Link href={`/?district=${school.district}`} className="underline decoration-line underline-offset-4 hover:text-ink">
          District {Number(school.district)}
        </Link>
      </p>

      <div className="mt-10 flex flex-wrap items-end gap-x-8 gap-y-2">
        <div className="font-display text-[72px] leading-[0.9] font-light tracking-tight sm:text-[88px]">
          {latest.pct === null ? "—" : latest.pct.toFixed(1)}
          <span className="text-[0.45em] text-ink-3">%</span>
        </div>
        <div className="pb-2 text-ink-2">
          <div>{longDate(latest.date)}</div>
          {diff !== null && <div className="tabular-nums">{signed(diff)} vs city</div>}
          {vsDistrict !== null && <div className="tabular-nums">{signed(vsDistrict)} vs district</div>}
        </div>
      </div>

      <section className="mt-10">
        {history ? (
          <TrendChart
            height={240}
            series={[
              { name: "City", color: "var(--ink-3)", dashed: true, points: days.map((d) => ({ date: d.date, value: d.citywide })) },
              { name: "School", color: "var(--accent)", points: school.history.map((h) => ({ date: h.date, value: h.pct })) },
            ]}
          />
        ) : (
          <StripPlot values={everyone} mark={latest.pct} city={city} label={`${everyone.length.toLocaleString()} schools`} />
        )}
      </section>

      {history && (
        <details className="mt-10 border-t border-line">
          <summary className="cursor-pointer py-3 text-ink-2 hover:text-ink">{school.history.length} school days</summary>
          <table className="w-full max-w-md text-sm tabular-nums">
            <tbody>
              {[...school.history].reverse().map((h) => (
                <tr key={h.date} className="border-b border-line">
                  <td className="py-2">{shortDate(h.date)}</td>
                  <td className="py-2 text-right">{fmtPct(h.pct)}</td>
                  <td className="py-2 text-right text-ink-3">{fmtPct(cityByDate.get(h.date) ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </main>
  );
}
