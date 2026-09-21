export function normalizeCellText(text: string): string {
  let cleaned = text.split(/\s+/).join(" ").trim();
  cleaned = cleaned.replace(" ,", ",").replace(" .", ".").replace(" ;", ";").replace(" :", ":");
  return cleaned.trim();
}

export function isFreeCell(text: string): boolean {
  return normalizeCellText(text).toLowerCase() === "free";
}

export function comparisonText(text: string): string {
  return normalizeCellText(text).toLowerCase();
}

export function titleComparisonKey(text: string): string {
  const base = comparisonText(text);
  if (!base) return "";
  let cut = base.length;
  for (const marker of [" (feat.", " (ft.", " (featuring ", " - "]) {
    const index = base.indexOf(marker);
    if (index !== -1) cut = Math.min(cut, index);
  }
  return base.slice(0, cut).trim();
}
