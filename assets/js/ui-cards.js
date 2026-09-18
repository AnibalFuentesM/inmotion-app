import { formatDisplayDate, getDriveFileId } from './video-model.js';
import { isVideoSaved, toggleSavedVideo } from './storage.js';

/**
 * Build a Google Drive thumbnail URL from a file ID.
 * @param {string} url
 * @returns {string | null}
 */
function getDriveThumbnailUrl(url) {
  const id = getDriveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w640` : null;
}

const PLACEHOLDER_THUMBNAIL =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1a1a1a"/><stop offset="100%" stop-color="#111"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#475569">Sin Miniatura</text></svg>'
  );

/**
 * @param {string[]} tags
 * @returns {HTMLElement}
 */
function buildTagList(tags) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mt-2 flex flex-wrap gap-1.5';

  if (!Array.isArray(tags) || tags.length === 0) {
    return wrapper;
  }

  tags.slice(0, 4).forEach((tag) => {
    const chip = document.createElement('span');
    chip.className =
      'inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-400';
    chip.textContent = tag;
    wrapper.appendChild(chip);
  });

  if (tags.length > 4) {
    const overflow = document.createElement('span');
    overflow.className =
      'inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-500';
    overflow.textContent = `+${tags.length - 4}`;
    wrapper.appendChild(overflow);
  }

  return wrapper;
}

/**
 * @param {import('./video-model.js').VideoRecord} record
 * @param {(record: import('./video-model.js').VideoRecord) => void} onCardClick
 * @param {(record: import('./video-model.js').VideoRecord, isSaved: boolean) => void} [onSaveToggle]
 * @returns {HTMLElement}
 */
function buildCard(record, onCardClick, onSaveToggle) {
  const cardId = record.stableId || record.id;
  const isSaved = isVideoSaved(cardId);

  const card = document.createElement('article');
  card.className =
    'video-card group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111] text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover';
  card.dataset.videoId = cardId;

  // Media wrap
  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'relative aspect-video overflow-hidden bg-[#0a0a0a]';

  // Primary click trigger for thumbnail
  const thumbButton = document.createElement('button');
  thumbButton.type = 'button';
  thumbButton.className =
    'absolute inset-0 w-full h-full text-left p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary z-0';
  thumbButton.setAttribute('aria-label', `Ver video: ${record.step_name}`);
  thumbButton.addEventListener('click', () => onCardClick(record));

  const image = document.createElement('img');
  image.src = record.thumbnail_url || getDriveThumbnailUrl(record.video_url) || PLACEHOLDER_THUMBNAIL;
  image.alt = `Miniatura de ${record.step_name}`;
  image.loading = 'lazy';
  image.className =
    'h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:brightness-110';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', () => {
    image.src = PLACEHOLDER_THUMBNAIL;
  });

  const playOverlay = document.createElement('div');
  playOverlay.className =
    'absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/35';
  playOverlay.innerHTML =
    '<span class="material-symbols-outlined text-white text-5xl drop-shadow-lg" style="font-variation-settings: \'FILL\' 1">play_circle</span>';

  thumbButton.append(image, playOverlay);
  mediaWrap.appendChild(thumbButton);

  // Style badge (top-left)
  if (record.style && record.style !== 'Unspecified') {
    const badge = document.createElement('div');
    badge.className =
      'pointer-events-none absolute top-3 left-3 z-10 rounded-md bg-black/70 backdrop-blur-sm border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider';
    badge.textContent = record.style;
    mediaWrap.appendChild(badge);
  }

  // Save / Bookmark button (top-right, independent)
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className =
    'save-video-btn absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white transition-all duration-200 hover:bg-black/90 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary';
  saveBtn.setAttribute('aria-label', isSaved ? 'Quitar de guardados' : 'Guardar video');
  saveBtn.setAttribute('title', isSaved ? 'Quitar de guardados' : 'Guardar video');
  saveBtn.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
  saveBtn.innerHTML = `<span class="material-symbols-outlined text-xl transition-colors ${
    isSaved ? 'text-primary' : 'text-slate-300'
  }" style="font-variation-settings: 'FILL' ${isSaved ? 1 : 0}">bookmark</span>`;

  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const newSaved = toggleSavedVideo(cardId);
    saveBtn.setAttribute('aria-label', newSaved ? 'Quitar de guardados' : 'Guardar video');
    saveBtn.setAttribute('title', newSaved ? 'Quitar de guardados' : 'Guardar video');
    saveBtn.setAttribute('aria-pressed', newSaved ? 'true' : 'false');
    saveBtn.innerHTML = `<span class="material-symbols-outlined text-xl transition-colors ${
      newSaved ? 'text-primary' : 'text-slate-300'
    }" style="font-variation-settings: 'FILL' ${newSaved ? 1 : 0}">bookmark</span>`;
    if (onSaveToggle) {
      onSaveToggle(record, newSaved);
    }
  });

  mediaWrap.appendChild(saveBtn);

  // Content body
  const content = document.createElement('div');
  content.className = 'flex flex-col flex-1 p-4';

  const titleRow = document.createElement('div');
  titleRow.className = 'mb-2';
  const titleBtn = document.createElement('button');
  titleBtn.type = 'button';
  titleBtn.className =
    'text-left font-bold text-base text-white group-hover:text-primary transition-colors line-clamp-2 focus:outline-none focus:underline';
  titleBtn.textContent = record.step_name;
  titleBtn.addEventListener('click', () => onCardClick(record));
  titleRow.appendChild(titleBtn);

  // Metadata pills row: Style, Level, Date
  const metaRow = document.createElement('div');
  metaRow.className = 'flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mb-2';

  if (record.level && record.level !== 'Unspecified') {
    const levelBadge = document.createElement('span');
    levelBadge.className =
      'inline-flex items-center rounded bg-primary/20 border border-primary/30 px-2 py-0.5 text-[11px] font-semibold text-primary';
    levelBadge.textContent = record.level;
    metaRow.appendChild(levelBadge);
  }

  const dateSpan = document.createElement('span');
  dateSpan.className = 'inline-flex items-center text-slate-400 text-xs';
  dateSpan.textContent = formatDisplayDate(record.parsedDate, record.date);
  metaRow.appendChild(dateSpan);

  content.appendChild(titleRow);
  content.appendChild(metaRow);

  // Practice notes indicator
  if (record.notes && record.notes.trim()) {
    const notesIndicator = document.createElement('div');
    notesIndicator.className =
      'flex items-center gap-1 text-[11px] text-amber-400/90 font-medium mb-1';
    notesIndicator.innerHTML =
      '<span class="material-symbols-outlined text-[14px]">description</span><span>Notas para practicar</span>';
    content.appendChild(notesIndicator);
  }

  // Tags
  content.appendChild(buildTagList(record.tags));

  card.append(mediaWrap, content);
  return card;
}

/**
 * @param {{
 *  container: HTMLElement;
 *  records: import('./video-model.js').VideoRecord[];
 *  onCardClick: (record: import('./video-model.js').VideoRecord) => void;
 *  onSaveToggle?: (record: import('./video-model.js').VideoRecord, isSaved: boolean) => void;
 * }} params
 */
export function renderVideoCards({ container, records, onCardClick, onSaveToggle }) {
  container.innerHTML = '';

  const fragment = document.createDocumentFragment();
  records.forEach((record) => {
    fragment.appendChild(buildCard(record, onCardClick, onSaveToggle));
  });

  container.appendChild(fragment);
}
