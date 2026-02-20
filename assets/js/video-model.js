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
 * @param {VideoRecord} a
 * @param {VideoRecord} b
 * @returns {number}
 */
function compareRecords(a, b) {
  if (a.parsedDate && b.parsedDate) {
    return b.parsedDate.getTime() - a.parsedDate.getTime();
  }

  if (a.parsedDate && !b.parsedDate) {
    return -1;
  }

  if (!a.parsedDate && b.parsedDate) {
    return 1;
  }

  const dateFallback = b.date.localeCompare(a.date);
  if (dateFallback !== 0) {
    return dateFallback;
  }

  return a.id.localeCompare(b.id);
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

  return {
    id: idValue || `video-${index + 1}`,
    step_name: stepName || 'Untitled step',
    style: style || 'Unspecified',
    level: level || 'Unspecified',
    date,
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl,
    tags: parseTags(normalizedMap.tags),
    notes,
    parsedDate: parseDate(date)
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

  const normalized = safeRows.map((row, index) => normalizeRow(row, index)).sort(compareRecords);

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
