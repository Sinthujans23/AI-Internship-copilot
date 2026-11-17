export type DiffLine = { kind: "same" | "added" | "removed"; text: string };
// Bound the LCS matrix; long documents fall back to a clearly labelled excerpt.
export function compareCvText(before: string, after: string) {
  const split = (s: string) => s.replace(/\r\n?/g, "\n").split("\n").map(line => line.trim()).filter(Boolean);
  const allA = split(before), allB = split(after), a = allA.slice(0, 400), b = allB.slice(0, 400);
  const matrix = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    matrix[i][j] = a[i] === b[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
  }
  const lines: DiffLine[] = []; let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { lines.push({ kind: "same", text: a[i++] }); j++; }
    else if (i < a.length && (j === b.length || matrix[i + 1][j] >= matrix[i][j + 1])) lines.push({ kind: "removed", text: a[i++] });
    else lines.push({ kind: "added", text: b[j++] });
  }
  return { lines, truncated: allA.length > 400 || allB.length > 400,
    added: lines.filter(l => l.kind === "added").length, removed: lines.filter(l => l.kind === "removed").length };
}
