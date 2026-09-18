/**
 * @typedef {Object} FilterState
 * @property {string} searchText
 * @property {string} style
 * @property {string} level
 * @property {'all' | 'saved' | 'recent'} view
 * @property {'all' | '7d' | '30d'} period
 */

/**
 * @returns {FilterState}
 */
export function buildFilterState() {
  return {
    searchText: '',
    style: 'all',
    level: 'all',
    view: 'all',
    period: 'all'
  };
}

/**
 * @param {unknown} text
 * @returns {string}
 */
export function normalizeSearchText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * @param {{ step_name: string; style: string; level: string; tags: string[] }} record
 * @returns {string}
 */
function searchBlob(record) {
  return normalizeSearchText(
    [record.step_name, record.style, record.level, (record.tags || []).join(' ')].join(' ')
  );
}

/**
 * @param {{ parsedDate: Date | null }} record
 * @param {'all' | '7d' | '30d' | string} period
 * @returns {boolean}
 */
function matchesPeriod(record, period) {
  if (!period || period === 'all') return true;
  if (!record.parsedDate || !(record.parsedDate instanceof Date) || Number.isNaN(record.parsedDate.getTime())) {
    return false;
  }

  // Incluir hoy y los días anteriores del período, sin fechas futuras.
  const days = period === '7d' ? 7 : period === '30d' ? 30 : null;
  if (!days) return true;
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return record.parsedDate >= start && record.parsedDate < end;
}

/**
 * @param {Array<any>} records
 * @param {FilterState} filterState
 * @param {{ savedIds?: string[]; recentIds?: string[] }} [options={}]
 * @returns {Array<any>}
 */
export function applyFilters(records, filterState, options = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const searchText = normalizeSearchText(filterState?.searchText).trim();
  const selectedStyle = String(filterState?.style || 'all').toLowerCase();
  const selectedLevel = String(filterState?.level || 'all').toLowerCase();
  const selectedPeriod = String(filterState?.period || 'all');
  const selectedView = String(filterState?.view || 'all');

  const savedIds = new Set(options.savedIds || []);
  const recentIds = Array.isArray(options.recentIds) ? options.recentIds : [];
  const recentMap = new Map(recentIds.map((id, index) => [id, index]));

  const filtered = safeRecords.filter((record) => {
    // View filtering
    if (selectedView === 'saved') {
      const isSaved = savedIds.has(record.stableId) || savedIds.has(record.id);
      if (!isSaved) return false;
    } else if (selectedView === 'recent') {
      const isRecent = recentMap.has(record.stableId) || recentMap.has(record.id);
      if (!isRecent) return false;
    }

    // Relative date period filtering
    if (!matchesPeriod(record, selectedPeriod)) {
      return false;
    }

    // Style
    const recordStyle = String(record.style || '').toLowerCase();
    if (selectedStyle !== 'all' && recordStyle !== selectedStyle) {
      return false;
    }

    // Level
    const recordLevel = String(record.level || '').toLowerCase();
    if (selectedLevel !== 'all' && recordLevel !== selectedLevel) {
      return false;
    }

    // Search text
    if (searchText && !searchBlob(record).includes(searchText)) {
      return false;
    }

    return true;
  });

  if (selectedView === 'recent') {
    filtered.sort((a, b) => {
      const idxA = recentMap.has(a.stableId)
        ? recentMap.get(a.stableId)
        : (recentMap.has(a.id) ? recentMap.get(a.id) : 9999);
      const idxB = recentMap.has(b.stableId)
        ? recentMap.get(b.stableId)
        : (recentMap.has(b.id) ? recentMap.get(b.id) : 9999);
      return idxA - idxB;
    });
  }

  return filtered;
}

/**
 * Return active filter descriptors for chip rendering.
 *
 * @param {FilterState} filterState
 * @returns {Array<{ key: 'searchText' | 'style' | 'level' | 'period'; label: string }>}
 */
export function getActiveFilters(filterState) {
  const active = [];

  if (filterState?.searchText?.trim()) {
    active.push({
      key: 'searchText',
      label: `"${filterState.searchText.trim()}"`
    });
  }

  if (filterState?.style && filterState.style !== 'all') {
    active.push({
      key: 'style',
      label: `Estilo: ${filterState.style}`
    });
  }

  if (filterState?.level && filterState.level !== 'all') {
    active.push({
      key: 'level',
      label: `Nivel: ${filterState.level}`
    });
  }

  if (filterState?.period && filterState.period !== 'all') {
    const periodMap = {
      '7d': 'Últimos 7 días',
      '30d': 'Últimos 30 días'
    };
    active.push({
      key: 'period',
      label: periodMap[filterState.period] || filterState.period
    });
  }

  return active;
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
