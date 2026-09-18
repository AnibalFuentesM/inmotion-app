import { formatDisplayDate, getDriveFileId } from './video-model.js';
import { isVideoSaved, toggleSavedVideo, addRecentVideo } from './storage.js';

/**
 * @param {string} url
 * @returns {string | null}
 */
function toDrivePreviewUrl(url) {
  const fileId = getDriveFileId(url);
  if (!fileId) {
    return null;
  }

  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isDirectMediaUrl(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

/**
 * @param {string} text
 * @param {string} className
 * @returns {HTMLElement}
 */
function buildMetaRow(text, className = 'text-sm text-slate-400') {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}

/**
 * @param {string[]} tags
 * @returns {HTMLElement}
 */
function buildTagGroup(tags) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mt-4 flex flex-wrap gap-2';

  if (!Array.isArray(tags) || !tags.length) {
    wrapper.appendChild(buildMetaRow('No hay etiquetas disponibles.', 'text-sm italic text-slate-500'));
    return wrapper;
  }

  tags.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className =
      'inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary/90';
    chip.textContent = tag;
    wrapper.appendChild(chip);
  });

  return wrapper;
}

/**
 * @param {string} videoUrl
 * @returns {HTMLElement}
 */
function buildPlayer(videoUrl) {
  const playerWrap = document.createElement('div');
  playerWrap.className = 'relative mb-5 overflow-hidden rounded-xl border border-white/10 bg-black';

  if (!videoUrl) {
    const fallback = buildMetaRow('No se proporcionó URL del video para esta entrada.', 'p-4 text-sm text-slate-400');
    playerWrap.appendChild(fallback);
    return playerWrap;
  }

  const drivePreviewUrl = toDrivePreviewUrl(videoUrl);
  if (drivePreviewUrl) {
    const iframe = document.createElement('iframe');
    iframe.src = drivePreviewUrl;
    iframe.className = 'aspect-video w-full';
    iframe.allow = 'autoplay; encrypted-media; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.title = 'Vista previa del video';

    playerWrap.appendChild(iframe);

    const link = document.createElement('a');
    link.href = videoUrl;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    link.className =
      'inline-flex items-center gap-2 border-t border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-primary hover:text-white transition-colors w-full';
    link.innerHTML =
      '<span class="material-symbols-outlined text-base">open_in_new</span><span>Abrir video original en Google Drive</span>';
    playerWrap.appendChild(link);

    return playerWrap;
  }

  if (isDirectMediaUrl(videoUrl)) {
    const video = document.createElement('video');
    video.className = 'aspect-video w-full bg-black';
    video.controls = true;
    video.preload = 'metadata';
    video.src = videoUrl;
    playerWrap.appendChild(video);
    return playerWrap;
  }

  const external = document.createElement('a');
  external.href = videoUrl;
  external.target = '_blank';
  external.rel = 'noreferrer noopener';
  external.className =
    'inline-flex items-center gap-2 p-4 text-sm font-semibold text-primary hover:text-white transition-colors';
  external.innerHTML =
    '<span class="material-symbols-outlined text-base">open_in_new</span><span>Abrir enlace del video en una nueva pestaña</span>';
  playerWrap.appendChild(external);

  return playerWrap;
}

const FOCUSABLE_SELECTOR =
  'iframe, a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param {HTMLElement} modalElement
 * @param {{ onSaveToggle?: (record: import('./video-model.js').VideoRecord, isSaved: boolean) => void }} [options={}]
 */
export function createVideoModal(modalElement, { onSaveToggle } = {}) {
  const modalBody = modalElement.querySelector('#modalBody');
  const modalTitle = modalElement.querySelector('#modalTitle');
  const modalPosition = modalElement.querySelector('#modalPosition');
  const modalNavCounter = modalElement.querySelector('#modalNavCounter');
  const modalPrevBtn = modalElement.querySelector('#modalPrevBtn');
  const modalNextBtn = modalElement.querySelector('#modalNextBtn');
  const modalSaveBtn = modalElement.querySelector('#modalSaveBtn');
  const closeButton = modalElement.querySelector('[data-modal-close]');
  const backdrop = modalElement.querySelector('[data-modal-backdrop]');

  if (!modalElement.hasAttribute('tabindex')) {
    modalElement.setAttribute('tabindex', '-1');
  }

  let isOpen = false;
  let lastFocusedElement = null;
  /** @type {import('./video-model.js').VideoRecord[]} */
  let navigationList = [];
  let currentIndex = -1;
  /** @type {import('./video-model.js').VideoRecord | null} */
  let currentRecord = null;

  /**
   * Stop any active video or audio playback immediately.
   */
  function stopPlayback() {
    const iframes = modalElement.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      iframe.src = 'about:blank';
      iframe.remove();
    });

    const videos = modalElement.querySelectorAll('video');
    videos.forEach((video) => {
      try {
        video.pause();
      } catch {
        // Ignore playback pause exceptions
      }
      video.removeAttribute('src');
      video.load();
      video.remove();
    });
  }

  /**
   * @param {boolean} isSaved
   */
  function updateModalSaveButton(isSaved) {
    if (!modalSaveBtn) return;
    modalSaveBtn.setAttribute('aria-label', isSaved ? 'Quitar de guardados' : 'Guardar video');
    modalSaveBtn.setAttribute('title', isSaved ? 'Quitar de guardados' : 'Guardar video');
    modalSaveBtn.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
    modalSaveBtn.innerHTML = `<span class="material-symbols-outlined text-xl transition-colors ${
      isSaved ? 'text-primary' : 'text-slate-300'
    }" style="font-variation-settings: 'FILL' ${isSaved ? 1 : 0}">bookmark</span>`;
  }

  /**
   * @param {import('./video-model.js').VideoRecord} record
   */
  function renderRecord(record) {
    stopPlayback();
    currentRecord = record;

    // Track as opened / recently viewed
    const videoId = record.stableId || record.id;
    addRecentVideo(videoId);


    if (modalTitle) {
      modalTitle.textContent = record.step_name;
    }

    const total = navigationList.length;
    const currentNum = currentIndex + 1;
    const positionText = total > 1 ? `${currentNum} de ${total}` : '';

    if (modalPosition) {
      modalPosition.textContent = positionText;
      modalPosition.classList.toggle('hidden', total <= 1);
    }
    if (modalNavCounter) {
      modalNavCounter.textContent = positionText;
    }

    if (modalPrevBtn) {
      modalPrevBtn.disabled = currentIndex <= 0;
    }
    if (modalNextBtn) {
      modalNextBtn.disabled = currentIndex >= total - 1;
    }

    updateModalSaveButton(isVideoSaved(videoId));

    modalBody.innerHTML = '';
    modalBody.scrollTop = 0;
    modalBody.appendChild(buildPlayer(record.video_url));

    // Metadata pills
    const metaContainer = document.createElement('div');
    metaContainer.className = 'flex flex-wrap items-center gap-2 text-sm text-slate-300 mb-3';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'inline-flex items-center gap-1 text-slate-400 text-xs';
    dateSpan.innerHTML = `<span class="material-symbols-outlined text-sm">calendar_today</span> ${formatDisplayDate(
      record.parsedDate,
      record.date
    )}`;
    metaContainer.appendChild(dateSpan);

    if (record.style && record.style !== 'Unspecified') {
      const styleBadge = document.createElement('span');
      styleBadge.className = 'rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-white';
      styleBadge.textContent = record.style;
      metaContainer.appendChild(styleBadge);
    }

    if (record.level && record.level !== 'Unspecified') {
      const levelBadge = document.createElement('span');
      levelBadge.className =
        'rounded bg-primary/20 border border-primary/30 px-2 py-0.5 text-xs font-semibold text-primary';
      levelBadge.textContent = record.level;
      metaContainer.appendChild(levelBadge);
    }

    modalBody.appendChild(metaContainer);

    // Practice Notes Section (prominently labeled "Para practicar")
    const notesBox = document.createElement('div');
    notesBox.className = 'mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4';

    const notesHeader = document.createElement('div');
    notesHeader.className =
      'flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2';
    notesHeader.innerHTML =
      '<span class="material-symbols-outlined text-base">edit_note</span><span>Para practicar · Notas de la clase</span>';

    const notesContent = document.createElement('p');
    notesContent.className = 'whitespace-pre-wrap text-sm text-slate-200 leading-relaxed';
    notesContent.textContent =
      record.notes && record.notes.trim() ? record.notes : 'Sin notas adicionales para esta clase.';

    notesBox.append(notesHeader, notesContent);
    modalBody.appendChild(notesBox);

    // Tags
    modalBody.appendChild(buildTagGroup(record.tags));
  }

  /**
   * @param {number} direction
   */
  function navigate(direction) {
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < navigationList.length) {
      currentIndex = newIndex;
      renderRecord(navigationList[currentIndex]);
    }
  }

  /**
   * @returns {HTMLElement[]}
   */
  function modalFocusables() {
    return [...modalElement.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
      (node) => !node.hasAttribute('inert') && node.tabIndex >= 0 && node.getClientRects().length > 0
    );
  }

  /**
   * @param {boolean} active
   */
  function setBackgroundInert(active) {
    const backgroundElements = document.querySelectorAll('body > nav, body > header, body > main, body > footer');
    backgroundElements.forEach((node) => {
      node.inert = active;
      if (active) {
        node.setAttribute('aria-hidden', 'true');
      } else {
        node.removeAttribute('aria-hidden');
      }
    });
  }

  function restoreFocus() {
    const previous = lastFocusedElement;
    lastFocusedElement = null;

    if (previous?.isConnected && typeof previous.focus === 'function' && !previous.disabled) {
      previous.focus({ preventScroll: true });
      return;
    }

    const previousLabel = previous?.getAttribute('aria-label');
    const fallback = [...document.querySelectorAll('#cardsGrid button')].find(button =>
      previousLabel ? button.getAttribute('aria-label') === previousLabel : button.textContent === previous?.textContent
    ) || document.querySelector('#searchInput');
    fallback?.focus?.({ preventScroll: true });
  }

  /**
   * @param {FocusEvent} event
   */
  function handleFocusIn(event) {
    if (!isOpen) return;

    if (event.target && !modalElement.contains(/** @type {Node} */ (event.target))) {
      event.preventDefault();
      const targets = modalFocusables();
      const target = targets[0] || closeButton || modalElement;
      if (target instanceof HTMLElement) {
        target.focus();
      }
    }
  }

  /**
   * @param {KeyboardEvent} event
   */
  function trapModalTab(event) {
    const targets = modalFocusables();
    if (!targets.length) {
      event.preventDefault();
      modalElement.focus();
      return;
    }

    const first = targets[0];
    const last = targets[targets.length - 1];
    const active = document.activeElement;
    const outside = !modalElement.contains(active);

    if (event.shiftKey && (outside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  function close() {
    if (!isOpen) return;

    stopPlayback();
    isOpen = false;
    currentRecord = null;
    modalElement.classList.add('hidden');
    modalElement.classList.remove('flex', 'is-open');
    modalElement.setAttribute('aria-hidden', 'true');
    setBackgroundInert(false);
    document.body.classList.remove('modal-open');
    modalBody.innerHTML = '';

    restoreFocus();
  }

  /**
   * @param {import('./video-model.js').VideoRecord} record
   * @param {import('./video-model.js').VideoRecord[]} [recordsList=[]]
   */
  function open(record, recordsList = []) {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Freeze the current list for modal navigation
    navigationList = Array.isArray(recordsList) && recordsList.length > 0 ? [...recordsList] : [record];
    const targetId = record.stableId || record.id;
    const foundIndex = navigationList.findIndex((r) => (r.stableId || r.id) === targetId);
    currentIndex = foundIndex !== -1 ? foundIndex : 0;

    renderRecord(navigationList[currentIndex]);

    modalElement.classList.remove('hidden');
    modalElement.classList.add('flex', 'is-open');
    modalElement.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    isOpen = true;

    const firstInBody = modalBody.querySelector(FOCUSABLE_SELECTOR);
    const initialFocus = firstInBody || closeButton || modalElement;
    if (initialFocus instanceof HTMLElement) {
      initialFocus.focus();
    }
    setBackgroundInert(true);
  }

  // Event Listeners
  modalPrevBtn?.addEventListener('click', () => navigate(-1));
  modalNextBtn?.addEventListener('click', () => navigate(1));

  modalSaveBtn?.addEventListener('click', () => {
    if (!currentRecord) return;
    const videoId = currentRecord.stableId || currentRecord.id;
    const newSaved = toggleSavedVideo(videoId);
    updateModalSaveButton(newSaved);
    if (onSaveToggle) {
      onSaveToggle(currentRecord, newSaved);
    }
  });

  closeButton?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);

  modalElement.addEventListener('click', (event) => {
    if (event.target === modalElement) {
      close();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!isOpen) return;

    if (event.key === 'Tab') {
      trapModalTab(event);
    } else if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowLeft') {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (currentIndex > 0) {
        navigate(-1);
      }
    } else if (event.key === 'ArrowRight') {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (currentIndex < navigationList.length - 1) {
        navigate(1);
      }
    }
  });

  document.addEventListener('focusin', handleFocusIn);

  return { open, close, isOpen: () => isOpen };
}
