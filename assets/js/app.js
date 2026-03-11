import { APP_CONFIG } from './config.js';
import { createAdminPanel } from './admin-panel.js';
import { fetchSheetData } from './data-source.js';
import { buildFilterState, applyFilters, getUniqueFieldValues } from './filters.js';
import { renderVideoCards } from './ui-cards.js';
import { createVideoModal } from './ui-modal.js';
import { normalizeVideoRecords } from './video-model.js';

const elements = {
  searchInput: document.querySelector('#searchInput'),
  styleFilter: document.querySelector('#styleFilter'),
  levelFilter: document.querySelector('#levelFilter'),
  clearFiltersBtn: document.querySelector('#clearFiltersBtn'),
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
  videoModal: document.querySelector('#videoModal')
};

const state = {
  records: [],
  filtered: [],
  missingColumns: [],
  filters: buildFilterState()
};

const modal = createVideoModal(elements.videoModal);
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
 * @param {{ title: string; message: string; showClearAction: boolean }} options
 */
function showEmptyState({ title, message, showClearAction }) {
  elements.emptyTitle.textContent = title;
  elements.emptyMessage.textContent = message;
  elements.emptyClearBtn.classList.toggle('hidden', !showClearAction);
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

function updateResultsMeta() {
  const total = state.records.length;
  const showing = state.filtered.length;

  if (total === 0) {
    elements.resultsMeta.textContent = 'Aún no se han cargado videos.';
    return;
  }

  const baseText = `Mostrando ${showing} de ${total} videos`;

  if (state.missingColumns.length > 0) {
    elements.resultsMeta.textContent = `${baseText} (Columnas faltantes: ${state.missingColumns.join(', ')})`;
    return;
  }

  elements.resultsMeta.textContent = baseText;
}

function renderCatalog() {
  state.filtered = applyFilters(state.records, state.filters);

  hideError();
  hideEmptyState();

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
    showEmptyState({
      title: 'No se encontraron videos',
      message: 'Intenta con otro término de búsqueda o limpia los filtros de estilo/nivel.',
      showClearAction: true
    });
    return;
  }

  renderVideoCards({
    container: elements.cardsGrid,
    records: state.filtered,
    onCardClick: (record) => modal.open(record)
  });

  updateResultsMeta();
}

function resetFilters() {
  state.filters = buildFilterState();
  elements.searchInput.value = '';
  elements.styleFilter.value = 'all';
  elements.levelFilter.value = 'all';
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
  elements.searchInput.addEventListener(
    'input',
    debounce((event) => {
      const target = /** @type {HTMLInputElement} */ (event.target);
      state.filters.searchText = target.value;
      renderCatalog();
    }, 150)
  );

  elements.styleFilter.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    state.filters.style = target.value;
    renderCatalog();
  });

  elements.levelFilter.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    state.filters.level = target.value;
    renderCatalog();
  });

  elements.clearFiltersBtn.addEventListener('click', resetFilters);
  elements.emptyClearBtn.addEventListener('click', resetFilters);
  elements.retryBtn.addEventListener('click', loadVideos);
}

function init() {
  bindEvents();
  void adminPanel.init();
  void loadVideos();
}

init();
