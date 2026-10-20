// Minimal RFC 4180 reader for the archive files (header row dropped).
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
