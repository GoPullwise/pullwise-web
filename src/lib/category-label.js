export function isRemovedCategory(category) {
  return Boolean(category?.removedAt);
}

export function isActiveCategory(category) {
  return Boolean(category) && !category.archivedAt && !isRemovedCategory(category);
}

export function categoryDisplayName(category, removedLabel, fallback) {
  if (typeof category?.name !== "string" || !category.name) return fallback;
  return isRemovedCategory(category) ? `${category.name} (${removedLabel})` : category.name;
}
