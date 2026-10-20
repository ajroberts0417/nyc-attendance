// Reads the NYC DOE daily attendance page. Shared by scripts/collect.mjs and the admin live check.
// The page is ASP.NET WebForms; replaying its "Microsoft Excel" postback returns every school at once.
export const SOURCE_URL = "https://www.nycenet.edu/PublicApps/Attendance.aspx";
const UA = "Mozilla/5.0 (nyc-attendance archive)";

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

export async function scrape() {
  const page = await fetchWithRetry(SOURCE_URL, { headers: { "User-Agent": UA } });
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

  const exp = await fetchWithRetry(SOURCE_URL, {
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
