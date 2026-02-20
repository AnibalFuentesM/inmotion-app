import { GvizParseError, parseGvizResponseToRows } from './gviz-parser.js';

/**
 * @param {{ gvizUrl: string }} config
 * @returns {Promise<Array<Record<string, string | number | boolean | null>>>}
 */
export async function fetchSheetData(config) {
  if (!config?.gvizUrl) {
    throw new Error('Missing GViz URL in app configuration.');
  }

  let response;

  try {
    response = await fetch(config.gvizUrl, { cache: 'no-store' });
  } catch {
    throw new Error(
      'Network error while loading sheet data. Check your internet connection and published sheet URL.'
    );
  }

  if (!response.ok) {
    throw new Error(
      `Sheet request failed (HTTP ${response.status}). Verify the sheet is published and publicly accessible.`
    );
  }

  const rawText = await response.text();

  try {
    return parseGvizResponseToRows(rawText);
  } catch (error) {
    if (error instanceof GvizParseError) {
      throw new Error(
        `${error.message} Confirm your endpoint uses gviz/tq?tqx=out:json and points to a published sheet.`
      );
    }

    throw new Error('Unknown error while parsing sheet response.');
  }
}
