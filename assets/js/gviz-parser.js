/**
 * Error type for GViz payload parsing failures.
 */
export class GvizParseError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'GvizParseError';
  }
}

/**
 * @param {string} rawText
 * @returns {unknown}
 */
function extractPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new GvizParseError('GViz response was empty.');
  }

  const match = rawText.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);

  if (!match || !match[1]) {
    throw new GvizParseError(
      'Unexpected GViz response format. Expected google.visualization.Query.setResponse(...).'
    );
  }

  try {
    return JSON.parse(match[1]);
  } catch {
    throw new GvizParseError('Failed to parse JSON payload from GViz response.');
  }
}

/**
 * Normalize a column name to snake_case.
 *
 * @param {string} key
 * @returns {string}
 */
function normalizeColumnKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Convert a GViz table response into plain row objects.
 *
 * @param {string} rawText
 * @returns {Array<Record<string, string | number | boolean | null>>}
 */
export function parseGvizResponseToRows(rawText) {
  const payload = extractPayload(rawText);
  const table = payload && typeof payload === 'object' ? payload.table : null;

  if (!table || !Array.isArray(table.cols) || !Array.isArray(table.rows)) {
    throw new GvizParseError('GViz payload did not include a valid table structure.');
  }

  const columnKeys = table.cols.map((col, index) => {
    if (!col || typeof col !== 'object') {
      return `column_${index + 1}`;
    }

    return normalizeColumnKey(col.label || col.id || `column_${index + 1}`);
  });

  return table.rows.map((row) => {
    const values = Array.isArray(row?.c) ? row.c : [];
    /** @type {Record<string, string | number | boolean | null>} */
    const mapped = {};

    columnKeys.forEach((key, index) => {
      const cell = values[index];
      if (!cell || (cell.v == null && cell.f == null)) {
        mapped[key] = null;
        return;
      }

      const value = cell.v != null ? cell.v : cell.f;
      mapped[key] =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? value
          : String(value);
    });

    return mapped;
  });
}
