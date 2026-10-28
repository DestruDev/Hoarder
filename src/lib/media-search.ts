export function matchesSearchText(text: string, query: string): boolean {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return normalizedText.includes(normalizedQuery);
}

export function matchesMediaName(title: string, query: string): boolean {
  return matchesSearchText(title, query);
}
