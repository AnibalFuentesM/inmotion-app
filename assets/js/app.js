import { APP_CONFIG } from './config.js';
import { createAdminPanel } from './admin-panel.js';
import { fetchSheetData } from './data-source.js';
import { buildFilterState, applyFilters, getUniqueFieldValues, getActiveFilters } from './filters.js';
import { renderVideoCards } from './ui-cards.js';
import { createVideoModal } from './ui-modal.js';
import { normalizeVideoRecords, sortVideoRecords } from './video-model.js';
import { getSavedVideos, getRecentVideos } from './storage.js';

const elements = {
  searchInput: document.querySelector('#searchInput'),
  periodFilter: document.querySelector('#periodFilter'),
  styleFilter: document.querySelector('#styleFilter'),
  levelFilter: document.querySelector('#levelFilter'),
  sortOrder: document.querySelector('#sortOrder'),
  clearFiltersBtn: document.querySelector('#clearFiltersBtn'),
  activeFiltersBar: document.querySelector('#activeFiltersBar'),
  cardsGrid: document.querySelector('#cardsGrid'),
  resultsMeta: document.querySelector('#resultsMeta'),
  loadingState: document.querySelector('#loadingState'),
  errorState: document.querySelector('#errorState'),
  errorMessage: document.querySelector('#errorMessage'),
  retryBtn: document.querySelector('#retryBtn'),
  emptyState: document.querySelector('#emptyState'),
  emptyTitle: document.querySelector('#emptyTitle'),
  emptyMessage: document.querySelector('#emptyMessage'),
  emptyClearBtn: document.querySelector('#emptyClearBtn'),
  videoModal: document.querySelector('#videoModal'),
  viewTabs: document.querySelectorAll('.view-tab'),
  badgeCountAll: document.querySelector('#badgeCountAll'),
  badgeCountSaved: document.querySelector('#badgeCountSaved'),
  badgeCountRecent: document.querySelector('#badgeCountRecent')
};

const state = {
  records: [],
  filtered: [],
  missingColumns: [],
  filters: buildFilterState(),
  sortOrder: 'recent'
};

let currentEmptyAction = null;

const modal = createVideoModal(elements.videoModal, {
  onSaveToggle: () => {
    updateBadgesAndTabState();
    if (state.filters.view === 'saved') {
      renderCatalog();
    }
  }
});

const adminPanel = createAdminPanel({
  config: APP_CONFIG,
  onCatalogReload: loadVideos
});

/**
 * @param {boolean} isLoading
 */
function setLoading(isLoading) {
  elements.loadingState.classList.toggle('hidden', !isLoading);
}

/**
 * @param {string} message
 */
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorState.classList.remove('hidden');
}

function hideError() {
  elements.errorState.classList.add('hidden');
}

/**
 * @param {{ title: string; message: string; showClearAction: boolean; actionLabel?: string; onAction?: () => void }} options
 */
function showEmptyState({ title, message, showClearAction, actionLabel = 'Limpiar filtros', onAction }) {
  elements.emptyTitle.textContent = title;
  elements.emptyMessage.textContent = message;
  elements.emptyClearBtn.classList.toggle('hidden', !showClearAction);
  elements.emptyClearBtn.textContent = actionLabel;
  currentEmptyAction = onAction || resetFilters;
  elements.emptyState.classList.remove('hidden');
}

function hideEmptyState() {
  elements.emptyState.classList.add('hidden');
}

/**
 * @param {HTMLSelectElement} select
 * @param {string[]} values
 * @param {string} allLabel
 */
function populateSelect(select, values, allLabel) {
  if (!select) return;
  const currentValue = select.value || 'all';
  select.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = allLabel;
  select.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.value = values.includes(currentValue) ? currentValue : 'all';
}

function updateBadgesAndTabState() {
  const savedIds = new Set(getSavedVideos());
  const recentIds = new Set(getRecentVideos());

  const savedCount = state.records.filter((r) => savedIds.has(r.stableId) || savedIds.has(r.id)).length;
  const recentCount = state.records.filter((r) => recentIds.has(r.stableId) || recentIds.has(r.id)).length;

  if (elements.badgeCountAll) elements.badgeCountAll.textContent = String(state.records.length);
  if (elements.badgeCountSaved) elements.badgeCountSaved.textContent = String(savedCount);
  if (elements.badgeCountRecent) elements.badgeCountRecent.textContent = String(recentCount);

  elements.viewTabs?.forEach((tab) => {
    const viewName = tab.getAttribute('data-view');
    const isActive = viewName === state.filters.view;
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) {
      tab.className =
        'view-tab inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-bold text-white transition bg-primary shadow-glow';
    } else {
      tab.className =
        'view-tab inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-300 transition hover:text-white bg-transparent';
    }
  });
}

function updateResultsMeta() {
  const total = state.records.length;
  const showing = state.filtered.length;

  if (total === 0) {
    elements.resultsMeta.textContent = 'Aún no se han cargado videos.';
    return;
  }

  let scopeLabel = 'videos';
  if (state.filters.view === 'saved') scopeLabel = 'guardados';
  if (state.filters.view === 'recent') scopeLabel = 'vistos recientemente';

  const baseText = `Mostrando ${showing} de ${total} ${scopeLabel}`;

  if (state.missingColumns.length > 0) {
    elements.resultsMeta.textContent = `${baseText} (Columnas faltantes: ${state.missingColumns.join(', ')})`;
    return;
  }

  elements.resultsMeta.textContent = baseText;
}

function renderActiveFilterChips() {
  if (!elements.activeFiltersBar) return;
  elements.activeFiltersBar.innerHTML = '';

  const activeFilters = getActiveFilters(state.filters);
  if (activeFilters.length === 0) {
    elements.activeFiltersBar.classList.add('hidden');
    return;
  }
  elements.activeFiltersBar.classList.remove('hidden');

  const fragment = document.createDocumentFragment();

  activeFilters.forEach(({ key, label }) => {
    const chip = document.createElement('span');
    chip.className =
      'inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-medium text-white';

    const text = document.createElement('span');
    text.textContent = label;
    chip.appendChild(text);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'text-slate-400 hover:text-white transition-colors focus:outline-none ml-0.5';
    removeBtn.setAttribute('aria-label', `Quitar filtro ${label}`);
    removeBtn.innerHTML = '<span class="material-symbols-outlined text-sm">close</span>';

    removeBtn.addEventListener('click', () => {
      if (key === 'searchText') {
        state.filters.searchText = '';
        elements.searchInput.value = '';
      } else if (key === 'period') {
        state.filters.period = 'all';
        if (elements.periodFilter) elements.periodFilter.value = 'all';
      } else if (key === 'style') {
        state.filters.style = 'all';
        if (elements.styleFilter) elements.styleFilter.value = 'all';
      } else if (key === 'level') {
        state.filters.level = 'all';
        if (elements.levelFilter) elements.levelFilter.value = 'all';
      }
      renderCatalog();
    });

    chip.appendChild(removeBtn);
    fragment.appendChild(chip);
  });

  elements.activeFiltersBar.appendChild(fragment);
}

function renderCatalog() {
  const savedList = getSavedVideos();
  const recentList = getRecentVideos();

  const filtered = applyFilters(state.records, state.filters, {
    savedIds: savedList,
    recentIds: recentList
  });

  if (state.filters.view === 'recent') {
    state.filtered = filtered;
  } else {
    state.filtered = sortVideoRecords(filtered, state.sortOrder);
  }

  hideError();
  hideEmptyState();
  updateBadgesAndTabState();
  renderActiveFilterChips();

  if (state.records.length === 0) {
    renderVideoCards({ container: elements.cardsGrid, records: [], onCardClick: () => { } });
    updateResultsMeta();
    showEmptyState({
      title: 'No hay videos disponibles aún',
      message: 'La hoja no devolvió filas. Agrega entradas a tu hoja y actualiza, o verifica la pestaña seleccionada (gid).',
      showClearAction: false
    });
    return;
  }

  if (state.filtered.length === 0) {
    renderVideoCards({ container: elements.cardsGrid, records: [], onCardClick: () => { } });
    updateResultsMeta();

    const activeChips = getActiveFilters(state.filters);
    if (state.filters.view === 'saved' && activeChips.length === 0) {
      showEmptyState({
        title: 'No tienes videos guardados',
        message: 'Pulsa el icono de marcador en cualquier tarjeta o en el reproductor para tener tus pasos favoritos a mano.',
        showClearAction: true,
        actionLabel: 'Ver todos los videos',
        onAction: () => setView('all')
      });
    } else if (state.filters.view === 'recent' && activeChips.length === 0) {
      showEmptyState({
        title: 'No has abierto videos recientemente',
        message: 'Los videos que reproduzcas aparecerán aquí para que retomes tu práctica cómodamente.',
        showClearAction: true,
        actionLabel: 'Ver todos los videos',
        onAction: () => setView('all')
      });
    } else {
      showEmptyState({
        title: 'No se encontraron videos',
        message: 'Intenta con otro término de búsqueda o limpia los filtros de fecha, estilo o nivel.',
        showClearAction: true,
        actionLabel: 'Limpiar filtros',
        onAction: resetFilters
      });
    }
    return;
  }

  renderVideoCards({
    container: elements.cardsGrid,
    records: state.filtered,
    onCardClick: (record) => modal.open(record, state.filtered),
    onSaveToggle: () => {
      updateBadgesAndTabState();
      if (state.filters.view === 'saved') {
        renderCatalog();
      }
    }
  });

  updateResultsMeta();
}

function setView(view) {
  state.filters.view = view;
  renderCatalog();
}

function resetFilters() {
  state.filters.searchText = '';
  state.filters.period = 'all';
  state.filters.style = 'all';
  state.filters.level = 'all';
  state.sortOrder = 'recent';

  if (elements.searchInput) elements.searchInput.value = '';
  if (elements.periodFilter) elements.periodFilter.value = 'all';
  if (elements.styleFilter) elements.styleFilter.value = 'all';
  if (elements.levelFilter) elements.levelFilter.value = 'all';
  if (elements.sortOrder) elements.sortOrder.value = 'recent';

  renderCatalog();
}

/**
 * @returns {Promise<void>}
 */
async function loadVideos() {
  setLoading(true);
  hideError();
  hideEmptyState();

  try {
    const rawRows = await fetchSheetData(APP_CONFIG);
    const { records, missingColumns } = normalizeVideoRecords(rawRows, APP_CONFIG.requiredColumns);

    state.records = records;
    state.missingColumns = missingColumns;
    adminPanel.syncRecords(records);

    populateSelect(elements.styleFilter, getUniqueFieldValues(records, 'style'), 'Todos los estilos');
    populateSelect(elements.levelFilter, getUniqueFieldValues(records, 'level'), 'Todos los niveles');

    renderCatalog();
  } catch (error) {
    state.records = [];
    state.filtered = [];
    adminPanel.syncRecords([]);
    renderVideoCards({
      container: elements.cardsGrid,
      records: [],
      onCardClick: () => { }
    });

    const message = error instanceof Error ? error.message : 'Error desconocido al cargar los videos.';
    showError(message);
    updateResultsMeta();
  } finally {
    setLoading(false);
  }
}

/**
 * @param {(...args: any[]) => void} callback
 * @param {number} waitMs
 * @returns {(...args: any[]) => void}
 */
function debounce(callback, waitMs) {
  let timeoutId;

  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), waitMs);
  };
}

function bindEvents() {
  elements.searchInput?.addEventListener(
    'input',
    debounce((event) => {
      const target = /** @type {HTMLInputElement} */ (event.target);
      state.filters.searchText = target.value;
      renderCatalog();
    }, 150)
  );

  elements.periodFilter?.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    state.filters.period = target.value;
    renderCatalog();
  });

  elements.styleFilter?.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    state.filters.style = target.value;
    renderCatalog();
  });

  elements.levelFilter?.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    state.filters.level = target.value;
    renderCatalog();
  });

  elements.sortOrder?.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    state.sortOrder = target.value;
    renderCatalog();
  });

  elements.viewTabs?.forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view') || 'all';
      setView(view);
    });
  });

  elements.clearFiltersBtn?.addEventListener('click', resetFilters);
  elements.emptyClearBtn?.addEventListener('click', () => {
    if (typeof currentEmptyAction === 'function') {
      currentEmptyAction();
    } else {
      resetFilters();
    }
  });
  elements.retryBtn?.addEventListener('click', loadVideos);

  window.addEventListener('catalog-storage-updated', () => {
    updateBadgesAndTabState();
    if (state.filters.view === 'recent' || state.filters.view === 'saved') {
      renderCatalog();
    }
  });
}

function init() {
  bindEvents();
  void adminPanel.init();
  void loadVideos();
}

init();

