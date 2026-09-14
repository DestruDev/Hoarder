export function matchesSearchText(text: string, query: string): boolean {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  let queryIndex = 0;
  for (const character of normalizedText) {
    if (character === normalizedQuery[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === normalizedQuery.length) {
        return true;
      }
    }
  }

  return false;
}

export function matchesMediaName(title: string, query: string): boolean {
  return matchesSearchText(title, query);
}
