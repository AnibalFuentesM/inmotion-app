/**
 * @file storage.js
 * Módulo de persistencia local para el catálogo de videos de In Motion.
 * Gestiona videos guardados y vistos recientemente de forma desacoplada
 * de la app de academia, utilizando una clave propia en localStorage
 * con tolerancia a fallos en memoria.
 */

const STORAGE_KEY = 'inmotion_catalog_storage_v1';
const MAX_RECENTS = 30;

/**
 * Estado en memoria en caso de que localStorage no esté disponible.
 * @type {{ savedIds: string[]; recentIds: string[] }}
 */
let memoryState = {
  savedIds: [],
  recentIds: []
};

/**
 * Comprueba si localStorage está disponible y operativo.
 * @returns {boolean}
 */
function isLocalStorageAvailable() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const testKey = '__inmotion_storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const hasStorage = isLocalStorageAvailable();

/**
 * Lee el estado persistido desde localStorage o memoria.
 * @returns {{ savedIds: string[]; recentIds: string[] }}
 */
function readStorage() {
  if (!hasStorage || typeof window === 'undefined') {
    return memoryState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return memoryState;
    }
    const parsed = JSON.parse(raw);
    return {
      savedIds: Array.isArray(parsed.savedIds) ? parsed.savedIds.map(String) : [],
      recentIds: Array.isArray(parsed.recentIds) ? parsed.recentIds.map(String) : []
    };
  } catch {
    return memoryState;
  }
}

/**
 * Escribe el estado en localStorage y memoria.
 * @param {{ savedIds: string[]; recentIds: string[] }} nextState
 */
function writeStorage(nextState) {
  memoryState = {
    savedIds: [...new Set(nextState.savedIds || [])],
    recentIds: [...new Set(nextState.recentIds || [])].slice(0, MAX_RECENTS)
  };

  if (hasStorage && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
    } catch {
      // Si falla por cuota o permisos, se preserva en memoria silenciosamente.
    }
  }

  // Notificar a listeners locales en la ventana actual
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    const detail = { ...memoryState };
    window.dispatchEvent(new CustomEvent('inmotion:catalog-storage-changed', { detail }));
    window.dispatchEvent(new CustomEvent('catalog-storage-updated', { detail }));
  }
}

/**
 * Obtiene la lista de IDs estables guardados.
 * @returns {string[]}
 */
export function getSavedVideoIds() {
  return readStorage().savedIds;
}

export const getSavedVideos = getSavedVideoIds;

/**
 * Comprueba si un video está en la lista de guardados.
 * @param {string} stableId
 * @returns {boolean}
 */
export function isVideoSaved(stableId) {
  if (!stableId) return false;
  return readStorage().savedIds.includes(String(stableId));
}

/**
 * Alterna el estado de guardado de un video.
 * @param {string} stableId
 * @returns {boolean} true si quedó guardado, false si fue quitado
 */
export function toggleSavedVideo(stableId) {
  if (!stableId) return false;
  const id = String(stableId);
  const current = readStorage();
  const exists = current.savedIds.includes(id);

  const nextSavedIds = exists
    ? current.savedIds.filter((item) => item !== id)
    : [id, ...current.savedIds];

  writeStorage({
    ...current,
    savedIds: nextSavedIds
  });

  return !exists;
}

/**
 * Obtiene la lista de IDs estables vistos recientemente, ordenados del más reciente al más antiguo.
 * @returns {string[]}
 */
export function getRecentVideoIds() {
  return readStorage().recentIds;
}

export const getRecentVideos = getRecentVideoIds;

/**
 * Registra un video como visto recientemente (al abrir su reproductor).
 * @param {string} stableId
 */
export function addRecentVideo(stableId) {
  if (!stableId) return;
  const id = String(stableId);
  const current = readStorage();

  // Colocar el ID al inicio y remover duplicados
  const nextRecentIds = [id, ...current.recentIds.filter((item) => item !== id)].slice(0, MAX_RECENTS);

  writeStorage({
    ...current,
    recentIds: nextRecentIds
  });
}
