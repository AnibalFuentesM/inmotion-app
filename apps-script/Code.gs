const CONFIG = Object.freeze({
  spreadsheetId: '1F5vMhZXHYvsc179HOdRWyml1lqeN-uxiSQv_AwZVqvg',
  sheetName: '',
  driveFolderId: '1yFyJyPHNydfRsd0YOSQI7Zskw0q3a2xx',
  allowedEmails: [],
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
});

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.bootConfig = {
    embedded: String((e && e.parameter && e.parameter.embedded) || '') === '1'
  };

  return template
    .evaluate()
    .setTitle('Inmotion Staff Tools')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getBootstrap() {
  const userEmail = getAuthorizedUser_();
  const context = getSheetContext_();
  const records = context.rows
    .map(function (row, index) {
      return toRecord_(row, context.headerMap, index);
    })
    .filter(function (record) {
      return record.id || record.step_name;
    })
    .sort(compareRecords_);

  return {
    userEmail: userEmail || '',
    allowlistEnabled: CONFIG.allowedEmails.length > 0,
    records: records,
    styleOptions: uniqueValues_(records, 'style'),
    levelOptions: uniqueValues_(records, 'level')
  };
}

function createCatalogItem(formObject) {
  getAuthorizedUser_();

  if (!formObject || !formObject.videoFile || typeof formObject.videoFile.getBytes !== 'function') {
    throw new Error('Selecciona un archivo de video antes de enviarlo.');
  }

  const metadata = normalizeMetadata_(formObject);
  const uploadedFile = createDriveFile_(formObject.videoFile, metadata.step_name);
  const recordId = Utilities.getUuid();
  const context = getSheetContext_();

  context.sheet.appendRow(
    buildRowFromObject_(context.headers, {
      id: recordId,
      step_name: metadata.step_name,
      style: metadata.style,
      level: metadata.level,
      date: metadata.date,
      video_url: buildDriveFileUrl_(uploadedFile.getId()),
      thumbnail_url: '',
      tags: metadata.tags,
      notes: metadata.notes
    })
  );

  return {
    ok: true,
    message: 'Video subido y catalogo actualizado.'
  };
}

function updateCatalogItem(formObject) {
  getAuthorizedUser_();

  const recordId = String((formObject && formObject.id) || '').trim();
  if (!recordId) {
    throw new Error('Selecciona un video antes de guardar cambios.');
  }

  const metadata = normalizeMetadata_(formObject);
  const context = getSheetContext_();
  const rowNumber = findRowNumberById_(context, recordId);

  writeCellByHeader_(context, rowNumber, 'step_name', metadata.step_name);
  writeCellByHeader_(context, rowNumber, 'style', metadata.style);
  writeCellByHeader_(context, rowNumber, 'level', metadata.level);
  writeCellByHeader_(context, rowNumber, 'date', metadata.date);
  writeCellByHeader_(context, rowNumber, 'tags', metadata.tags);
  writeCellByHeader_(context, rowNumber, 'notes', metadata.notes);

  return {
    ok: true,
    message: 'Metadata actualizada.'
  };
}

function getAuthorizedUser_() {
  const rawEmail = Session.getActiveUser().getEmail();
  const email = String(rawEmail || '').trim().toLowerCase();
  const allowedEmails = (CONFIG.allowedEmails || []).map(function (value) {
    return String(value || '').trim().toLowerCase();
  }).filter(Boolean);

  if (allowedEmails.length > 0 && allowedEmails.indexOf(email) === -1) {
    throw new Error('Tu cuenta no esta autorizada para usar este panel.');
  }

  return email;
}

function createDriveFile_(blob, stepName) {
  const folder = DriveApp.getFolderById(CONFIG.driveFolderId);
  const file = folder.createFile(blob);
  const nextName = buildUploadFileName_(stepName, blob.getName());

  if (nextName) {
    file.setName(nextName);
  }

  // Permite que la vista en iframe y la miniatura externa funcionen sin permisos de Drive
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file;
}

function buildUploadFileName_(stepName, originalName) {
  const safeOriginalName = String(originalName || '').trim();
  const extensionMatch = safeOriginalName.match(/(\.[a-z0-9]+)$/i);
  const extension = extensionMatch ? extensionMatch[1] : '';
  const slug = String(stepName || safeOriginalName || 'recap-video')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug ? slug + extension : safeOriginalName;
}

function buildDriveFileUrl_(fileId) {
  return 'https://drive.google.com/file/d/' + fileId + '/view?usp=drive_link';
}

function normalizeMetadata_(rawObject) {
  const stepName = toText_(rawObject.step_name);
  const style = toText_(rawObject.style);
  const level = toText_(rawObject.level);
  const date = normalizeDate_(rawObject.date);

  if (!stepName || !style || !level || !date) {
    throw new Error('Nombre, estilo, nivel y fecha son obligatorios.');
  }

  return {
    step_name: stepName,
    style: style,
    level: level,
    date: date,
    tags: normalizeTags_(rawObject.tags),
    notes: toText_(rawObject.notes)
  };
}

function getSheetContext_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = CONFIG.sheetName
    ? spreadsheet.getSheetByName(CONFIG.sheetName)
    : spreadsheet.getSheets()[0];

  if (!sheet) {
    throw new Error('No se encontro la pestana configurada en Google Sheets.');
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) {
    throw new Error('La hoja no tiene encabezados.');
  }

  const headers = values[0];
  const headerMap = buildHeaderMap_(headers);

  return {
    sheet: sheet,
    headers: headers,
    headerMap: headerMap,
    rows: values.slice(1)
  };
}

function buildHeaderMap_(headers) {
  const headerMap = {};

  headers.forEach(function (header, index) {
    headerMap[normalizeKey_(header)] = index + 1;
  });

  const missing = CONFIG.requiredColumns.filter(function (columnName) {
    return !headerMap[normalizeKey_(columnName)];
  });

  if (missing.length > 0) {
    throw new Error('Faltan columnas requeridas en la hoja: ' + missing.join(', ') + '.');
  }

  return headerMap;
}

function buildRowFromObject_(headers, valueMap) {
  return headers.map(function (header) {
    const key = normalizeKey_(header);
    return Object.prototype.hasOwnProperty.call(valueMap, key) ? valueMap[key] : '';
  });
}

function findRowNumberById_(context, recordId) {
  const idColumnNumber = context.headerMap.id;

  for (var index = 0; index < context.rows.length; index += 1) {
    var row = context.rows[index];
    var currentId = String(row[idColumnNumber - 1] || '').trim();
    if (currentId === recordId) {
      return index + 2;
    }
  }

  throw new Error('No se encontro el video seleccionado en la hoja.');
}

function writeCellByHeader_(context, rowNumber, headerKey, value) {
  const columnNumber = context.headerMap[normalizeKey_(headerKey)];
  if (!columnNumber) {
    throw new Error('La hoja no tiene la columna ' + headerKey + '.');
  }

  context.sheet.getRange(rowNumber, columnNumber).setValue(value);
}

function toRecord_(row, headerMap, index) {
  var idColumn = headerMap.id;
  var stepNameColumn = headerMap.step_name;
  var styleColumn = headerMap.style;
  var levelColumn = headerMap.level;
  var dateColumn = headerMap.date;
  var videoUrlColumn = headerMap.video_url;
  var thumbnailUrlColumn = headerMap.thumbnail_url;
  var tagsColumn = headerMap.tags;
  var notesColumn = headerMap.notes;

  return {
    id: toCellText_(row, idColumn) || 'video-' + (index + 1),
    step_name: toCellText_(row, stepNameColumn),
    style: toCellText_(row, styleColumn),
    level: toCellText_(row, levelColumn),
    date: toCellText_(row, dateColumn),
    video_url: toCellText_(row, videoUrlColumn),
    thumbnail_url: toCellText_(row, thumbnailUrlColumn),
    tags: splitTags_(toCellText_(row, tagsColumn)),
    notes: toCellText_(row, notesColumn)
  };
}

function compareRecords_(left, right) {
  const leftTime = parseDateValue_(left.date);
  const rightTime = parseDateValue_(right.date);

  if (leftTime !== null && rightTime !== null) {
    return rightTime - leftTime;
  }

  if (leftTime !== null) {
    return -1;
  }

  if (rightTime !== null) {
    return 1;
  }

  return String(right.id).localeCompare(String(left.id));
}

function parseDateValue_(value) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function uniqueValues_(records, fieldName) {
  const map = {};

  records.forEach(function (record) {
    const value = String(record[fieldName] || '').trim();
    if (value) {
      map[value] = true;
    }
  });

  return Object.keys(map).sort();
}

function toText_(value) {
  return String(value || '').trim();
}

function normalizeDate_(value) {
  const text = toText_(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return '';
  }

  return text;
}

function normalizeTags_(value) {
  return String(value || '')
    .split(',')
    .map(function (tag) {
      return String(tag || '').trim();
    })
    .filter(Boolean)
    .join(', ');
}

function splitTags_(value) {
  return String(value || '')
    .split(',')
    .map(function (tag) {
      return String(tag || '').trim();
    })
    .filter(Boolean);
}

function normalizeKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toCellText_(row, columnNumber) {
  if (!columnNumber) {
    return '';
  }

  return String((row && row[columnNumber - 1]) || '').trim();
}
