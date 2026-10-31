export function scoreOutOfTen(value: number | null | undefined, scale = 10): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const score = scale === 10 ? value : (value / scale) * 10;
  if (score <= 0 || score > 10) {
    return null;
  }

  return Math.round(score * 100) / 100;
}

export function ratioScoreOutOfTen(
  positive: number | null | undefined,
  negative: number | null | undefined,
): number | null {
  const likes = positive ?? 0;
  const dislikes = negative ?? 0;
  const total = likes + dislikes;

  if (total <= 0) {
    return null;
  }

  return scoreOutOfTen((likes / total) * 10);
}
