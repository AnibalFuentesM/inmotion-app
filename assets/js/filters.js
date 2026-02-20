/**
 * @typedef {Object} FilterState
 * @property {string} searchText
 * @property {string} style
 * @property {string} level
 */

/**
 * @returns {FilterState}
 */
export function buildFilterState() {
  return {
    searchText: '',
    style: 'all',
    level: 'all'
  };
}

/**
 * @param {{ step_name: string; style: string; level: string; tags: string[] }} record
 * @returns {string}
 */
function searchBlob(record) {
  return [record.step_name, record.style, record.level, record.tags.join(' ')]
    .join(' ')
    .toLowerCase();
}

/**
 * @param {Array<{ step_name: string; style: string; level: string; tags: string[] }>} records
 * @param {FilterState} filterState
 * @returns {typeof records}
 */
export function applyFilters(records, filterState) {
  const safeRecords = Array.isArray(records) ? records : [];
  const searchText = String(filterState?.searchText || '').trim().toLowerCase();
  const selectedStyle = String(filterState?.style || 'all').toLowerCase();
  const selectedLevel = String(filterState?.level || 'all').toLowerCase();

  return safeRecords.filter((record) => {
    const matchesSearch = !searchText || searchBlob(record).includes(searchText);

    const recordStyle = String(record.style || '').toLowerCase();
    const matchesStyle = selectedStyle === 'all' || recordStyle === selectedStyle;

    const recordLevel = String(record.level || '').toLowerCase();
    const matchesLevel = selectedLevel === 'all' || recordLevel === selectedLevel;

    return matchesSearch && matchesStyle && matchesLevel;
  });
}

/**
 * @param {Array<Record<string, unknown>>} records
 * @param {'style' | 'level'} field
 * @returns {string[]}
 */
export function getUniqueFieldValues(records, field) {
  const values = new Set();

  records.forEach((record) => {
    const value = String(record[field] || '').trim();
    if (value && value.toLowerCase() !== 'unspecified') {
      values.add(value);
    }
  });

  return Array.from(values).sort((a, b) => a.localeCompare(b));
}
