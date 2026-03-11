/**
 * @param {HTMLElement} element
 * @param {string} message
 * @param {'info' | 'success' | 'error'} variant
 * @returns {void}
 */
function renderStatus(element, message, variant) {
  if (!message) {
    element.className = 'hidden rounded-xl border px-4 py-3 text-sm';
    element.textContent = '';
    return;
  }

  const classesByVariant = {
    info: 'rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300',
    success: 'rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300',
    error: 'rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-300'
  };

  element.className = classesByVariant[variant];
  element.textContent = message;
}

/**
 * @param {string} rawUrl
 * @returns {string}
 */
function buildEmbedUrl(rawUrl) {
  const baseUrl = String(rawUrl || '').trim();
  if (!baseUrl) {
    return '';
  }

  try {
    const parsed = new URL(baseUrl);
    parsed.searchParams.set('embedded', '1');
    return parsed.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * @param {string} url
 * @returns {string}
 */
function addCacheBuster(url) {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    parsed.searchParams.set('reload', String(Date.now()));
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * @param {{
 *   config: import('./config.js').AppConfig;
 *   onCatalogReload: () => Promise<void>;
 * }} options
 */
export function createAdminPanel({ config, onCatalogReload }) {
  const elements = {
    status: document.querySelector('#adminStatus'),
    configState: document.querySelector('#adminConfigState'),
    embedWrap: document.querySelector('#adminEmbedWrap'),
    iframe: document.querySelector('#adminEmbedFrame'),
    openLink: document.querySelector('#adminOpenLink'),
    reloadBtn: document.querySelector('#adminReloadEmbedBtn')
  };

  const state = {
    rawUrl: String(config.appsScriptWebAppUrl || '').trim(),
    embedUrl: buildEmbedUrl(config.appsScriptWebAppUrl)
  };

  /**
   * @param {'info' | 'success' | 'error'} variant
   * @param {string} message
   * @returns {void}
   */
  function setStatus(variant, message) {
    if (!(elements.status instanceof HTMLElement)) {
      return;
    }

    renderStatus(elements.status, message, variant);
  }

  /**
   * @returns {void}
   */
  function applyEmbedState() {
    const hasEmbedUrl = Boolean(state.embedUrl);

    if (elements.embedWrap instanceof HTMLElement) {
      elements.embedWrap.classList.toggle('hidden', !hasEmbedUrl);
    }

    if (elements.openLink instanceof HTMLAnchorElement) {
      elements.openLink.classList.toggle('hidden', !hasEmbedUrl);
      if (hasEmbedUrl) {
        elements.openLink.href = state.rawUrl;
      }
    }

    if (elements.reloadBtn instanceof HTMLButtonElement) {
      elements.reloadBtn.classList.toggle('hidden', !hasEmbedUrl);
    }

    if (!(elements.configState instanceof HTMLElement)) {
      return;
    }

    if (!hasEmbedUrl) {
      elements.configState.classList.remove('hidden');
      elements.configState.innerHTML =
        'Configura <code class="font-mono text-slate-200">APP_CONFIG.appsScriptWebAppUrl</code> con la URL del deployment <code class="font-mono text-slate-200">/exec</code> de Google Apps Script.';
      return;
    }

    elements.configState.classList.add('hidden');
  }

  /**
   * @param {boolean} forceReload
   * @returns {void}
   */
  function loadIframe(forceReload = false) {
    if (!(elements.iframe instanceof HTMLIFrameElement) || !state.embedUrl) {
      return;
    }

    elements.iframe.src = forceReload ? addCacheBuster(state.embedUrl) : state.embedUrl;
  }

  /**
   * @param {MessageEvent} event
   * @returns {void}
   */
  function handleMessage(event) {
    if (!(elements.iframe instanceof HTMLIFrameElement)) {
      return;
    }

    if (event.source !== elements.iframe.contentWindow) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type === 'inmotion-admin-height') {
      const nextHeight = Number(data.height);
      if (Number.isFinite(nextHeight)) {
        const boundedHeight = Math.max(720, Math.min(2200, nextHeight));
        elements.iframe.style.height = `${boundedHeight}px`;
      }
      return;
    }

    if (data.type === 'inmotion-admin-error') {
      setStatus('error', String(data.message || 'El panel de Apps Script reportó un error.'));
      return;
    }

    if (data.type === 'inmotion-admin-saved') {
      setStatus('success', String(data.message || 'Catálogo actualizado desde Apps Script.'));
      void onCatalogReload().catch((error) => {
        setStatus(
          'error',
          error instanceof Error ? error.message : 'No se pudo recargar el catálogo después del guardado.'
        );
      });
    }
  }

  return {
    /**
     * @returns {Promise<void>}
     */
    async init() {
      applyEmbedState();
      loadIframe(false);

      elements.reloadBtn?.addEventListener('click', () => {
        setStatus('info', 'Recargando el panel de Apps Script...');
        loadIframe(true);
      });

      elements.iframe?.addEventListener('load', () => {
        if (state.embedUrl) {
          setStatus('info', 'Panel de Apps Script conectado. Usa el formulario embebido para subir o editar videos.');
        }
      });

      window.addEventListener('message', handleMessage);
    },

    /**
     * The embed flow manages its own form state, so the public catalog data is not needed here.
     *
     * @param {import('./video-model.js').VideoRecord[]} _records
     * @returns {void}
     */
    syncRecords(_records) {}
  };
}
