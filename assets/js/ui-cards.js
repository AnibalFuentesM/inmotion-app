import { formatDisplayDate } from './video-model.js';

/**
 * Extract Google Drive file ID from a Drive URL.
 * @param {string} url
 * @returns {string | null}
 */
function getDriveFileId(url) {
  if (!url) return null;
  const match = String(url).match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return match ? match[1] : null;
}

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
  wrapper.className = 'mt-3 flex flex-wrap gap-1.5';

  if (!Array.isArray(tags) || tags.length === 0) {
    const chip = document.createElement('span');
    chip.className =
      'inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-500';
    chip.textContent = 'Sin etiquetas';
    wrapper.appendChild(chip);
    return wrapper;
  }

  tags.slice(0, 5).forEach((tag) => {
    const chip = document.createElement('span');
    chip.className =
      'inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary/90';
    chip.textContent = tag;
    wrapper.appendChild(chip);
  });

  if (tags.length > 5) {
    const overflow = document.createElement('span');
    overflow.className =
      'inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-500';
    overflow.textContent = `+${tags.length - 5}`;
    wrapper.appendChild(overflow);
  }

  return wrapper;
}

/**
 * @param {import('./video-model.js').VideoRecord} record
 * @param {(record: import('./video-model.js').VideoRecord) => void} onCardClick
 * @returns {HTMLElement}
 */
function buildCard(record, onCardClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    'group block w-full overflow-hidden rounded-2xl border border-white/10 bg-[#111] text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]';
  button.addEventListener('click', () => onCardClick(record));

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'relative aspect-video overflow-hidden bg-[#0a0a0a]';

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

  // Play overlay icon
  const playOverlay = document.createElement('div');
  playOverlay.className =
    'absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/30';
  playOverlay.innerHTML =
    '<span class="material-symbols-outlined text-white text-5xl drop-shadow-lg" style="font-variation-settings: \'FILL\' 1">play_circle</span>';

  // Style badge
  if (record.style && record.style !== 'Unspecified') {
    const badge = document.createElement('div');
    badge.className =
      'absolute top-3 left-3 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider';
    badge.textContent = record.style;
    mediaWrap.appendChild(badge);
  }

  // Level badge
  if (record.level && record.level !== 'Unspecified') {
    const levelBadge = document.createElement('div');
    levelBadge.className =
      'absolute top-3 right-3 rounded-md bg-primary/80 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider';
    levelBadge.textContent = record.level;
    mediaWrap.appendChild(levelBadge);
  }

  mediaWrap.appendChild(image);
  mediaWrap.appendChild(playOverlay);

  const content = document.createElement('div');
  content.className = 'space-y-2 p-4';

  const title = document.createElement('h3');
  title.className = 'line-clamp-2 text-base font-bold text-white group-hover:text-primary transition-colors';
  title.textContent = record.step_name;

  const meta = document.createElement('p');
  meta.className = 'text-sm text-slate-500';
  meta.textContent = `${formatDisplayDate(record.parsedDate, record.date)} · ${record.style} · ${record.level}`;

  content.append(title, meta, buildTagList(record.tags));
  button.append(mediaWrap, content);

  return button;
}

/**
 * @param {{
 *  container: HTMLElement;
 *  records: import('./video-model.js').VideoRecord[];
 *  onCardClick: (record: import('./video-model.js').VideoRecord) => void;
 * }} params
 */
export function renderVideoCards({ container, records, onCardClick }) {
  container.innerHTML = '';

  const fragment = document.createDocumentFragment();
  records.forEach((record) => {
    fragment.appendChild(buildCard(record, onCardClick));
  });

  container.appendChild(fragment);
}
