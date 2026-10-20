import AdminView from "@/components/AdminView";
import { getDays } from "@/lib/data";

export const metadata = { title: "Admin · Attendance", robots: { index: false } };

export default async function Admin() {
  const days = await getDays();
  return (
    <main>
      <AdminView
        log={days.map((d) => ({
          date: d.date,
          citywide: d.citywide === null ? "" : d.citywide.toFixed(2),
          schools: d.schools,
          reported: d.reported,
          fetchedAt: d.fetchedAt,
        }))}
      />
    </main>
  );
}
