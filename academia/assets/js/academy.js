const STORAGE_KEY = 'inmotion-academy-demo-v1';
const DEMO_TODAY = new Date('2026-09-16T12:00:00');

const icons = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  scan: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14h.01M17 10h.01"/><circle cx="12" cy="12" r="2.3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>'
};

const roleConfig = {
  student: {
    label: 'Portal de alumno',
    initials: 'VR',
    routes: [
      ['inicio', 'Inicio', 'home'],
      ['clases', 'Clases', 'calendar'],
      ['carnet', 'Carnet QR', 'card']
    ]
  },
  teacher: {
    label: 'Portal de maestro',
    initials: 'AA',
    routes: [
      ['inicio', 'Inicio', 'home'],
      ['agenda', 'Agenda', 'calendar'],
      ['asistencia', 'Asistencia', 'scan']
    ]
  },
  admin: {
    label: 'Administración',
    initials: 'MB',
    routes: [
      ['inicio', 'Inicio', 'home'],
      ['alumnos', 'Alumnos', 'users'],
      ['pagos', 'Pagos', 'money'],
      ['asistencia', 'Asistencia', 'list']
    ]
  }
};

const classData = [
  { id: 'bachata-i', day: 'Hoy', date: '16 sep', time: '6:00 PM', name: 'Bachata Sensual I', level: 'Nivel inicial', teacher: 'Alex Aquino', room: 'Salón Rojo', capacity: '9 / 12' },
  { id: 'salsa-inter', day: 'Hoy', date: '16 sep', time: '7:15 PM', name: 'Salsa Intermedia', level: 'Nivel intermedio', teacher: 'Majo Borrayo', room: 'Salón Principal', capacity: '11 / 14' },
  { id: 'heels', day: 'Mañana', date: '17 sep', time: '6:30 PM', name: 'Heels Fundamentals', level: 'Todos los niveles', teacher: 'Sofía Castillo', room: 'Salón Rojo', capacity: '8 / 12' },
  { id: 'salsa-on2', day: 'Vie', date: '18 sep', time: '7:00 PM', name: 'Salsa On2', level: 'Nivel avanzado', teacher: 'Daniel López', room: 'Salón Principal', capacity: '10 / 14' },
  { id: 'kids', day: 'Sáb', date: '19 sep', time: '10:00 AM', name: 'Kids Dance', level: '7–11 años', teacher: 'Majo Borrayo', room: 'Salón Principal', capacity: '7 / 12' },
  { id: 'urbano', day: 'Sáb', date: '19 sep', time: '11:30 AM', name: 'Urbano', level: 'Nivel inicial', teacher: 'Leo Méndez', room: 'Salón Rojo', capacity: '12 / 14' }
];

const baseStudents = [
  { id: 'IM-0241', name: 'Valeria Ruiz', initials: 'VR', plan: 'Plan 8 clases', phone: '5555-0142', status: 'Pendiente' },
  { id: 'IM-0218', name: 'Luis Méndez', initials: 'LM', plan: 'Plan ilimitado', phone: '5555-0188', status: 'Al día' },
  { id: 'IM-0194', name: 'Andrea Pérez', initials: 'AP', plan: 'Plan 8 clases', phone: '5555-0120', status: 'Al día' },
  { id: 'IM-0250', name: 'Santiago Cruz', initials: 'SC', plan: 'Plan 4 clases', phone: '5555-0176', status: 'Pendiente' },
  { id: 'IM-0207', name: 'Camila Soto', initials: 'CS', plan: 'Plan ilimitado', phone: '5555-0159', status: 'Al día' },
  { id: 'IM-0229', name: 'María Fernanda León', initials: 'ML', plan: 'Plan 8 clases', phone: '5555-0134', status: 'Al día' }
];

const basePayments = [
  { id: 'P-1044', studentId: 'IM-0241', student: 'Valeria Ruiz', month: 'Septiembre 2026', amount: 450, method: 'Pendiente', date: 'Vence 18 sep', status: 'Pendiente' },
  { id: 'P-1043', studentId: 'IM-0218', student: 'Luis Méndez', month: 'Septiembre 2026', amount: 625, method: 'POS', date: '15 sep 2026', status: 'Pagado' },
  { id: 'P-1042', studentId: 'IM-0194', student: 'Andrea Pérez', month: 'Septiembre 2026', amount: 450, method: 'Transferencia', date: '13 sep 2026', status: 'Pagado' },
  { id: 'P-1041', studentId: 'IM-0250', student: 'Santiago Cruz', month: 'Septiembre 2026', amount: 300, method: 'Pendiente', date: 'Venció 10 sep', status: 'En mora' },
  { id: 'P-1040', studentId: 'IM-0207', student: 'Camila Soto', month: 'Septiembre 2026', amount: 625, method: 'Efectivo', date: '08 sep 2026', status: 'Pagado' }
];

const roster = [
  { id: 'IM-0241', name: 'Valeria Ruiz', initials: 'VR', plan: '8 clases' },
  { id: 'IM-0218', name: 'Luis Méndez', initials: 'LM', plan: 'Ilimitado' },
  { id: 'IM-0194', name: 'Andrea Pérez', initials: 'AP', plan: '8 clases' },
  { id: 'IM-0250', name: 'Santiago Cruz', initials: 'SC', plan: '4 clases' },
  { id: 'IM-0207', name: 'Camila Soto', initials: 'CS', plan: 'Ilimitado' },
  { id: 'IM-0229', name: 'María Fernanda León', initials: 'ML', plan: '8 clases' }
];

const defaultState = {
  role: null,
  students: baseStudents,
  payments: basePayments,
  attendance: {
    'bachata-i': ['IM-0218', 'IM-0194', 'IM-0207'],
    'salsa-inter': ['IM-0218', 'IM-0229']
  },
  studentCheckIn: false
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...defaultState,
      ...saved,
      students: Array.isArray(saved?.students) ? saved.students : baseStudents,
      payments: Array.isArray(saved?.payments) ? saved.payments : basePayments,
      attendance: { ...defaultState.attendance, ...(saved?.attendance || {}) }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

let state = loadState();
let activeRole = state.role || 'student';
let activeRoute = 'inicio';
let lastFocusedElement = null;

const elements = {
  access: document.querySelector('#accessView'),
  app: document.querySelector('#appShell'),
  sideNav: document.querySelector('#sideNav'),
  bottomNav: document.querySelector('#bottomNav'),
  content: document.querySelector('#mainContent'),
  roleSwitcher: document.querySelector('#roleSwitcher'),
  kicker: document.querySelector('#topbarKicker'),
  date: document.querySelector('#topbarDate'),
  initials: document.querySelector('#profileInitials'),
  menuButton: document.querySelector('#menuButton'),
  modalLayer: document.querySelector('#modalLayer'),
  modalTitle: document.querySelector('#modalTitle'),
  modalEyebrow: document.querySelector('#modalEyebrow'),
  modalBody: document.querySelector('#modalBody'),
  toastRegion: document.querySelector('#toastRegion')
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, role: activeRole }));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.home}</svg>`;
}

function navMarkup(config) {
  return config.routes.map(([route, label, iconName], index) => `
    <a class="nav-item ${activeRoute === route ? 'is-active' : ''}" href="#/${route}" data-route="${route}">
      <span class="nav-icon">${icon(iconName)}</span>
      <span>${label}</span>
      <span class="nav-index">0${index + 1}</span>
    </a>
  `).join('');
}

function updateShell() {
  const config = roleConfig[activeRole];
  if (!config.routes.some(([route]) => route === activeRoute)) activeRoute = 'inicio';
  elements.sideNav.innerHTML = navMarkup(config);
  elements.bottomNav.innerHTML = navMarkup(config);
  elements.roleSwitcher.value = activeRole;
  elements.kicker.textContent = config.label;
  elements.initials.textContent = config.initials;
  elements.date.textContent = new Intl.DateTimeFormat('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(DEMO_TODAY);
}

function enterDemo(role) {
  activeRole = role;
  activeRoute = 'inicio';
  state.role = role;
  saveState();
  elements.access.classList.add('is-hidden');
  elements.app.classList.remove('is-hidden');
  history.replaceState(null, '', '#/inicio');
  renderApp();
}

function leaveDemo() {
  state.role = null;
  saveState();
  elements.app.classList.add('is-hidden');
  elements.access.classList.remove('is-hidden');
  elements.app.classList.remove('menu-open');
  history.replaceState(null, '', window.location.pathname);
  document.querySelector('[data-enter-role="student"]')?.focus();
}

function renderApp() {
  updateShell();
  const key = `${activeRole}:${activeRoute}`;
  const renderer = renderers[key] || renderers[`${activeRole}:inicio`];
  elements.content.innerHTML = `<div class="page-enter">${renderer()}</div>`;
  elements.app.classList.remove('menu-open');
  elements.menuButton.setAttribute('aria-expanded', 'false');
  bindPageActions();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function routeTo(route) {
  activeRoute = route;
  history.pushState(null, '', `#/${route}`);
  renderApp();
  elements.content.focus({ preventScroll: true });
}

function weekStrip() {
  const days = [
    ['Lun', '14', ''], ['Mar', '15', ''], ['Mié', '16', '2 clases'],
    ['Jue', '17', '1 clase'], ['Vie', '18', '1 clase'], ['Sáb', '19', '2 clases'], ['Dom', '20', '']
  ];
  return `<div class="week-strip">${days.map(([day, number, note]) => `
    <div class="day-pill ${number === '16' ? 'is-today' : ''}">
      <span>${day}</span><strong>${number}</strong><small>${note}</small>
    </div>`).join('')}</div>`;
}

function classCards(classes = classData.slice(0, 3)) {
  return `<div class="cards-grid">${classes.map((item, index) => `
    <article class="class-card ${index === 0 ? 'is-featured' : ''}">
      <span class="class-card-index">0${index + 1}</span>
      <div class="class-card-top">
        <span class="tag ${index === 0 ? 'tag--dark' : ''}">${item.day} · ${item.time}</span>
        ${index === 0 ? '<span class="status-dot">Confirmada</span>' : ''}
      </div>
      <h3>${item.name}</h3>
      <p>${item.teacher}</p>
      <div class="class-card-foot"><span>${item.level}</span><span>${item.room}</span></div>
    </article>
  `).join('')}</div>`;
}

function scheduleList(classes = classData) {
  return `<div class="schedule-list">${classes.map((item) => `
    <div class="schedule-row">
      <div class="schedule-time">${item.time}<small>${item.day} · ${item.date}</small></div>
      <div class="schedule-name"><strong>${item.name}</strong><small>${item.level} · ${item.room}</small></div>
      <div class="schedule-teacher">${item.teacher}<small>Maestro</small></div>
      <span class="capacity">${item.capacity} inscritos</span>
      <button class="button button--light button--small" type="button" data-class-detail="${item.id}">Ver clase</button>
    </div>
  `).join('')}</div>`;
}

function renderStudentHome() {
  const attended = state.studentCheckIn ? 10 : 9;
  const payment = state.payments.find((item) => item.studentId === 'IM-0241' && item.month.includes('Septiembre'));
  const paid = payment?.status === 'Pagado';
  return `
    <section class="student-hero">
      <div class="student-hero-copy">
        <div>
          <p class="eyebrow">Miércoles · 16 de septiembre</p>
          <h1 class="hero-title">Hola, Valeria.<br/><span>¿Bailamos?</span></h1>
        </div>
        <div class="hero-foot">
          <button class="button button--red" type="button" data-open-scan>Marcar asistencia <span aria-hidden="true">↗</span></button>
          <p>${state.studentCheckIn ? 'Tu asistencia de hoy ya quedó registrada en esta demo.' : 'Mostrá tu carnet QR en recepción al llegar a la academia.'}</p>
        </div>
      </div>
      <aside class="next-class">
        <div class="next-class-label"><span>Próxima clase</span><span>01</span></div>
        <time><strong>6:00</strong><span>PM · Hoy</span></time>
        <div><h2>Bachata<br/>Sensual I</h2><p>Alex Aquino · Salón Rojo</p></div>
      </aside>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Esta semana</h2><p>Tu agenda de clases del 14 al 20 de septiembre.</p></div><button class="text-button" type="button" data-go="clases">Ver calendario →</button></div>
      ${weekStrip()}
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Tus próximas clases</h2><p>Plan 8 clases · 5 disponibles este mes</p></div></div>
      ${classCards()}
    </section>

    <section class="section split-grid">
      <article class="surface-card">
        <p class="eyebrow">Mensualidad · Septiembre</p>
        <div class="payment-status">
          <div><p class="payment-amount">Q ${payment?.amount || 450}</p><p class="payment-meta">${paid ? `Registrado · ${payment.date}` : 'Vence el 18 de septiembre'}</p></div>
          <button class="button ${paid ? 'button--light' : ''}" type="button" data-student-payment>${paid ? 'Ver comprobante' : 'Ver detalle'}</button>
        </div>
      </article>
      <article class="surface-card">
        <p class="eyebrow">Asistencia del mes</p>
        <h2>${attended} de 10 clases</h2>
        <div class="attendance-line"><span style="width:${attended * 10}%"></span></div>
        <div class="attendance-copy"><span>${attended * 10}% completado</span><span>${10 - attended} pendiente${10 - attended === 1 ? '' : 's'}</span></div>
      </article>
    </section>
  `;
}

function renderStudentClasses() {
  return `
    <header class="page-heading">
      <div><p class="eyebrow">Calendario de clases</p><h1>Elegí tu próximo<br/>movimiento.</h1><p>Horarios de demostración. La reserva de cupo no está conectada a un servidor.</p></div>
      <button class="button" type="button" data-open-scan>Mostrar mi QR</button>
    </header>
    <div class="filter-row" aria-label="Filtrar clases">
      <button class="filter-chip is-active" type="button" data-class-filter="all">Todas</button>
      <button class="filter-chip" type="button" data-class-filter="today">Hoy</button>
      <button class="filter-chip" type="button" data-class-filter="initial">Nivel inicial</button>
      <button class="filter-chip" type="button" data-class-filter="advanced">Avanzado</button>
    </div>
    <div id="studentSchedule">${scheduleList()}</div>
  `;
}

function qrMarkup() {
  const pattern = [
    '111111101010101111111','100000101101101000001','101110101010101011101','101110100111001011101','101110101001101011101','100000100110001000001','111111101010101111111','000000001110100000000','110011111011011010111','001110001100100111000','101011101011111001101','011100011110001110010','110101101001111011101','000000001010100010010','111111101111101010111','100000101000001110001','101110101111101011111','101110100100101100010','101110101111111011101','100000101001001001010','111111101101111011111'
  ];
  return `<svg viewBox="0 0 21 21" aria-label="Código QR de demostración" role="img" shape-rendering="crispEdges">
    <rect width="21" height="21" fill="#fff"/>
    ${pattern.flatMap((row, y) => [...row].map((cell, x) => cell === '1' ? `<rect x="${x}" y="${y}" width="1" height="1" fill="#0b0b0c"/>` : '')).join('')}
  </svg>`;
}

function renderStudentCard() {
  return `
    <header class="page-heading"><div><p class="eyebrow">Identificación digital</p><h1>Tu carnet.<br/>Siempre listo.</h1><p>Este QR funciona como demostración del flujo de asistencia y no representa una credencial real.</p></div></header>
    <div class="member-card-wrap">
      <article class="member-card">
        <img class="member-logo" src="./assets/inmotion-logo.svg" alt="In Motion Dance Academy" />
        <p class="member-card-label">Miembro activo · Plan 8 clases</p>
        <h2>Valeria<br/>Ruiz</h2>
        <span class="member-id">IM-0241 · Nivel intermedio</span>
        <div class="member-validity"><span>Vigencia</span><strong>30 · SEP · 2026</strong></div>
      </article>
      <aside class="qr-panel">
        <h2>Registro rápido</h2>
        <p>Mostrá este código en recepción para registrar tu llegada a clase.</p>
        <div class="qr-code">${qrMarkup()}</div>
        <p class="qr-demo-label">QR de demostración · IM-0241</p>
        <button class="button button--ghost" style="width:100%;margin-top:22px" type="button" data-open-scan>Simular lectura</button>
      </aside>
    </div>
  `;
}

function teacherCards() {
  return `<div class="teacher-day-grid">${classData.slice(0, 4).map((item, index) => `
    <article class="teacher-class">
      <div class="teacher-class-time">${item.time.replace(' ', '<br/>')}</div>
      <div><span class="tag ${index === 0 ? 'tag--red' : ''}">${item.day}</span><h3>${item.name}</h3><p>${item.room} · ${item.capacity} inscritos</p></div>
      <button class="button button--small ${index === 0 ? 'button--red' : 'button--light'}" type="button" data-take-attendance="${item.id}">${index === 0 ? 'Pasar asistencia' : 'Abrir clase'}</button>
    </article>
  `).join('')}</div>`;
}

function renderTeacherHome() {
  return `
    <section class="teacher-hero">
      <p class="eyebrow">Miércoles · 2 clases programadas</p>
      <h1>Buenas tardes,<br/><span>Alex.</span></h1>
      <div class="teacher-hero-foot"><button class="button button--red" type="button" data-take-attendance="bachata-i">Iniciar asistencia</button><p>Tu próxima clase empieza a las 6:00 PM<br/>en el Salón Rojo.</p></div>
    </section>
    <section class="section"><div class="section-head"><div><h2>Tu agenda</h2><p>Próximas clases asignadas.</p></div><button class="text-button" type="button" data-go="agenda">Ver semana →</button></div>${teacherCards()}</section>
  `;
}

function renderTeacherAgenda() {
  return `
    <header class="page-heading"><div><p class="eyebrow">Agenda docente</p><h1>Una semana<br/>en movimiento.</h1><p>Clases asignadas a Alex Aquino en esta demostración.</p></div></header>
    ${weekStrip()}
    <section class="section">${teacherCards()}</section>
  `;
}

function rosterMarkup(classId = 'bachata-i') {
  const selected = state.attendance[classId] || [];
  return `<div class="attendance-roster">${roster.map((student) => `
    <label class="student-check">
      <input type="checkbox" name="attendance" value="${student.id}" ${selected.includes(student.id) ? 'checked' : ''} />
      <span class="avatar">${student.initials}</span>
      <span><strong>${student.name}</strong><small>${student.id} · ${student.plan}</small></span>
      <span>${selected.includes(student.id) ? 'Presente' : 'Sin marcar'}</span>
    </label>
  `).join('')}</div>`;
}

function renderTeacherAttendance() {
  return `
    <header class="page-heading"><div><p class="eyebrow">Control de asistencia</p><h1>¿Quién vino<br/>a bailar?</h1><p>Marcá la lista y guardá esta sesión localmente.</p></div></header>
    <section class="split-grid">
      <article class="surface-card">
        <div class="section-head"><div><h2>Bachata Sensual I</h2><p>Hoy · 6:00 PM · Salón Rojo</p></div><span class="tag tag--red">En curso</span></div>
        <form id="attendanceForm" data-class-id="bachata-i">
          ${rosterMarkup('bachata-i')}
          <div class="form-actions"><button class="button button--red" type="submit">Guardar asistencia</button></div>
        </form>
      </article>
      <aside class="surface-card">
        <p class="eyebrow">Lectura QR</p><h2>Escáner de recepción</h2><p class="payment-meta">El prototipo simula la lectura del carnet de Valeria. No solicita cámara ni envía datos.</p>
        <div class="qr-code" style="max-width:220px;margin-top:24px">${qrMarkup()}</div>
        <button class="button" style="width:100%;margin-top:20px" type="button" data-open-scan>Simular escaneo</button>
      </aside>
    </section>
  `;
}

function pendingPayments() {
  return state.payments.filter((item) => item.status !== 'Pagado');
}

function adminPaymentRows(payments = state.payments) {
  if (!payments.length) return '<tr><td colspan="6"><div class="empty-state"><strong>No hay registros</strong>Probá con otro filtro.</div></td></tr>';
  return payments.map((item) => `
    <tr data-payment-row="${item.id}">
      <td><div class="person-cell"><span class="avatar">${initials(item.student)}</span><span><strong>${escapeHtml(item.student)}</strong><small>${item.studentId}</small></span></div></td>
      <td>${escapeHtml(item.month)}</td>
      <td><strong>Q ${item.amount}</strong></td>
      <td>${escapeHtml(item.method)}</td>
      <td><span class="status-pill ${item.status === 'Pagado' ? 'is-paid' : 'is-due'}">${escapeHtml(item.status)}</span></td>
      <td>${item.status === 'Pagado' ? `<button class="table-action" type="button" data-receipt="${item.id}">Comprobante</button>` : `<button class="table-action" type="button" data-register-for="${item.studentId}">Registrar</button>`}</td>
    </tr>
  `).join('');
}

function studentRows(students = state.students) {
  if (!students.length) return '<tr><td colspan="5"><div class="empty-state"><strong>Sin coincidencias</strong>Revisá el nombre o número de carnet.</div></td></tr>';
  return students.map((student) => `
    <tr>
      <td><div class="person-cell"><span class="avatar">${initials(student.name)}</span><span><strong>${escapeHtml(student.name)}</strong><small>${student.id}</small></span></div></td>
      <td>${escapeHtml(student.plan)}</td>
      <td>${escapeHtml(student.phone)}</td>
      <td><span class="status-pill ${student.status === 'Al día' ? 'is-paid' : 'is-due'}">${escapeHtml(student.status)}</span></td>
      <td><button class="table-action" type="button" data-student-detail="${student.id}">Ver ficha</button></td>
    </tr>
  `).join('');
}

function renderAdminHome() {
  const due = pendingPayments();
  return `
    <section class="admin-intro">
      <div><p class="eyebrow">Administración · Miércoles 16</p><h1>La academia,<br/>en orden.</h1></div>
      <div class="admin-intro-meta"><div><strong>50</strong><span>alumnos activos</span></div><div><strong>6</strong><span>maestros</span></div></div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Acciones de hoy</h2><p>Operaciones frecuentes del equipo administrativo.</p></div></div>
      <div class="filter-row"><button class="button button--red" type="button" data-open-payment>+ Registrar pago</button><button class="button button--light" type="button" data-open-student>+ Nuevo alumno</button><button class="button button--light" type="button" data-go="asistencia">Revisar asistencia</button></div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Pagos por resolver</h2><p>${due.length} registros necesitan seguimiento.</p></div><button class="text-button" type="button" data-go="pagos">Ver todos →</button></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Alumno</th><th>Mes</th><th>Monto</th><th>Método</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${adminPaymentRows(due)}</tbody></table></div>
    </section>
  `;
}

function renderAdminStudents() {
  return `
    <header class="page-heading"><div><p class="eyebrow">Base de alumnos</p><h1>Personas,<br/>no expedientes.</h1><p>Datos ficticios para validar la experiencia de gestión.</p></div><button class="button button--red" type="button" data-open-student>+ Nuevo alumno</button></header>
    <div class="section-head"><label class="search-box"><span>⌕</span><input id="studentSearch" type="search" placeholder="Buscar por nombre o carnet" autocomplete="off" /></label><span class="tag">${state.students.length} registros demo</span></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Alumno</th><th>Plan</th><th>Teléfono</th><th>Estado</th><th>Acción</th></tr></thead><tbody id="studentTableBody">${studentRows()}</tbody></table></div>
  `;
}

function renderAdminPayments() {
  const paid = state.payments.filter((item) => item.status === 'Pagado').reduce((sum, item) => sum + item.amount, 0);
  const due = pendingPayments().reduce((sum, item) => sum + item.amount, 0);
  return `
    <header class="page-heading"><div><p class="eyebrow">Control de pagos</p><h1>Registrar.<br/>Conciliar. Listo.</h1><p>Solo registra cobros realizados fuera del sistema. No procesa tarjetas ni emite FEL.</p></div><button class="button button--red" type="button" data-open-payment>+ Registrar pago</button></header>
    <section class="split-grid" style="margin-bottom:28px">
      <article class="surface-card"><p class="eyebrow">Registrado en septiembre</p><p class="payment-amount">Q ${paid.toLocaleString('es-GT')}</p><p class="payment-meta">Monto visible en esta demo local.</p></article>
      <article class="surface-card"><p class="eyebrow">Pendiente / mora</p><p class="payment-amount">Q ${due.toLocaleString('es-GT')}</p><p class="payment-meta">Requiere seguimiento administrativo.</p></article>
    </section>
    <div class="filter-row" id="paymentFilters"><button class="filter-chip is-active" type="button" data-payment-filter="all">Todos</button><button class="filter-chip" type="button" data-payment-filter="Pagado">Pagados</button><button class="filter-chip" type="button" data-payment-filter="Pendiente">Pendientes</button><button class="filter-chip" type="button" data-payment-filter="En mora">En mora</button></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Alumno</th><th>Mes</th><th>Monto</th><th>Método</th><th>Estado</th><th>Acción</th></tr></thead><tbody id="paymentTableBody">${adminPaymentRows()}</tbody></table></div>
  `;
}

function renderAdminAttendance() {
  const presentBachata = state.attendance['bachata-i']?.length || 0;
  const records = [
    ['Hoy · 6:00 PM', 'Bachata Sensual I', 'Alex Aquino', `${presentBachata} marcados`, 'En curso'],
    ['15 sep · 7:15 PM', 'Salsa Intermedia', 'Majo Borrayo', '10 presentes', 'Cerrada'],
    ['15 sep · 6:30 PM', 'Heels Fundamentals', 'Sofía Castillo', '8 presentes', 'Cerrada'],
    ['14 sep · 7:00 PM', 'Salsa On2', 'Daniel López', '11 presentes', 'Cerrada']
  ];
  return `
    <header class="page-heading"><div><p class="eyebrow">Registro de asistencia</p><h1>Cada llegada<br/>cuenta.</h1><p>Consulta operativa de sesiones. No incluye gráficas ni analítica avanzada.</p></div><button class="button" type="button" data-open-scan>Simular escáner QR</button></header>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha y hora</th><th>Clase</th><th>Maestro</th><th>Asistencia</th><th>Estado</th></tr></thead><tbody>${records.map((row, index) => `<tr>${row.map((cell, cellIndex) => `<td>${cellIndex === 4 ? `<span class="status-pill ${index ? 'is-paid' : 'is-due'}">${cell}</span>` : cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  `;
}

const renderers = {
  'student:inicio': renderStudentHome,
  'student:clases': renderStudentClasses,
  'student:carnet': renderStudentCard,
  'teacher:inicio': renderTeacherHome,
  'teacher:agenda': renderTeacherAgenda,
  'teacher:asistencia': renderTeacherAttendance,
  'admin:inicio': renderAdminHome,
  'admin:alumnos': renderAdminStudents,
  'admin:pagos': renderAdminPayments,
  'admin:asistencia': renderAdminAttendance
};

function initials(name) {
  return String(name).split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
}

function openModal({ title, eyebrow = 'Acción demo', body }) {
  lastFocusedElement = document.activeElement;
  elements.modalTitle.textContent = title;
  elements.modalEyebrow.textContent = eyebrow;
  elements.modalBody.innerHTML = body;
  elements.modalLayer.classList.remove('is-hidden');
  elements.modalLayer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  elements.modalLayer.querySelector('[data-close-modal]')?.focus();
  bindModalActions();
}

function closeModal() {
  elements.modalLayer.classList.add('is-hidden');
  elements.modalLayer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  lastFocusedElement?.focus?.();
}

function showToast(title, detail) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i></i><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span>`;
  elements.toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function openScanModal() {
  openModal({
    title: 'Escanear carnet',
    eyebrow: 'Asistencia QR · Simulación',
    body: `
      <div class="scan-stage"><span class="scan-line"></span><p class="scan-copy">Alineá el código dentro del recuadro</p></div>
      <p class="modal-note">Demo local: no se activa la cámara. El botón simula la lectura del carnet IM-0241.</p>
      <div class="form-actions"><button class="button button--red" type="button" id="simulateScan">Simular lectura</button></div>
    `
  });
}

function openPaymentModal(studentId = 'IM-0241') {
  const student = state.students.find((item) => item.id === studentId) || state.students[0];
  openModal({
    title: 'Registrar pago',
    eyebrow: 'Administración · Registro interno',
    body: `
      <form id="paymentForm">
        <div class="form-grid">
          <label class="field field--wide"><span>Alumno</span><select name="studentId" required>${state.students.map((item) => `<option value="${item.id}" ${item.id === student.id ? 'selected' : ''}>${escapeHtml(item.name)} · ${item.id}</option>`).join('')}</select></label>
          <label class="field"><span>Monto (Q)</span><input name="amount" type="number" min="1" step="1" value="450" required /></label>
          <label class="field"><span>Método</span><select name="method" required><option>POS</option><option>Transferencia</option><option>Efectivo</option><option>Depósito</option></select></label>
          <label class="field"><span>Mes aplicado</span><select name="month"><option>Septiembre 2026</option><option>Octubre 2026</option></select></label>
          <label class="field"><span>Referencia</span><input name="reference" placeholder="Ej. voucher 1842" /></label>
        </div>
        <p class="modal-note">Este registro no realiza ningún cobro, no procesa tarjetas y no genera factura FEL.</p>
        <div class="form-actions"><button class="button button--light" type="button" data-close-modal>Cancelar</button><button class="button button--red" type="submit">Guardar pago</button></div>
      </form>
    `
  });
}

function openNewStudentModal() {
  openModal({
    title: 'Nuevo alumno',
    eyebrow: 'Administración · Datos demo',
    body: `
      <form id="studentForm">
        <div class="form-grid">
          <label class="field field--wide"><span>Nombre completo</span><input name="name" required placeholder="Nombre y apellido" /></label>
          <label class="field"><span>Plan</span><select name="plan"><option>Plan 4 clases</option><option selected>Plan 8 clases</option><option>Plan ilimitado</option></select></label>
          <label class="field"><span>Teléfono</span><input name="phone" inputmode="tel" placeholder="5555-0000" /></label>
          <label class="field field--wide"><span>Notas internas</span><textarea name="notes" placeholder="Opcional"></textarea></label>
        </div>
        <p class="modal-note">Los datos se guardan únicamente en este navegador para demostrar el flujo.</p>
        <div class="form-actions"><button class="button button--light" type="button" data-close-modal>Cancelar</button><button class="button button--red" type="submit">Crear alumno</button></div>
      </form>
    `
  });
}

function openClassDetail(classId) {
  const item = classData.find((entry) => entry.id === classId);
  if (!item) return;
  openModal({
    title: item.name,
    eyebrow: `${item.day} · ${item.date} · ${item.time}`,
    body: `
      <div class="surface-card" style="padding:20px;margin-bottom:16px"><p class="eyebrow">Detalle de clase</p><h3>${item.level}</h3><p class="payment-meta">${item.teacher} · ${item.room}<br/>${item.capacity} alumnos inscritos</p></div>
      <p class="modal-note">La agenda es demostrativa. La reserva y los cupos no están conectados a un backend.</p>
      <div class="form-actions"><button class="button button--red" type="button" id="confirmClass">Confirmar asistencia</button></div>
    `
  });
}

function openStudentPayment() {
  const payment = state.payments.find((item) => item.studentId === 'IM-0241' && item.month.includes('Septiembre'));
  const paid = payment?.status === 'Pagado';
  openModal({
    title: paid ? 'Comprobante interno' : 'Mensualidad pendiente',
    eyebrow: 'Septiembre 2026',
    body: `
      <article class="surface-card"><p class="eyebrow">${paid ? 'Pago registrado' : 'Saldo por registrar'}</p><p class="payment-amount">Q ${payment?.amount || 450}</p><p class="payment-meta">${paid ? `${payment.method} · ${payment.date}` : 'Fecha límite · 18 de septiembre de 2026'}</p></article>
      <p class="modal-note" style="margin-top:16px">La academia cobra por sus medios habituales. La app solo refleja el registro interno; no hay pasarela ni pago con tarjeta.</p>
    `
  });
}

function openReceipt(paymentId) {
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) return;
  openModal({
    title: 'Comprobante interno',
    eyebrow: `Registro ${payment.id}`,
    body: `
      <article class="surface-card"><p class="eyebrow">Pago registrado</p><p class="payment-amount">Q ${payment.amount}</p><h3>${escapeHtml(payment.student)}</h3><p class="payment-meta">${escapeHtml(payment.month)} · ${escapeHtml(payment.method)} · ${escapeHtml(payment.date)}</p></article>
      <p class="modal-note" style="margin-top:16px">Documento de demostración. No es factura FEL ni comprobante tributario.</p>
    `
  });
}

function openStudentDetail(studentId) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student) return;
  openModal({
    title: student.name,
    eyebrow: `Ficha ${student.id}`,
    body: `
      <article class="surface-card"><div class="person-cell"><span class="avatar" style="width:54px;height:54px">${initials(student.name)}</span><span><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.plan)}</small></span></div><p class="payment-meta" style="margin-top:22px">Teléfono · ${escapeHtml(student.phone || 'Sin registrar')}<br/>Estado de pago · ${escapeHtml(student.status)}</p></article>
      <p class="modal-note" style="margin-top:16px">Ficha demo sin información sensible real.</p>
    `
  });
}

function openProfile() {
  const profiles = {
    student: ['Valeria Ruiz', 'Alumno · Plan 8 clases', 'IM-0241'],
    teacher: ['Alex Aquino', 'Maestro', '6 clases asignadas'],
    admin: ['Majo Borrayo', 'Administración', 'Acceso de demostración']
  };
  const [name, role, meta] = profiles[activeRole];
  openModal({
    title: name,
    eyebrow: roleConfig[activeRole].label,
    body: `
      <article class="surface-card"><div class="person-cell"><span class="avatar" style="width:58px;height:58px">${roleConfig[activeRole].initials}</span><span><strong>${name}</strong><small>${role}</small></span></div><p class="payment-meta" style="margin-top:22px">${meta}</p></article>
      <p class="modal-note" style="margin-top:16px">Perfil ficticio para recorrer el prototipo. No existe autenticación ni cuenta real.</p>
    `
  });
}

function bindModalActions() {
  elements.modalLayer.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  elements.modalLayer.querySelector('#simulateScan')?.addEventListener('click', () => {
    const list = new Set(state.attendance['bachata-i'] || []);
    list.add('IM-0241');
    state.attendance['bachata-i'] = [...list];
    state.studentCheckIn = true;
    saveState();
    closeModal();
    showToast('Asistencia registrada', 'Valeria Ruiz · Bachata Sensual I · 6:00 PM');
    renderApp();
  });
  elements.modalLayer.querySelector('#confirmClass')?.addEventListener('click', () => {
    closeModal();
    showToast('Clase confirmada', 'Tu cupo se marcó en esta demostración.');
  });
  elements.modalLayer.querySelector('#paymentForm')?.addEventListener('submit', handlePaymentSubmit);
  elements.modalLayer.querySelector('#studentForm')?.addEventListener('submit', handleStudentSubmit);
}

function handlePaymentSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const student = state.students.find((item) => item.id === data.get('studentId'));
  if (!student) return;
  const existing = state.payments.find((item) => item.studentId === student.id && item.month === data.get('month'));
  const record = {
    id: existing?.id || `P-${1045 + state.payments.length}`,
    studentId: student.id,
    student: student.name,
    month: String(data.get('month')),
    amount: Number(data.get('amount')),
    method: String(data.get('method')),
    date: '16 sep 2026',
    status: 'Pagado',
    reference: String(data.get('reference') || '')
  };
  state.payments = existing ? state.payments.map((item) => item.id === existing.id ? record : item) : [record, ...state.payments];
  state.students = state.students.map((item) => item.id === student.id ? { ...item, status: 'Al día' } : item);
  saveState();
  closeModal();
  showToast('Pago guardado', `${student.name} · Q ${record.amount} · ${record.method}`);
  renderApp();
}

function handleStudentSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get('name')).trim();
  if (!name) return;
  const nextNumber = 250 + state.students.length + 1;
  state.students = [{
    id: `IM-0${nextNumber}`,
    name,
    initials: initials(name),
    plan: String(data.get('plan')),
    phone: String(data.get('phone') || 'Sin registrar'),
    status: 'Pendiente',
    notes: String(data.get('notes') || '')
  }, ...state.students];
  saveState();
  closeModal();
  showToast('Alumno creado', `${name} · registro local`);
  renderApp();
}

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const register = (tool) => {
    try {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
    } catch {
      // WebMCP is optional; the visible interface remains fully usable.
    }
  };

  register({
    name: 'read_demo_schedule',
    title: 'Consultar horario demo',
    description: 'Devuelve las clases visibles en el horario de demostración de In Motion.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute() {
      return { classes: classData.map(({ id, day, date, time, name, teacher, room }) => ({ id, day, date, time, name, teacher, room })) };
    }
  });

  register({
    name: 'register_demo_attendance',
    title: 'Registrar asistencia demo',
    description: 'Marca a un alumno existente como presente en una clase del prototipo y actualiza la interfaz visible.',
    inputSchema: {
      type: 'object',
      properties: { classId: { type: 'string' }, studentId: { type: 'string' } },
      required: ['classId', 'studentId'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const classItem = classData.find((item) => item.id === input?.classId);
      const student = state.students.find((item) => item.id === input?.studentId);
      if (!classItem) throw new Error('Clase demo no encontrada.');
      if (!student) throw new Error('Alumno demo no encontrado.');
      const present = new Set(state.attendance[classItem.id] || []);
      present.add(student.id);
      state.attendance[classItem.id] = [...present];
      if (student.id === 'IM-0241') state.studentCheckIn = true;
      saveState();
      if (!elements.app.classList.contains('is-hidden')) renderApp();
      return { classId: classItem.id, studentId: student.id, status: 'present' };
    }
  });

  register({
    name: 'register_demo_payment',
    title: 'Registrar pago demo',
    description: 'Registra localmente un pago ya realizado fuera de la plataforma; no cobra ni procesa tarjetas.',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: { type: 'string' },
        amount: { type: 'number', exclusiveMinimum: 0 },
        method: { type: 'string', enum: ['POS', 'Transferencia', 'Efectivo', 'Depósito'] }
      },
      required: ['studentId', 'amount', 'method'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const student = state.students.find((item) => item.id === input?.studentId);
      if (!student) throw new Error('Alumno demo no encontrado.');
      if (!Number.isFinite(input?.amount) || input.amount <= 0) throw new Error('El monto debe ser mayor que cero.');
      const methods = ['POS', 'Transferencia', 'Efectivo', 'Depósito'];
      if (!methods.includes(input?.method)) throw new Error('Método de pago no válido.');
      const existing = state.payments.find((item) => item.studentId === student.id && item.month === 'Septiembre 2026');
      const record = {
        id: existing?.id || `P-${1045 + state.payments.length}`,
        studentId: student.id,
        student: student.name,
        month: 'Septiembre 2026',
        amount: input.amount,
        method: input.method,
        date: '16 sep 2026',
        status: 'Pagado'
      };
      state.payments = existing ? state.payments.map((item) => item.id === existing.id ? record : item) : [record, ...state.payments];
      state.students = state.students.map((item) => item.id === student.id ? { ...item, status: 'Al día' } : item);
      saveState();
      if (!elements.app.classList.contains('is-hidden')) renderApp();
      return { paymentId: record.id, studentId: student.id, amount: record.amount, status: 'recorded' };
    }
  });
}

function handleAttendanceSubmit(event) {
  event.preventDefault();
  const classId = event.currentTarget.dataset.classId;
  state.attendance[classId] = [...event.currentTarget.querySelectorAll('input[name="attendance"]:checked')].map((input) => input.value);
  saveState();
  showToast('Asistencia guardada', `${state.attendance[classId].length} alumnos marcados como presentes.`);
  renderApp();
}

function bindPageActions() {
  elements.content.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => routeTo(button.dataset.go)));
  elements.content.querySelectorAll('[data-open-scan]').forEach((button) => button.addEventListener('click', openScanModal));
  elements.content.querySelectorAll('[data-open-payment]').forEach((button) => button.addEventListener('click', () => openPaymentModal()));
  elements.content.querySelectorAll('[data-open-student]').forEach((button) => button.addEventListener('click', openNewStudentModal));
  elements.content.querySelectorAll('[data-class-detail]').forEach((button) => button.addEventListener('click', () => openClassDetail(button.dataset.classDetail)));
  elements.content.querySelectorAll('[data-take-attendance]').forEach((button) => button.addEventListener('click', () => {
    activeRole = 'teacher'; activeRoute = 'asistencia'; history.pushState(null, '', '#/asistencia'); renderApp();
  }));
  elements.content.querySelectorAll('[data-register-for]').forEach((button) => button.addEventListener('click', () => openPaymentModal(button.dataset.registerFor)));
  elements.content.querySelectorAll('[data-receipt]').forEach((button) => button.addEventListener('click', () => openReceipt(button.dataset.receipt)));
  elements.content.querySelectorAll('[data-student-detail]').forEach((button) => button.addEventListener('click', () => openStudentDetail(button.dataset.studentDetail)));
  elements.content.querySelector('[data-student-payment]')?.addEventListener('click', openStudentPayment);
  elements.content.querySelector('#attendanceForm')?.addEventListener('submit', handleAttendanceSubmit);

  elements.content.querySelectorAll('[data-class-filter]').forEach((button) => button.addEventListener('click', () => {
    elements.content.querySelectorAll('[data-class-filter]').forEach((chip) => chip.classList.toggle('is-active', chip === button));
    const filter = button.dataset.classFilter;
    const filtered = filter === 'today' ? classData.filter((item) => item.day === 'Hoy')
      : filter === 'initial' ? classData.filter((item) => item.level.toLowerCase().includes('inicial'))
      : filter === 'advanced' ? classData.filter((item) => item.level.toLowerCase().includes('avanzado'))
      : classData;
    document.querySelector('#studentSchedule').innerHTML = scheduleList(filtered);
    document.querySelectorAll('[data-class-detail]').forEach((detail) => detail.addEventListener('click', () => openClassDetail(detail.dataset.classDetail)));
  }));

  elements.content.querySelector('#studentSearch')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    const filtered = state.students.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(query));
    document.querySelector('#studentTableBody').innerHTML = studentRows(filtered);
    document.querySelectorAll('[data-student-detail]').forEach((button) => button.addEventListener('click', () => openStudentDetail(button.dataset.studentDetail)));
  });

  elements.content.querySelectorAll('[data-payment-filter]').forEach((button) => button.addEventListener('click', () => {
    elements.content.querySelectorAll('[data-payment-filter]').forEach((chip) => chip.classList.toggle('is-active', chip === button));
    const filter = button.dataset.paymentFilter;
    const filtered = filter === 'all' ? state.payments : state.payments.filter((item) => item.status === filter);
    document.querySelector('#paymentTableBody').innerHTML = adminPaymentRows(filtered);
    document.querySelectorAll('[data-register-for]').forEach((action) => action.addEventListener('click', () => openPaymentModal(action.dataset.registerFor)));
    document.querySelectorAll('[data-receipt]').forEach((action) => action.addEventListener('click', () => openReceipt(action.dataset.receipt)));
  }));
}

document.querySelectorAll('[data-enter-role]').forEach((button) => button.addEventListener('click', () => enterDemo(button.dataset.enterRole)));
document.querySelector('#exitDemo').addEventListener('click', leaveDemo);
document.querySelector('#profileButton').addEventListener('click', openProfile);

elements.roleSwitcher.addEventListener('change', (event) => {
  activeRole = event.target.value;
  activeRoute = 'inicio';
  state.role = activeRole;
  saveState();
  history.pushState(null, '', '#/inicio');
  renderApp();
  showToast('Vista actualizada', `Ahora estás viendo ${roleConfig[activeRole].label.toLowerCase()}.`);
});

elements.menuButton.addEventListener('click', () => {
  const open = elements.app.classList.toggle('menu-open');
  elements.menuButton.setAttribute('aria-expanded', String(open));
});

document.addEventListener('click', (event) => {
  const routeLink = event.target.closest('[data-route]');
  if (!routeLink) return;
  event.preventDefault();
  routeTo(routeLink.dataset.route);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.modalLayer.classList.contains('is-hidden')) closeModal();
});

window.addEventListener('popstate', () => {
  const route = window.location.hash.replace('#/', '') || 'inicio';
  activeRoute = route;
  if (!elements.app.classList.contains('is-hidden')) renderApp();
});

if (state.role) {
  activeRole = state.role;
  activeRoute = window.location.hash.replace('#/', '') || 'inicio';
  window.setTimeout(() => {
    elements.access.classList.add('is-hidden');
    elements.app.classList.remove('is-hidden');
    renderApp();
  }, 1750);
}

registerWebMcpTools();
