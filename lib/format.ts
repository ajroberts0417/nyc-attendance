// Display helpers safe for both server and client code.

const KEEP_UPPER = new Set(["PS", "IS", "MS", "JHS", "HS", "NYC", "FDNY", "NYPD", "CUNY", "UN", "STEM", "II", "III", "IV", "VI", "VII", "KIPP", "YABC", "PSAL", "ACE", "UFT", "NY", "ASL", "SATI", "LGBT", "PTECH", "P-TECH", "HSMSE", "MS/HS", "IS/HS", "PS/IS", "PS/MS", "K-8", "6-12"]);
const KEEP_LOWER = new Set(["of", "and", "the", "for", "at", "in", "on", "a", "an", "de", "la", "del", "y"]);

// "P.S. 015 ROBERTO CLEMENTE" -> "P.S. 015 Roberto Clemente"
export function schoolName(raw: string) {
  let prev = ""; // previous word, so "P.S. 001 THE BERGEN" keeps "The"
  return raw
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((w) => {
      if (!w.trim() || w === "-" || w === "/") return w;
      const up = w.toUpperCase();
      const after = prev;
      prev = w;
      if (KEEP_UPPER.has(up.replace(/[.,:;()]/g, ""))) return up;
      if (/\d/.test(w) && /[a-z]/.test(w) && !/^\d+(st|nd|rd|th)$/.test(w)) return up; // codes like 21K, M560
      if (w.includes(".")) return up; // P.S., I.S.
      if (after && /^[a-z]+$/.test(after) && KEEP_LOWER.has(w)) return w;
      return w.replace(/(^|[(“"'])([a-z])/g, (_, p, c) => p + c.toUpperCase());
    })
    .join("");
}

export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

export const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
