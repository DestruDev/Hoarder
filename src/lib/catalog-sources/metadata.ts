const SEASON_NAMES = ['Winter', 'Spring', 'Summer', 'Fall'] as const;

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export function seasonLabel(year: number | null | undefined, month: number | null | undefined): string | null {
  if (year == null || !Number.isFinite(year) || year <= 0) {
    return null;
  }

  if (month == null || month < 1 || month > 12) {
    return String(year);
  }

  return `${SEASON_NAMES[Math.floor((month - 1) / 3)]} ${year}`;
}

export function seasonFromIsoDate(date: string | null | undefined): string | null {
  const match = date?.trim().match(/^(\d{4})(?:-(\d{2}))?/);
  if (!match) {
    return null;
  }

  return seasonLabel(Number(match[1]), match[2] ? Number(match[2]) : null);
}

export function seasonFromLooseDate(date: string | null | undefined): string | null {
  const text = date?.trim();
  if (!text) {
    return null;
  }

  const iso = seasonFromIsoDate(text);
  if (iso) {
    return iso;
  }

  const year = text.match(/\b(\d{4})\b/);
  if (!year) {
    return null;
  }

  const month = text.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  return seasonLabel(Number(year[1]), month ? MONTHS[month[1]] : null);
}

export function joinGenres(genres: Array<string | null | undefined> | null | undefined): string | null {
  const unique: string[] = [];

  for (const genre of genres ?? []) {
    const name = genre?.trim();
    if (name && !unique.includes(name)) {
      unique.push(name);
    }
  }

  return unique.length > 0 ? unique.slice(0, 5).join(', ') : null;
}

export function joinNames(names: Array<string | null | undefined> | null | undefined, limit = 2): string | null {
  return joinGenres(names)?.split(', ').slice(0, limit).join(', ') ?? null;
}

export function cleanSynopsis(text: string | null | undefined): string | null {
  const cleaned = text
    ?.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\(Source:[^)]*\)\s*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned ? cleaned : null;
}
