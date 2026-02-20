/**
 * @typedef {Object} AppConfig
 * @property {string} gvizUrl
 * @property {number} gid
 * @property {string[]} requiredColumns
 */

/**
 * Build a GViz URL from a standard spreadsheet ID.
 * Example output:
 * https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:json&gid=0
 *
 * @param {string} sheetId
 * @param {number} [gid=0]
 * @returns {string}
 */
export function createGvizUrlFromSheetId(sheetId, gid = 0) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
}

/**
 * Build a GViz URL from a published spreadsheet ID.
 * Example output:
 * https://docs.google.com/spreadsheets/d/e/<PUBLISHED_ID>/gviz/tq?tqx=out:json&gid=0
 *
 * @param {string} publishedId
 * @param {number} [gid=0]
 * @returns {string}
 */
export function createGvizUrlFromPublishedId(publishedId, gid = 0) {
  return `https://docs.google.com/spreadsheets/d/e/${publishedId}/gviz/tq?tqx=out:json&gid=${gid}`;
}

/**
 * Replace gvizUrl with your own endpoint if needed.
 *
 * Supported patterns:
 * - https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:json&gid=<GID>
 * - https://docs.google.com/spreadsheets/d/e/<PUBLISHED_ID>/gviz/tq?tqx=out:json&gid=<GID>
 *
 * Ensure your sheet is published to web and has these columns:
 * id, step_name, style, level, date, video_url, thumbnail_url, tags, notes
 *
 * @type {AppConfig}
 */
export const APP_CONFIG = {
  gvizUrl:
    'https://docs.google.com/spreadsheets/d/1F5vMhZXHYvsc179HOdRWyml1lqeN-uxiSQv_AwZVqvg/gviz/tq?tqx=out:json&gid=0',
  gid: 0,
  requiredColumns: [
    'id',
    'step_name',
    'style',
    'level',
    'date',
    'video_url',
    'thumbnail_url',
    'tags',
    'notes'
  ]
};
