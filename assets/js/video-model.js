/**
 * @typedef {Object} VideoRecord
 * @property {string} id
 * @property {string} step_name
 * @property {string} style
 * @property {string} level
 * @property {string} date
 * @property {string} video_url
 * @property {string} thumbnail_url
 * @property {string[]} tags
 * @property {string} notes
 * @property {Date | null} parsedDate
 */

const CANONICAL_COLUMNS = [
  'id',
  'step_name',
  'style',
  'level',
  'date',
  'video_url',
  'thumbnail_url',
  'tags',
  'notes'
];

/**
 * @param {string} key
 * @returns {string}
 */
function normalizeKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Parse tags from CSV-like string.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
function parseTags(value) {
  if (value == null) {
    return [];
  }

  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Parse dates coming from sheet values.
 * Supports ISO-like strings and GViz Date(YYYY,M,D) format.
 *
 * @param {string} dateValue
 * @returns {Date | null}
 */
function parseDate(dateValue) {
  const raw = String(dateValue || '').trim();
  if (!raw) {
    return null;
  }

  const gvizDateMatch = raw.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,\d{1,2},\d{1,2},\d{1,2})?\)$/);
  if (gvizDateMatch) {
    const year = Number(gvizDateMatch[1]);
    const monthIndex = Number(gvizDateMatch[2]);
    const day = Number(gvizDateMatch[3]);
    const parsed = new Date(year, monthIndex, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * @param {Date | null} parsedDate
 * @param {string} rawDate
 * @returns {string}
 */
export function formatDisplayDate(parsedDate, rawDate) {
  if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
    return new Intl.DateTimeFormat('es-MX', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(parsedDate);
  }

  return rawDate || 'Fecha desconocida';
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isRawFilename(name) {
  const trimmed = String(name || '').trim();
  return /^whatsapp\s+video/i.test(trimmed) || /^\d+$/.test(trimmed);
}

/**
 * @param {string} rawName
 * @param {string} style
 * @param {Date | null} parsedDate
 * @param {string} rawDate
 * @returns {string}
 */
function sanitizeStepName(rawName, style, parsedDate, rawDate) {
  const trimmed = String(rawName || '').trim();
  if (!trimmed) {
    return 'Untitled step';
  }

  if (isRawFilename(trimmed)) {
    const formattedDate = formatDisplayDate(parsedDate, rawDate);
    const stylePart = String(style || '').trim() || 'General';
    return `Recap ${stylePart} · ${formattedDate}`;
  }

  return trimmed;
}

const CANONICAL_LEVEL_MAP = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
  lvl1: 'Lvl1',
  lvl2: 'Lvl2',
  lvl3: 'Lvl3',
  lvl4: 'Lvl4',
  lvl5: 'Lvl5'
};

/**
 * Normaliza mayúsculas, espacios y tildes para comparar taxonomía.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeTaxonomyToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

/**
 * @param {string} rawLevel
 * @returns {string}
 */
function sanitizeLevel(rawLevel) {
  const trimmed = String(rawLevel || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'unspecified') {
    return 'Unspecified';
  }

  const token = normalizeTaxonomyToken(trimmed);
  if (CANONICAL_LEVEL_MAP[token]) {
    // Si coincide con la taxonomía pero viene en minúsculas/sin tilde, normalizamos la presentación
    return trimmed.toLowerCase() === token ? CANONICAL_LEVEL_MAP[token] : trimmed;
  }

  return 'Taller / Especial';
}

/**
 * @param {VideoRecord} a
 * @param {VideoRecord} b
 * @returns {number}
 */
export function compareRecordsDesc(a, b) {
  if (a.parsedDate && b.parsedDate) {
    const diff = b.parsedDate.getTime() - a.parsedDate.getTime();
    if (diff !== 0) return diff;
  } else if (a.parsedDate && !b.parsedDate) {
    return -1;
  } else if (!a.parsedDate && b.parsedDate) {
    return 1;
  } else {
    const dateFallback = (b.date || '').localeCompare(a.date || '');
    if (dateFallback !== 0) return dateFallback;
  }

  return (a.id || '').localeCompare(b.id || '');
}

/**
 * @param {VideoRecord} a
 * @param {VideoRecord} b
 * @returns {number}
 */
export function compareRecordsAsc(a, b) {
  if (a.parsedDate && b.parsedDate) {
    const diff = a.parsedDate.getTime() - b.parsedDate.getTime();
    if (diff !== 0) return diff;
  } else if (a.parsedDate && !b.parsedDate) {
    return -1;
  } else if (!a.parsedDate && b.parsedDate) {
    return 1;
  } else {
    const dateFallback = (a.date || '').localeCompare(b.date || '');
    if (dateFallback !== 0) return dateFallback;
  }

  return (a.id || '').localeCompare(b.id || '');
}

/**
 * @param {VideoRecord} a
 * @param {VideoRecord} b
 * @returns {number}
 */
export function compareRecordsAlpha(a, b) {
  const nameA = String(a.step_name || '');
  const nameB = String(b.step_name || '');
  const diff = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
  if (diff !== 0) return diff;

  return compareRecordsDesc(a, b);
}

/**
 * Alias for backward compatibility.
 */
export const compareRecords = compareRecordsDesc;

/**
 * Sort video records by the specified sort order.
 *
 * @param {VideoRecord[]} records
 * @param {'recent' | 'oldest' | 'alpha' | string} sortOrder
 * @returns {VideoRecord[]}
 */
export function sortVideoRecords(records, sortOrder = 'recent') {
  const safe = Array.isArray(records) ? [...records] : [];
  switch (sortOrder) {
    case 'oldest':
      return safe.sort(compareRecordsAsc);
    case 'alpha':
      return safe.sort(compareRecordsAlpha);
    case 'recent':
    default:
      return safe.sort(compareRecordsDesc);
  }
}

/**
 * Convert any row into a canonical record with safe defaults.
 *
 * @param {Record<string, unknown>} row
 * @param {number} index
 * @returns {VideoRecord}
 */
function normalizeRow(row, index) {
  /** @type {Record<string, unknown>} */
  const normalizedMap = {};

  Object.entries(row || {}).forEach(([key, value]) => {
    normalizedMap[normalizeKey(key)] = value;
  });

  const idValue = String(normalizedMap.id || '').trim();
  const stepName = String(normalizedMap.step_name || '').trim();
  const style = String(normalizedMap.style || '').trim();
  const level = String(normalizedMap.level || '').trim();
  const date = String(normalizedMap.date || '').trim();
  const videoUrl = String(normalizedMap.video_url || '').trim();
  const thumbnailUrl = String(normalizedMap.thumbnail_url || '').trim();
  const notes = String(normalizedMap.notes || '').trim();

  const parsed = parseDate(date);
  const sanitizedStepName = sanitizeStepName(stepName, style, parsed, date);
  const sanitizedLevel = sanitizeLevel(level);

  return {
    id: idValue || `video-${index + 1}`,
    step_name: sanitizedStepName,
    raw_step_name: stepName,
    style: style || 'Unspecified',
    level: sanitizedLevel,
    raw_level: level,
    date,
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl,
    tags: parseTags(normalizedMap.tags),
    notes,
    parsedDate: parsed
  };
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string[]} [requiredColumns=[]]
 * @returns {{ records: VideoRecord[]; missingColumns: string[] }}
 */
export function normalizeVideoRecords(rows, requiredColumns = []) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const observedColumns = new Set();
  safeRows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      observedColumns.add(normalizeKey(key));
    });
  });

  const normalized = sortVideoRecords(
    safeRows.map((row, index) => normalizeRow(row, index)),
    'recent'
  );

  const required =
    requiredColumns.length > 0
      ? requiredColumns.map((column) => normalizeKey(column))
      : CANONICAL_COLUMNS;

  const missingColumns = required.filter((column) => !observedColumns.has(column));

  return {
    records: normalized,
    missingColumns
  };
}
