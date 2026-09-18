import { formatDisplayDate } from './video-model.js';

/**
 * @param {string} url
 * @returns {string | null}
 */
function getDriveFileId(url) {
  if (!url) {
    return null;
  }

  const text = String(url);

  const dPathMatch = text.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (dPathMatch) {
    return dPathMatch[1];
  }

  try {
    const parsed = new URL(text);
    const idParam = parsed.searchParams.get('id');
    if (idParam) {
      return idParam;
    }
  } catch {
    return null;
  }

  return null;
}

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

  if (!tags.length) {
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
    link.className = 'block border-t border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-primary hover:text-white transition-colors';
    link.textContent = 'Abrir video original en Google Drive';
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
  external.className = 'block p-4 text-sm font-semibold text-primary hover:text-white transition-colors';
  external.textContent = 'Abrir enlace del video en una nueva pestaña';
  playerWrap.appendChild(external);

  return playerWrap;
}

/**
 * @param {HTMLElement} modalElement
 */
const FOCUSABLE_SELECTOR =
  'iframe, a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param {HTMLElement} modalElement
 */
export function createVideoModal(modalElement) {
  const modalBody = modalElement.querySelector('#modalBody');
  const modalTitle = modalElement.querySelector('#modalTitle');
  const closeButton = modalElement.querySelector('[data-modal-close]');
  const backdrop = modalElement.querySelector('[data-modal-backdrop]');

  if (!modalElement.hasAttribute('tabindex')) {
    modalElement.setAttribute('tabindex', '-1');
  }

  let isOpen = false;
  let lastFocusedElement = null;

  /**
   * @returns {HTMLElement[]}
   */
  function modalFocusables() {
    return [...modalElement.querySelectorAll(FOCUSABLE_SELECTOR)]
      .filter((node) => !node.hasAttribute('inert') && node.tabIndex >= 0 && node.getClientRects().length > 0);
  }

  /**
   * @param {boolean} active
   * @returns {void}
   */
  function setBackgroundInert(active) {
    const backgroundElements = document.querySelectorAll('header, main, footer');
    backgroundElements.forEach((node) => {
      node.inert = active;
      if (active) {
        node.setAttribute('aria-hidden', 'true');
      } else {
        node.removeAttribute('aria-hidden');
      }
    });
  }

  /**
   * @returns {void}
   */
  function restoreFocus() {
    const previous = lastFocusedElement;
    lastFocusedElement = null;

    if (previous?.isConnected && typeof previous.focus === 'function' && !previous.disabled) {
      previous.focus({ preventScroll: true });
      return;
    }

    const fallback = document.querySelector('#cardsGrid button') || document.querySelector('#searchInput');
    fallback?.focus?.({ preventScroll: true });
  }

  /**
   * Redirige el foco al modal si algún evento externo (ej. salida de iframe) intenta llevarlo al documento padre.
   * @param {FocusEvent} event
   * @returns {void}
   */
  function handleFocusIn(event) {
    if (!isOpen) {
      return;
    }

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
   * @returns {void}
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

  /**
   * @returns {void}
   */
  function close() {
    if (!isOpen) {
      return;
    }

    isOpen = false;
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
   * @returns {void}
   */
  function open(record) {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    modalTitle.textContent = record.step_name;
    modalBody.innerHTML = '';

    modalBody.appendChild(buildPlayer(record.video_url));
    modalBody.appendChild(buildMetaRow(`Fecha: ${formatDisplayDate(record.parsedDate, record.date)}`));
    modalBody.appendChild(buildMetaRow(`Estilo: ${record.style}`));
    modalBody.appendChild(buildMetaRow(`Nivel: ${record.level}`));
    modalBody.appendChild(buildTagGroup(record.tags));

    const notesHeading = document.createElement('h3');
    notesHeading.className = 'mt-5 text-xs font-bold uppercase tracking-[0.15em] text-slate-500';
    notesHeading.textContent = 'Notas';

    const notesValue = document.createElement('p');
    notesValue.className = 'mt-2 whitespace-pre-wrap text-sm text-slate-300';
    notesValue.textContent = record.notes || 'No hay notas disponibles.';

    modalBody.append(notesHeading, notesValue);

    modalElement.classList.remove('hidden');
    modalElement.classList.add('flex', 'is-open');
    modalElement.setAttribute('aria-hidden', 'false');
    setBackgroundInert(true);
    document.body.classList.add('modal-open');
    isOpen = true;

    const firstInBody = modalBody.querySelector(FOCUSABLE_SELECTOR);
    const initialFocus = firstInBody || closeButton || modalElement;
    if (initialFocus instanceof HTMLElement) {
      initialFocus.focus();
    }
  }

  closeButton?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);

  modalElement.addEventListener('click', (event) => {
    if (event.target === modalElement) {
      close();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!isOpen) {
      return;
    }

    if (event.key === 'Tab') {
      trapModalTab(event);
    } else if (event.key === 'Escape') {
      close();
    }
  });

  document.addEventListener('focusin', handleFocusIn);

  return { open, close, isOpen: () => isOpen };
}
