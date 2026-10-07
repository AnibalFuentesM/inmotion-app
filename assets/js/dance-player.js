/**
 * ==============================================================================
 * IN MOTION DANCE ACADEMY - MOTOR DEL REPRODUCTOR DE BAILE (DANCE LEARNING PLAYER)
 * Reproductor de video especializado para aprender y entrenar pasos de danza.
 * - Modo Espejo (Flip horizontal por GPU)
 * - Bucle A-B (Repetición continua de compases / cuentas de baile)
 * - Control de velocidad (0.75x para desglose técnico, 1.25x para reto de tempo)
 * - Marcadores visuales interactivos y micro-ajustes
 * ==============================================================================
 */

/**
 * Formatea segundos a mm:ss o mm:ss.d
 * @param {number} seconds
 * @param {boolean} includeDecimals
 * @returns {string}
 */
export function formatTime(seconds, includeDecimals = false) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n) => String(n).padStart(2, '0');

  if (includeDecimals) {
    const dec = Math.floor((seconds % 1) * 10);
    return `${pad(mins)}:${pad(secs)}.${dec}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Escapa caracteres HTML para inyección segura en plantillas
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @typedef {Object} DancePlayerOptions
 * @property {string} videoUrl
 * @property {string} [title]
 * @property {string[]} [tags]
 * @property {string} [style]
 * @property {string} [level]
 * @property {boolean} [initialMirror]
 * @property {number} [initialSpeed]
 * @property {number|null} [initialLoopA]
 * @property {number|null} [initialLoopB]
 * @property {boolean} [initialLoopActive]
 * @property {(isMirrored: boolean) => void} [onMirrorChange]
 * @property {(speed: number) => void} [onSpeedChange]
 * @property {(a: number|null, b: number|null, active: boolean) => void} [onLoopChange]
 * @property {(isVertical: boolean, dims?: { width: number, height: number }) => void} [onOrientationDetected]
 */

/**
 * Crea e inicializa el reproductor de baile dentro de un contenedor DOM
 * @param {HTMLElement} container
 * @param {DancePlayerOptions} options
 */
export function createDancePlayer(container, options = {}) {
  let isMirrored = Boolean(options.initialMirror);
  let playbackSpeed = options.initialSpeed || 1.0;
  let pointA = options.initialLoopA !== undefined ? options.initialLoopA : null;
  let pointB = options.initialLoopB !== undefined ? options.initialLoopB : null;
  let isLoopActive = Boolean(options.initialLoopActive || (pointA !== null && pointB !== null));
  let isScrubbing = false;
  let tags = Array.isArray(options.tags) ? [...options.tags] : [];

  // Construir HTML del reproductor optimizado para celular y pantalla completa
  container.innerHTML = `
    <div class="dance-player" tabindex="0" role="region" aria-label="Reproductor de video para aprendizaje de baile">
      <!-- Escenario de Video -->
      <div class="dance-video-stage" data-element="stage">
        <video class="dance-video ${isMirrored ? 'is-mirrored' : ''}" 
               playsinline 
               preload="metadata"
               crossorigin="anonymous">
          <source src="${options.videoUrl || ''}" type="video/mp4">
          Tu navegador no soporta reproducción de video HTML5.
        </video>

        <!-- Top HUD Flotante: Título, Badges y Botón Salir -->
        <div class="dance-overlay-top" data-element="overlayTop">
          <div class="dance-fs-title-wrap">
            <span class="dance-fs-title">${escapeHtml(options.title || 'In Motion')}</span>
            ${(options.style || options.level) ? `<span class="dance-fs-subtitle">${escapeHtml([options.style, options.level].filter(Boolean).join(' • '))}</span>` : ''}
          </div>

          <div class="dance-overlay-badges">
            <span class="dance-status-badge dance-status-badge--mirror" data-element="mirrorBadge" style="${isMirrored ? '' : 'display: none;'}">
              <span class="material-symbols-outlined" style="font-size: 14px;">flip</span>
              <span>Espejo</span>
            </span>

            <span class="dance-status-badge dance-status-badge--speed" data-element="speedBadge" style="${playbackSpeed !== 1.0 ? '' : 'display: none;'}">
              <span class="material-symbols-outlined" style="font-size: 14px;">speed</span>
              <span data-element="speedBadgeText">${playbackSpeed}x</span>
            </span>

            <span class="dance-status-badge dance-status-badge--loop" data-element="loopBadge" style="${isLoopActive ? '' : 'display: none;'}">
              <span class="material-symbols-outlined" style="font-size: 14px;">repeat</span>
              <span data-element="loopBadgeText">Bucle A-B</span>
            </span>

            <!-- Botón salir directo para móvil en pantalla completa -->
            <button type="button" class="dance-fs-close-btn" data-element="fsExitTopBtn" title="Salir de pantalla completa">
              <span class="material-symbols-outlined" style="font-size: 18px;">fullscreen_exit</span>
              <span>Salir</span>
            </button>
          </div>
        </div>

        <!-- Indicador central flotante de Play/Pausa animado -->
        <div class="dance-center-icon" data-element="centerIcon">
          <span class="material-symbols-outlined" data-element="centerIconSymbol" style="font-size: 40px;">play_arrow</span>
        </div>
      </div>

      <!-- Bottom HUD Flotante (Línea de tiempo + Controles esenciales) -->
      <div class="dance-bottom-hud" data-element="bottomHud">
        <!-- Barra de tiempo y marcadores A-B -->
        <div class="dance-timeline-wrap">
          <div class="dance-timeline-bar" data-element="timelineBar" role="slider" aria-label="Línea de tiempo" tabindex="0">
            <div class="dance-progress-fill" data-element="progressFill"></div>
            <div class="dance-loop-region" data-element="loopRegion"></div>
            <div class="dance-marker dance-marker-a" data-element="markerA" title="Punto A">A</div>
            <div class="dance-marker dance-marker-b" data-element="markerB" title="Punto B">B</div>
          </div>

          <div class="dance-time-row">
            <span data-element="currentTimeText">00:00</span>
            <span data-element="durationText">00:00</span>
          </div>
        </div>

        <!-- Panel de Controles -->
        <div class="dance-controls-panel">
          <!-- Fila 1: Transporte principal, Espejo, Velocidades y Pantalla completa -->
          <div class="dance-controls-row">
            <div class="dance-controls-group">
              <!-- Play / Pausa -->
              <button type="button" class="dance-btn dance-btn--primary dance-btn--icon" data-element="playBtn" title="Reproducir / Pausar (Espacio)">
                <span class="material-symbols-outlined" data-element="playBtnIcon" style="font-size: 22px;">play_arrow</span>
              </button>

              <!-- Salto -3s (repasar la cuenta del paso) -->
              <button type="button" class="dance-btn" data-element="skipBackBtn" title="Retroceder 3 segundos (Repetir cuenta)">
                <span class="material-symbols-outlined" style="font-size: 16px;">replay_10</span>
                <span>-3s</span>
              </button>

              <!-- Salto +3s -->
              <button type="button" class="dance-btn" data-element="skipForwardBtn" title="Avanzar 3 segundos">
                <span>+3s</span>
                <span class="material-symbols-outlined" style="font-size: 16px;">forward_10</span>
              </button>
            </div>

            <!-- Selector de Velocidades y Botones Clave -->
            <div class="dance-controls-group">
              <span class="dance-speed-label" style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-right: 2px;">VEL:</span>
              <div class="dance-speed-group" role="group" aria-label="Velocidad de reproducción">
                <button type="button" class="dance-speed-btn ${playbackSpeed === 0.5 ? 'is-active' : ''}" data-speed="0.5" title="0.5x (Cámara lenta)">0.5x</button>
                <button type="button" class="dance-speed-btn ${playbackSpeed === 0.75 ? 'is-active' : ''}" data-speed="0.75" title="0.75x (Desglose técnico y conteo)">0.75x</button>
                <button type="button" class="dance-speed-btn ${playbackSpeed === 1.0 ? 'is-active' : ''}" data-speed="1.0" title="1.0x (Tempo normal)">1.0x</button>
                <button type="button" class="dance-speed-btn ${playbackSpeed === 1.25 ? 'is-active' : ''}" data-speed="1.25" title="1.25x (Reto de velocidad y agilidad)">1.25x</button>
              </div>

              <!-- Botón MODO ESPEJO -->
              <button type="button" class="dance-btn dance-btn--mirror ${isMirrored ? 'is-active' : ''}" data-element="mirrorBtn" title="Modo Espejo (Atajo: M)">
                <span class="material-symbols-outlined" style="font-size: 18px;">flip</span>
                <span>Espejo</span>
              </button>

              <!-- Botón Pantalla Completa -->
              <button type="button" class="dance-btn dance-btn--icon" data-element="fullscreenBtn" title="Pantalla completa">
                <span class="material-symbols-outlined" data-element="fullscreenIcon" style="font-size: 18px;">fullscreen</span>
              </button>
            </div>
          </div>

          <!-- Fila 2: Panel de Bucle A-B (Loop de entrenamiento) -->
          <div class="dance-loop-panel">
            <div class="dance-loop-info">
              <div class="dance-loop-title">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #22c55e;">all_inclusive</span>
                <span>Bucle de práctica (Loop A-B)</span>
              </div>
              <div class="dance-loop-times" data-element="loopTimesDisplay">
                ${pointA !== null || pointB !== null ? `A: ${formatTime(pointA || 0, true)} ➔ B: ${formatTime(pointB || 0, true)}` : 'Sin puntos fijados'}
              </div>
            </div>

            <div class="dance-controls-group dance-loop-actions">
              <!-- Botón Marcar A -->
              <button type="button" class="dance-btn" data-element="markABtn" title="Fijar Punto A en el segundo actual (Atajo: A)">
                <span class="material-symbols-outlined" style="font-size: 16px; color: #22c55e;">flag</span>
                <span>Marcar [A]</span>
              </button>

              <!-- Botón Marcar B -->
              <button type="button" class="dance-btn" data-element="markBBtn" title="Fijar Punto B en el segundo actual (Atajo: B)">
                <span class="material-symbols-outlined" style="font-size: 16px; color: #3b82f6;">flag</span>
                <span>Marcar [B]</span>
              </button>

              <!-- Alternar Bucle Activo -->
              <button type="button" class="dance-btn dance-btn--loop ${isLoopActive ? 'is-active' : ''}" data-element="toggleLoopBtn" title="Activar/Desactivar repetición (Atajo: L)">
                <span class="material-symbols-outlined" style="font-size: 16px;">repeat</span>
                <span data-element="toggleLoopBtnText">${isLoopActive ? 'Bucle ON' : 'Bucle OFF'}</span>
              </button>

              <!-- Limpiar Puntos -->
              <button type="button" class="dance-btn" data-element="clearLoopBtn" title="Borrar puntos A y B">
                <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
                <span>Limpiar</span>
              </button>
            </div>
          </div>

          <!-- Fila 3: Etiquetas del Paso (Ocultas en pantalla completa) -->
          <div class="dance-tags-row" data-element="tagsRow">
            ${renderTagsHtml(tags)}
          </div>

          <!-- Fila 4: Consejos de atajos (Ocultos en pantalla completa y móvil) -->
          <div class="dance-shortcuts-hint">
            <span><kbd>Espacio</kbd> Play/Pausa</span>
            <span><kbd>M</kbd> Modo Espejo</span>
            <span><kbd>A</kbd> Fijar A</span>
            <span><kbd>B</kbd> Fijar B</span>
            <span><kbd>L</kbd> Bucle</span>
            <span><kbd>←</kbd> <kbd>→</kbd> ±3 seg</span>
            <span><kbd>1</kbd> 0.75x</span>
            <span><kbd>2</kbd> 1.0x</span>
            <span><kbd>3</kbd> 1.25x</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Referencias a elementos
  const playerRoot = container.querySelector('.dance-player');
  const stage = container.querySelector('[data-element="stage"]');
  const video = container.querySelector('video');
  const mirrorBadge = container.querySelector('[data-element="mirrorBadge"]');
  const speedBadge = container.querySelector('[data-element="speedBadge"]');
  const speedBadgeText = container.querySelector('[data-element="speedBadgeText"]');
  const loopBadge = container.querySelector('[data-element="loopBadge"]');
  const loopBadgeText = container.querySelector('[data-element="loopBadgeText"]');
  const fsExitTopBtn = container.querySelector('[data-element="fsExitTopBtn"]');
  const centerIcon = container.querySelector('[data-element="centerIcon"]');
  const centerIconSymbol = container.querySelector('[data-element="centerIconSymbol"]');
  const timelineBar = container.querySelector('[data-element="timelineBar"]');
  const progressFill = container.querySelector('[data-element="progressFill"]');
  const loopRegion = container.querySelector('[data-element="loopRegion"]');
  const markerA = container.querySelector('[data-element="markerA"]');
  const markerB = container.querySelector('[data-element="markerB"]');
  const currentTimeText = container.querySelector('[data-element="currentTimeText"]');
  const durationText = container.querySelector('[data-element="durationText"]');
  const playBtn = container.querySelector('[data-element="playBtn"]');
  const playBtnIcon = container.querySelector('[data-element="playBtnIcon"]');
  const skipBackBtn = container.querySelector('[data-element="skipBackBtn"]');
  const skipForwardBtn = container.querySelector('[data-element="skipForwardBtn"]');
  const mirrorBtn = container.querySelector('[data-element="mirrorBtn"]');
  const fullscreenBtn = container.querySelector('[data-element="fullscreenBtn"]');
  const fullscreenIcon = container.querySelector('[data-element="fullscreenIcon"]');
  const markABtn = container.querySelector('[data-element="markABtn"]');
  const markBBtn = container.querySelector('[data-element="markBBtn"]');
  const toggleLoopBtn = container.querySelector('[data-element="toggleLoopBtn"]');
  const toggleLoopBtnText = container.querySelector('[data-element="toggleLoopBtnText"]');
  const clearLoopBtn = container.querySelector('[data-element="clearLoopBtn"]');
  const loopTimesDisplay = container.querySelector('[data-element="loopTimesDisplay"]');
  const tagsRow = container.querySelector('[data-element="tagsRow"]');
  const speedButtons = container.querySelectorAll('.dance-speed-btn');

  // Inicializar audio y velocidad
  try {
    video.preservesPitch = true;
    video.playbackRate = playbackSpeed;
  } catch {
    // Si preservesPitch no está soportado en browsers antiguos
  }

  function renderTagsHtml(tagsList) {
    if (!tagsList || !tagsList.length) {
      return '<span style="font-size: 11px; color: #64748b; font-style: italic;">Sin etiquetas asignadas.</span>';
    }
    return tagsList
      .map(
        (t) =>
          `<span class="dance-tag-chip"><span class="material-symbols-outlined" style="font-size: 12px;">sell</span>${escapeHtml(
            t
          )}</span>`
      )
      .join('');
  }

  function flashCenterIcon(iconName) {
    if (!centerIcon || !centerIconSymbol) return;
    centerIconSymbol.textContent = iconName;
    centerIcon.classList.remove('animate-pop');
    void centerIcon.offsetWidth; // Forzar reflujo
    centerIcon.classList.add('animate-pop');
    setTimeout(() => {
      centerIcon.classList.remove('animate-pop');
    }, 400);
  }

  // Actualizar marcadores de la línea de tiempo
  function updateTimelineMarkers() {
    const dur = video.duration;
    if (!dur || isNaN(dur) || dur <= 0) {
      markerA.classList.remove('is-visible');
      markerB.classList.remove('is-visible');
      loopRegion.classList.remove('is-active');
      return;
    }

    if (pointA !== null) {
      const pctA = Math.max(0, Math.min(100, (pointA / dur) * 100));
      markerA.style.left = `${pctA}%`;
      markerA.classList.add('is-visible');
    } else {
      markerA.classList.remove('is-visible');
    }

    if (pointB !== null) {
      const pctB = Math.max(0, Math.min(100, (pointB / dur) * 100));
      markerB.style.left = `${pctB}%`;
      markerB.classList.add('is-visible');
    } else {
      markerB.classList.remove('is-visible');
    }

    if (pointA !== null && pointB !== null && pointB > pointA) {
      const pctA = Math.max(0, Math.min(100, (pointA / dur) * 100));
      const pctB = Math.max(0, Math.min(100, (pointB / dur) * 100));
      loopRegion.style.left = `${pctA}%`;
      loopRegion.style.width = `${pctB - pctA}%`;
      loopRegion.classList.add('is-active');
    } else {
      loopRegion.classList.remove('is-active');
    }

    // Actualizar visualizador de texto
    if (pointA !== null || pointB !== null) {
      const textA = pointA !== null ? formatTime(pointA, true) : '--:--';
      const textB = pointB !== null ? formatTime(pointB, true) : '--:--';
      const delta = (pointA !== null && pointB !== null && pointB > pointA)
        ? ` (${(pointB - pointA).toFixed(1)}s)`
        : '';
      loopTimesDisplay.textContent = `A: ${textA} ➔ B: ${textB}${delta}`;
    } else {
      loopTimesDisplay.textContent = 'Sin puntos fijados';
    }
  }

  // Gestión del bucle en tiempo real
  function checkLoopBounds() {
    if (!isLoopActive || pointA === null || pointB === null) return;
    if (pointB <= pointA) return;

    if (video.currentTime >= pointB || video.currentTime < pointA) {
      video.currentTime = pointA;
      if (video.paused) {
        video.play().catch(() => {});
      }
    }
  }

  // --- ACCIONES PRINCIPALES ---

  function togglePlay() {
    if (video.paused) {
      video.play().catch((err) => console.warn('[DancePlayer] Error al reproducir:', err));
    } else {
      video.pause();
    }
  }

  function toggleMirror(force) {
    isMirrored = typeof force === 'boolean' ? force : !isMirrored;
    video.classList.toggle('is-mirrored', isMirrored);
    mirrorBtn.classList.toggle('is-active', isMirrored);
    mirrorBadge.style.display = isMirrored ? 'inline-flex' : 'none';
    if (typeof options.onMirrorChange === 'function') {
      options.onMirrorChange(isMirrored);
    }
  }

  function setSpeed(speed) {
    playbackSpeed = Number(speed) || 1.0;
    try {
      video.playbackRate = playbackSpeed;
    } catch {}

    speedButtons.forEach((btn) => {
      const val = parseFloat(btn.dataset.speed);
      btn.classList.toggle('is-active', val === playbackSpeed);
    });

    if (playbackSpeed !== 1.0) {
      speedBadge.style.display = 'inline-flex';
      speedBadgeText.textContent = `${playbackSpeed}x`;
    } else {
      speedBadge.style.display = 'none';
    }

    if (typeof options.onSpeedChange === 'function') {
      options.onSpeedChange(playbackSpeed);
    }
  }

  function markPointA(time) {
    const target = typeof time === 'number' ? time : video.currentTime;
    pointA = Math.max(0, target);
    if (pointB !== null && pointB <= pointA) {
      pointB = null; // Reiniciar B si queda antes de A
    }
    isLoopActive = pointB !== null;
    updateLoopState();
  }

  function markPointB(time) {
    const target = typeof time === 'number' ? time : video.currentTime;
    if (pointA !== null && target <= pointA) {
      // Si se marca B antes de A, fijamos A en 0
      pointA = 0;
    }
    pointB = Math.max(pointA !== null ? pointA + 0.2 : 0, target);
    isLoopActive = true;
    updateLoopState();
  }

  function toggleLoop(force) {
    if (pointA === null || pointB === null) {
      // Si no hay puntos, sugerimos fijar A en el momento actual
      if (pointA === null) markPointA();
      return;
    }
    isLoopActive = typeof force === 'boolean' ? force : !isLoopActive;
    updateLoopState();
  }

  function clearLoop() {
    pointA = null;
    pointB = null;
    isLoopActive = false;
    updateLoopState();
  }

  function updateLoopState() {
    toggleLoopBtn.classList.toggle('is-active', isLoopActive);
    toggleLoopBtnText.textContent = isLoopActive ? 'Bucle ON' : 'Bucle OFF';
    loopBadge.style.display = isLoopActive ? 'inline-flex' : 'none';
    if (pointA !== null && pointB !== null) {
      loopBadgeText.textContent = `Bucle [${formatTime(pointA)} ➔ ${formatTime(pointB)}]`;
    } else {
      loopBadgeText.textContent = 'Bucle A-B';
    }
    updateTimelineMarkers();

    if (typeof options.onLoopChange === 'function') {
      options.onLoopChange(pointA, pointB, isLoopActive);
    }
  }

  function nudge(point, delta) {
    if (point === 'a' && pointA !== null) {
      pointA = Math.max(0, pointA + delta);
      if (pointB !== null && pointA >= pointB) pointA = Math.max(0, pointB - 0.2);
    } else if (point === 'b' && pointB !== null) {
      pointB = Math.max((pointA || 0) + 0.2, pointB + delta);
    }
    updateLoopState();
  }

  function skip(seconds) {
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
  }

  // --- GESTIÓN DE PANTALLA COMPLETA TOTAL (DESKTOP & CELULAR) ---
  let isFsActive = false;
  let nativeFsTriggered = false;
  let hudTimer = null;

  function isFullscreenActive() {
    return (
      Boolean(document.fullscreenElement || document.webkitFullscreenElement) ||
      playerRoot.classList.contains('is-fullscreen')
    );
  }

  function clearHudHideTimer() {
    if (hudTimer) {
      clearTimeout(hudTimer);
      hudTimer = null;
    }
  }

  function scheduleHudHide() {
    clearHudHideTimer();
    if (!isFullscreenActive() || video.paused) {
      playerRoot.classList.remove('is-hud-hidden');
      return;
    }
    hudTimer = setTimeout(() => {
      if (isFullscreenActive() && !video.paused) {
        playerRoot.classList.add('is-hud-hidden');
      }
    }, 2800);
  }

  function wakeHud() {
    playerRoot.classList.remove('is-hud-hidden');
    if (isFullscreenActive() && !video.paused) {
      scheduleHudHide();
    }
  }

  function updateFullscreenButtons(inFs) {
    fullscreenBtn.setAttribute('title', inFs ? 'Salir de pantalla completa' : 'Pantalla completa');
    if (fullscreenIcon) {
      fullscreenIcon.textContent = inFs ? 'fullscreen_exit' : 'fullscreen';
    }
  }

  function enterFullscreenMode() {
    isFsActive = true;
    playerRoot.classList.add('is-fullscreen');
    document.body.classList.add('dance-fs-locked');

    // Expandir contenedor modal padre para ocupar 100% de la pantalla sin cortes
    const modal = playerRoot.closest('#videoModal');
    if (modal) {
      modal.classList.add('has-fullscreen-player');
    }

    updateFullscreenButtons(true);

    // Intentar API nativa de Fullscreen si el navegador la soporta
    const requestFs =
      playerRoot.requestFullscreen ||
      playerRoot.webkitRequestFullscreen ||
      playerRoot.mozRequestFullScreen ||
      playerRoot.msRequestFullscreen;

    if (requestFs && !document.fullscreenElement && !document.webkitFullscreenElement) {
      nativeFsTriggered = true;
      try {
        const res = requestFs.call(playerRoot);
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            nativeFsTriggered = false;
          });
        }
      } catch {
        nativeFsTriggered = false;
      }
    }

    wakeHud();
  }

  function exitFullscreenMode() {
    isFsActive = false;
    nativeFsTriggered = false;
    playerRoot.classList.remove('is-fullscreen');
    playerRoot.classList.remove('is-hud-hidden');
    document.body.classList.remove('dance-fs-locked');

    const modal = playerRoot.closest('#videoModal');
    if (modal) {
      modal.classList.remove('has-fullscreen-player');
    }

    updateFullscreenButtons(false);
    clearHudHideTimer();

    // Salir de pantalla completa nativa si está activa
    const exitFs =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen;

    if (exitFs && (document.fullscreenElement || document.webkitFullscreenElement)) {
      try {
        const res = exitFs.call(document);
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch {}
    }
  }

  function toggleFullscreen() {
    if (isFullscreenActive()) {
      exitFullscreenMode();
    } else {
      enterFullscreenMode();
    }
  }

  function handleFsChange() {
    const isNativeFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isNativeFs && playerRoot.classList.contains('is-fullscreen') && nativeFsTriggered) {
      exitFullscreenMode();
    }
  }

  document.addEventListener('fullscreenchange', handleFsChange);
  document.addEventListener('webkitfullscreenchange', handleFsChange);

  // Escuchar toques e interacciones para mostrar HUD
  playerRoot.addEventListener('pointermove', wakeHud);
  playerRoot.addEventListener('pointerdown', wakeHud);
  playerRoot.addEventListener('touchstart', wakeHud, { passive: true });

  // --- EVENT LISTENERS DEL VIDEO ---

  video.addEventListener('play', () => {
    playBtnIcon.textContent = 'pause';
    flashCenterIcon('play_arrow');
    if (isFullscreenActive()) {
      scheduleHudHide();
    }
  });

  video.addEventListener('pause', () => {
    playBtnIcon.textContent = 'play_arrow';
    flashCenterIcon('pause');
    clearHudHideTimer();
    playerRoot.classList.remove('is-hud-hidden');
  });

  function checkOrientation() {
    if (video.videoWidth && video.videoHeight) {
      const isVertical = video.videoHeight > video.videoWidth;
      stage.classList.toggle('is-vertical', isVertical);
      playerRoot.classList.toggle('is-vertical', isVertical);

      if (typeof options.onOrientationDetected === 'function') {
        options.onOrientationDetected(isVertical, {
          width: video.videoWidth,
          height: video.videoHeight
        });
      }
    }
  }

  video.addEventListener('loadedmetadata', () => {
    durationText.textContent = formatTime(video.duration);
    updateTimelineMarkers();
    checkOrientation();
  });

  video.addEventListener('canplay', checkOrientation);

  video.addEventListener('timeupdate', () => {
    if (!isScrubbing) {
      currentTimeText.textContent = formatTime(video.currentTime);
      const dur = video.duration;
      if (dur && !isNaN(dur) && dur > 0) {
        const pct = (video.currentTime / dur) * 100;
        progressFill.style.width = `${pct}%`;
      }
    }
    checkLoopBounds();
  });

  // Clic en el video reproduce/pausa o despierta controles en móvil
  stage.addEventListener('click', (e) => {
    if (e.target.closest('.dance-status-badge') || e.target.closest('.dance-fs-close-btn')) return;

    if (isFullscreenActive() && playerRoot.classList.contains('is-hud-hidden')) {
      wakeHud();
      return;
    }

    togglePlay();
    if (isFullscreenActive()) {
      wakeHud();
    }
  });

  // Barra de progreso y scrubber
  function seekTo(event) {
    const rect = timelineBar.getBoundingClientRect();
    const clientX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = clickX / rect.width;
    if (video.duration) {
      video.currentTime = pct * video.duration;
      progressFill.style.width = `${pct * 100}%`;
      currentTimeText.textContent = formatTime(video.currentTime);
    }
  }

  timelineBar.addEventListener('pointerdown', (e) => {
    isScrubbing = true;
    seekTo(e);
    timelineBar.setPointerCapture(e.pointerId);
  });

  timelineBar.addEventListener('pointermove', (e) => {
    if (isScrubbing) {
      seekTo(e);
    }
  });

  timelineBar.addEventListener('pointerup', (e) => {
    if (isScrubbing) {
      isScrubbing = false;
      timelineBar.releasePointerCapture(e.pointerId);
    }
  });

  // Botones de control
  playBtn.addEventListener('click', togglePlay);
  skipBackBtn.addEventListener('click', () => skip(-3));
  skipForwardBtn.addEventListener('click', () => skip(3));
  mirrorBtn.addEventListener('click', () => toggleMirror());
  fullscreenBtn.addEventListener('click', toggleFullscreen);

  if (fsExitTopBtn) {
    fsExitTopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exitFullscreenMode();
    });
  }

  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setSpeed(parseFloat(btn.dataset.speed));
    });
  });

  markABtn.addEventListener('click', () => markPointA());
  markBBtn.addEventListener('click', () => markPointB());
  toggleLoopBtn.addEventListener('click', () => toggleLoop());
  clearLoopBtn.addEventListener('click', clearLoop);

  // Atajos de teclado (cuando no se está escribiendo en un input)
  function handleKeyDown(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    if (e.code === 'Escape' && isFullscreenActive()) {
      e.preventDefault();
      exitFullscreenMode();
    } else if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      toggleMirror();
    } else if (e.code === 'KeyA') {
      e.preventDefault();
      markPointA();
    } else if (e.code === 'KeyB') {
      e.preventDefault();
      markPointB();
    } else if (e.code === 'KeyL') {
      e.preventDefault();
      toggleLoop();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      skip(-3);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      skip(3);
    } else if (e.code === 'Digit1') {
      e.preventDefault();
      setSpeed(0.75);
    } else if (e.code === 'Digit2') {
      e.preventDefault();
      setSpeed(1.0);
    } else if (e.code === 'Digit3') {
      e.preventDefault();
      setSpeed(1.25);
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  // Inicializar estado inicial
  updateLoopState();

  // API pública del reproductor
  return {
    videoElement: video,
    rootElement: playerRoot,
    setSource(url, meta = {}) {
      video.pause();
      video.src = url;
      video.load();
      if (meta.tags) {
        tags = [...meta.tags];
        tagsRow.innerHTML = renderTagsHtml(tags);
      }
      if (meta.initialLoopA !== undefined) pointA = meta.initialLoopA;
      if (meta.initialLoopB !== undefined) pointB = meta.initialLoopB;
      isLoopActive = Boolean(pointA !== null && pointB !== null);
      updateLoopState();
      checkOrientation();
    },
    toggleMirror,
    setSpeed,
    markPointA,
    markPointB,
    toggleLoop,
    clearLoop,
    toggleFullscreen,
    play() {
      return video.play();
    },
    pause() {
      video.pause();
    },
    destroy() {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      clearHudHideTimer();
      exitFullscreenMode();
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {}
      container.innerHTML = '';
    }
  };
}
