const STORAGE_KEY = 'inmotion-academy-demo-v1';
const STATE_VERSION = 1;
const TODAY = new Date();
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

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
  { id: 'bachata-inter', weekday: 3, time: '6:00 PM', name: 'Bachata Intermedio', level: 'Nivel intermedio', teacher: 'Alex Aquino', room: 'Salón 2', enrolled: 14, capacity: 18 },
  { id: 'salsa-basico', weekday: 3, time: '7:15 PM', name: 'Salsa Principiantes', level: 'Nivel inicial', teacher: 'Luis Ramírez', room: 'Salón 1', enrolled: 9, capacity: 20 },
  { id: 'kpop-teens', weekday: 4, time: '5:00 PM', name: 'K-Pop Teens', level: '12 a 17 años', teacher: 'Majo Borrayo', room: 'Salón 1', enrolled: 18, capacity: 18 },
  { id: 'latino', weekday: 4, time: '7:00 PM', name: 'Baile Latino', level: 'Todos los niveles', teacher: 'Alex Aquino', room: 'Salón 2', enrolled: 12, capacity: 20 },
  { id: 'latino-kids', weekday: 6, time: '10:00 AM', name: 'Baile Latino Kids', level: '7 a 11 años', teacher: 'Sofía Castillo', room: 'Salón 1', enrolled: 7, capacity: 12 },
  { id: 'salsa-on2', weekday: 6, time: '11:30 AM', name: 'Salsa On2', level: 'Nivel avanzado', teacher: 'Leo Méndez', room: 'Salón 2', enrolled: 10, capacity: 14 }
];

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysBetween(date) {
  return Math.round((startOfDay(date) - startOfDay(TODAY)) / 86400000);
}

function nextDateFor(weekday) {
  return addDays(TODAY, (weekday - startOfDay(TODAY).getDay() + 7) % 7);
}

function dayLabel(date) {
  const diff = daysBetween(date);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  return WEEKDAY_SHORT[date.getDay()];
}

function shortDate(date) {
  return new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short' }).format(date).replace('.', '');
}

function longDate(date) {
  const text = new Intl.DateTimeFormat('es-GT', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthLabel(date) {
  const month = monthName(date);
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${date.getFullYear()}`;
}

function monthName(date) {
  return new Intl.DateTimeFormat('es-GT', { month: 'long' }).format(date);
}

function timeValue(time) {
  const match = String(time).match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hour = Number(match[1]) % 12;
  if (/PM/i.test(match[3])) hour += 12;
  return hour * 60 + Number(match[2]);
}

function greeting() {
  const hour = TODAY.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// Cada clase se agenda por día de la semana: las etiquetas Hoy / Mañana se calculan
// contra la fecha real, para que la demo nunca se vea vencida.
function scheduledClasses() {
  return classData
    .map((item) => {
      const date = nextDateFor(item.weekday);
      return { ...item, date, day: dayLabel(date), dateLabel: shortDate(date) };
    })
    .sort((a, b) => (a.date - b.date) || (timeValue(a.time) - timeValue(b.time)));
}

function findClass(classId) {
  return scheduledClasses().find((item) => item.id === classId);
}

function todayClasses() {
  return scheduledClasses().filter((item) => item.day === 'Hoy');
}

function nextClass() {
  return todayClasses()[0] || scheduledClasses()[0];
}

const TEACHER_NAME = 'Alex Aquino';

function teacherClasses() {
  return scheduledClasses().filter((item) => item.teacher === TEACHER_NAME);
}

function weekRange() {
  const monday = addDays(TODAY, -((startOfDay(TODAY).getDay() + 6) % 7));
  return `${shortDate(monday)} al ${shortDate(addDays(monday, 6))}`;
}

function shortDayLabel(date) {
  const weekday = new Intl.DateTimeFormat('es-GT', { weekday: 'long' }).format(date);
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${date.getDate()}`;
}

function nextMonthDate() {
  return new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 1);
}

function nextPaymentId() {
  const highest = state.payments.reduce((acc, item) => Math.max(acc, Number(String(item.id).replace(/\D/g, '')) || 0), 1000);
  return `P-${highest + 1}`;
}

function nextStudentId() {
  const highest = state.students.reduce((acc, item) => Math.max(acc, Number(String(item.id).replace(/\D/g, '')) || 0), 240);
  return `IM-${String(highest + 1).padStart(4, '0')}`;
}

function capacityText(item) {
  return `${item.enrolled} / ${item.capacity}`;
}

const baseStudents = [
  { id: 'IM-0241', name: 'Valeria Ruiz', initials: 'VR', plan: 'Plan 8 clases', phone: '5555-0142', status: 'Pendiente' },
  { id: 'IM-0218', name: 'Luis Méndez', initials: 'LM', plan: 'Plan ilimitado', phone: '5555-0188', status: 'Al día' },
  { id: 'IM-0194', name: 'Andrea Pérez', initials: 'AP', plan: 'Plan 8 clases', phone: '5555-0120', status: 'Al día' },
  { id: 'IM-0250', name: 'Santiago Cruz', initials: 'SC', plan: 'Plan 4 clases', phone: '5555-0176', status: 'Pendiente' },
  { id: 'IM-0207', name: 'Camila Soto', initials: 'CS', plan: 'Plan ilimitado', phone: '5555-0159', status: 'Al día' },
  { id: 'IM-0229', name: 'María Fernanda León', initials: 'ML', plan: 'Plan 8 clases', phone: '5555-0134', status: 'Al día' }
];

const basePayments = [
  { id: 'P-1044', studentId: 'IM-0241', student: 'Valeria Ruiz', month: monthLabel(TODAY), amount: 450, method: 'Pendiente', date: `Vence ${shortDate(addDays(TODAY, 2))}`, status: 'Pendiente' },
  { id: 'P-1043', studentId: 'IM-0218', student: 'Luis Méndez', month: monthLabel(TODAY), amount: 625, method: 'POS', date: shortDate(addDays(TODAY, -1)), status: 'Pagado' },
  { id: 'P-1042', studentId: 'IM-0194', student: 'Andrea Pérez', month: monthLabel(TODAY), amount: 450, method: 'Transferencia', date: shortDate(addDays(TODAY, -3)), status: 'Pagado' },
  { id: 'P-1041', studentId: 'IM-0250', student: 'Santiago Cruz', month: monthLabel(TODAY), amount: 300, method: 'Pendiente', date: `Venció ${shortDate(addDays(TODAY, -6))}`, status: 'En mora' },
  { id: 'P-1040', studentId: 'IM-0207', student: 'Camila Soto', month: monthLabel(TODAY), amount: 625, method: 'Efectivo', date: shortDate(addDays(TODAY, -8)), status: 'Pagado' }
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
    'bachata-inter': ['IM-0218', 'IM-0194', 'IM-0207'],
    'salsa-basico': ['IM-0218', 'IM-0229']
  },
  studentCheckIn: false
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Un esquema viejo guardado en el navegador rompe la demo en silencio: se descarta.
    if (!saved || saved.version !== STATE_VERSION) return structuredClone(defaultState);
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
let activeClassId = classData[0].id;
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, role: activeRole, version: STATE_VERSION }));
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
  elements.date.textContent = longDate(TODAY);
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function routeTo(route) {
  activeRoute = route;
  history.pushState(null, '', `#/${route}`);
  renderApp();
  elements.content.focus({ preventScroll: true });
}

function weekStrip() {
  const monday = addDays(TODAY, -((startOfDay(TODAY).getDay() + 6) % 7));
  const perWeekday = classData.reduce((acc, item) => {
    acc[item.weekday] = (acc[item.weekday] || 0) + 1;
    return acc;
  }, {});
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  return `<div class="week-strip">${days.map((date) => {
    const total = perWeekday[date.getDay()] || 0;
    const note = total ? `${total} clase${total === 1 ? '' : 's'}` : '';
    return `<div class="day-pill ${daysBetween(date) === 0 ? 'is-today' : ''}">
      <span>${WEEKDAY_SHORT[date.getDay()]}</span><strong>${date.getDate()}</strong><small>${note}</small>
    </div>`;
  }).join('')}</div>`;
}

function classCards(classes = scheduledClasses().slice(0, 3)) {
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

function scheduleList(classes = scheduledClasses()) {
  return `<div class="schedule-list">${classes.map((item) => `
    <div class="schedule-row">
      <div class="schedule-time">${item.time}<small>${item.day} · ${item.dateLabel}</small></div>
      <div class="schedule-name"><strong>${item.name}</strong><small>${item.level} · ${item.room}</small></div>
      <div class="schedule-teacher">${item.teacher}<small>Maestro</small></div>
      <span class="capacity">${capacityText(item)} inscritos</span>
      <button class="button button--light button--small" type="button" data-class-detail="${item.id}">Ver clase</button>
    </div>
  `).join('')}</div>`;
}

function renderStudentHome() {
  const planTotal = 8;
  const attended = state.studentCheckIn ? 6 : 5;
  const payment = state.payments.find((item) => item.studentId === 'IM-0241' && item.month === monthLabel(TODAY));
  const paid = payment?.status === 'Pagado';
  const next = nextClass();
  const [hour, meridiem] = next.time.split(' ');
  const percent = Math.round((attended / planTotal) * 100);
  return `
    <section class="student-hero">
      <div class="student-hero-copy">
        <div>
          <p class="eyebrow">${shortDayLabel(TODAY)}</p>
          <h1 class="hero-title">Hola, Valeria.<br/><span>¿Bailamos?</span></h1>
        </div>
        <div class="hero-foot">
          <button class="button button--red" type="button" data-open-scan>Marcar asistencia <span aria-hidden="true">↗</span></button>
          <p>${state.studentCheckIn ? 'Tu asistencia de hoy ya quedó registrada en esta demo.' : 'Mostrá tu carnet QR en recepción al llegar a la academia.'}</p>
        </div>
      </div>
      <aside class="next-class">
        <div class="next-class-label"><span>Próxima clase</span><span>01</span></div>
        <time><strong>${hour}</strong><span>${meridiem} · ${next.day}</span></time>
        <div><h2>${next.name}</h2><p>${next.teacher} · ${next.room}</p></div>
      </aside>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Esta semana</h2><p>Tu agenda de clases del ${weekRange()}.</p></div><button class="text-button" type="button" data-go="clases">Ver calendario →</button></div>
      ${weekStrip()}
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Tus próximas clases</h2><p>Plan ${planTotal} clases · ${planTotal - attended} disponibles este mes</p></div></div>
      ${classCards()}
    </section>

    <section class="section split-grid">
      <article class="surface-card">
        <p class="eyebrow">Mensualidad · ${monthName(TODAY)}</p>
        <div class="payment-status">
          <div><p class="payment-amount">Q ${payment?.amount || 450}</p><p class="payment-meta">${paid ? `Registrado · ${payment.date}` : `Vence el ${shortDate(addDays(TODAY, 2))}`}</p></div>
          <button class="button ${paid ? 'button--light' : ''}" type="button" data-student-payment>${paid ? 'Ver comprobante' : 'Ver detalle'}</button>
        </div>
      </article>
      <article class="surface-card">
        <p class="eyebrow">Asistencia del mes</p>
        <h2>${attended} de ${planTotal} clases</h2>
        <div class="attendance-line"><span style="width:${percent}%"></span></div>
        <div class="attendance-copy"><span>${percent}% completado</span><span>${planTotal - attended} pendiente${planTotal - attended === 1 ? '' : 's'}</span></div>
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
  return `<div class="teacher-day-grid">${teacherClasses().slice(0, 4).map((item, index) => `
    <article class="teacher-class">
      <div class="teacher-class-time">${item.time.replace(' ', '<br/>')}</div>
      <div><span class="tag ${index === 0 ? 'tag--red' : ''}">${item.day}</span><h3>${item.name}</h3><p>${item.room} · ${capacityText(item)} inscritos</p></div>
      <button class="button button--small ${index === 0 ? 'button--red' : 'button--light'}" type="button" data-take-attendance="${item.id}">${index === 0 ? 'Pasar asistencia' : 'Abrir clase'}</button>
    </article>
  `).join('')}</div>`;
}

function renderTeacherHome() {
  const own = teacherClasses();
  const today = own.filter((item) => item.day === 'Hoy');
  const next = today[0] || own[0];
  const count = today.length;
  return `
    <section class="teacher-hero">
      <p class="eyebrow">${shortDayLabel(TODAY)} · ${count ? `${count} clase${count === 1 ? '' : 's'} programada${count === 1 ? '' : 's'}` : 'sin clases hoy'}</p>
      <h1>${greeting()},<br/><span>Alex.</span></h1>
      <div class="teacher-hero-foot">
        ${next ? `<button class="button button--red" type="button" data-take-attendance="${next.id}">${count ? 'Iniciar asistencia' : 'Abrir próxima clase'}</button>` : ''}
        <p>${next ? `Tu ${count ? 'próxima clase empieza' : 'siguiente clase es'} ${next.day.toLowerCase()} a las ${next.time}<br/>en el ${next.room}.` : 'No tenés clases asignadas en esta demostración.'}</p>
      </div>
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

function rosterMarkup(classId = activeClassId) {
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
  const item = findClass(activeClassId) || scheduledClasses()[0];
  const live = item.day === 'Hoy';
  return `
    <header class="page-heading"><div><p class="eyebrow">Control de asistencia</p><h1>¿Quién vino<br/>a bailar?</h1><p>Marcá la lista y guardá esta sesión localmente.</p></div></header>
    <section class="split-grid">
      <article class="surface-card">
        <div class="section-head"><div><h2>${item.name}</h2><p>${item.day} · ${item.time} · ${item.room}</p></div><span class="tag ${live ? 'tag--red' : ''}">${live ? 'En curso' : 'Programada'}</span></div>
        <form id="attendanceForm" data-class-id="${item.id}">
          ${rosterMarkup(item.id)}
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
      <div><p class="eyebrow">Administración · ${shortDayLabel(TODAY)}</p><h1>La academia,<br/>en orden.</h1></div>
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
      <article class="surface-card"><p class="eyebrow">Registrado en ${monthName(TODAY)}</p><p class="payment-amount">Q ${paid.toLocaleString('es-GT')}</p><p class="payment-meta">Monto visible en esta demo local.</p></article>
      <article class="surface-card"><p class="eyebrow">Pendiente / mora</p><p class="payment-amount">Q ${due.toLocaleString('es-GT')}</p><p class="payment-meta">Requiere seguimiento administrativo.</p></article>
    </section>
    <div class="filter-row" id="paymentFilters"><button class="filter-chip is-active" type="button" data-payment-filter="all">Todos</button><button class="filter-chip" type="button" data-payment-filter="Pagado">Pagados</button><button class="filter-chip" type="button" data-payment-filter="Pendiente">Pendientes</button><button class="filter-chip" type="button" data-payment-filter="En mora">En mora</button></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Alumno</th><th>Mes</th><th>Monto</th><th>Método</th><th>Estado</th><th>Acción</th></tr></thead><tbody id="paymentTableBody">${adminPaymentRows()}</tbody></table></div>
  `;
}

function renderAdminAttendance() {
  const sessions = scheduledClasses().slice(0, 4).map((item) => {
    const marked = state.attendance[item.id]?.length || 0;
    const live = item.day === 'Hoy';
    return [
      `${item.day} · ${item.time}`,
      item.name,
      item.teacher,
      `${marked} marcado${marked === 1 ? '' : 's'} de ${item.enrolled}`,
      live ? 'En curso' : 'Programada'
    ];
  });
  return `
    <header class="page-heading"><div><p class="eyebrow">Registro de asistencia</p><h1>Cada llegada<br/>cuenta.</h1><p>Consulta operativa de sesiones. No incluye gráficas ni analítica avanzada.</p></div><button class="button" type="button" data-open-scan>Simular escáner QR</button></header>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha y hora</th><th>Clase</th><th>Maestro</th><th>Asistencia</th><th>Estado</th></tr></thead><tbody>${sessions.map((row, index) => `<tr>${row.map((cell, cellIndex) => `<td>${cellIndex === 4 ? `<span class="status-pill ${index ? 'is-paid' : 'is-due'}">${escapeHtml(cell)}</span>` : escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
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
          <label class="field"><span>Mes aplicado</span><select name="month"><option>${monthLabel(TODAY)}</option><option>${monthLabel(nextMonthDate())}</option></select></label>
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
  const item = findClass(classId);
  if (!item) return;
  openModal({
    title: item.name,
    eyebrow: `${item.day} · ${item.dateLabel} · ${item.time}`,
    body: `
      <div class="surface-card" style="padding:20px;margin-bottom:16px"><p class="eyebrow">Detalle de clase</p><h3>${item.level}</h3><p class="payment-meta">${item.teacher} · ${item.room}<br/>${capacityText(item)} alumnos inscritos</p></div>
      <p class="modal-note">La agenda es demostrativa. La reserva y los cupos no están conectados a un backend.</p>
      <div class="form-actions"><button class="button button--red" type="button" id="confirmClass">Confirmar asistencia</button></div>
    `
  });
}

function openStudentPayment() {
  const payment = state.payments.find((item) => item.studentId === 'IM-0241' && item.month === monthLabel(TODAY));
  const paid = payment?.status === 'Pagado';
  openModal({
    title: paid ? 'Comprobante interno' : 'Mensualidad pendiente',
    eyebrow: monthLabel(TODAY),
    body: `
      <article class="surface-card"><p class="eyebrow">${paid ? 'Pago registrado' : 'Saldo por registrar'}</p><p class="payment-amount">Q ${payment?.amount || 450}</p><p class="payment-meta">${paid ? `${payment.method} · ${payment.date}` : `Fecha límite · ${shortDate(addDays(TODAY, 2))}`}</p></article>
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

function simulateScan() {
  const target = findClass(activeClassId) || nextClass();
  const list = new Set(state.attendance[target.id] || []);
  list.add('IM-0241');
  state.attendance[target.id] = [...list];
  state.studentCheckIn = true;
  saveState();
  closeModal();
  showToast('Asistencia registrada', `Valeria Ruiz · ${target.name} · ${target.time}`);
  renderApp();
}

function openResetModal() {
  openModal({
    title: 'Reiniciar demostración',
    eyebrow: 'Datos locales',
    body: `
      <p class="modal-note">Se borran los alumnos, pagos y asistencias creados en este navegador y la demo vuelve a su estado inicial. No afecta ningún dato real.</p>
      <div class="form-actions"><button class="button button--light" type="button" data-close-modal>Cancelar</button><button class="button button--red" type="button" id="confirmReset">Sí, reiniciar</button></div>
    `
  });
}

function resetDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // el navegador puede tener el almacenamiento bloqueado
  }
  state = structuredClone(defaultState);
  state.role = activeRole;
  activeClassId = classData[0].id;
  activeRoute = 'inicio';
  saveState();
  closeModal();
  showToast('Demo reiniciada', 'Los datos volvieron a su estado inicial.');
  renderApp();
}

function handleModalClick(event) {
  if (event.target.closest('[data-close-modal]')) return closeModal();
  if (event.target.closest('#simulateScan')) return simulateScan();
  if (event.target.closest('#confirmReset')) return resetDemo();
  if (event.target.closest('#confirmClass')) {
    closeModal();
    showToast('Clase confirmada', 'Tu cupo se marcó en esta demostración.');
  }
}

function handleModalSubmit(event) {
  if (event.target.id === 'paymentForm') handlePaymentSubmit(event);
  if (event.target.id === 'studentForm') handleStudentSubmit(event);
}

function handlePaymentSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const student = state.students.find((item) => item.id === data.get('studentId'));
  if (!student) return;
  const existing = state.payments.find((item) => item.studentId === student.id && item.month === data.get('month'));
  const record = {
    id: existing?.id || nextPaymentId(),
    studentId: student.id,
    student: student.name,
    month: String(data.get('month')),
    amount: Number(data.get('amount')),
    method: String(data.get('method')),
    date: shortDate(TODAY),
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
  const data = new FormData(event.target);
  const name = String(data.get('name')).trim();
  if (!name) return;
  state.students = [{
    id: nextStudentId(),
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
      return { classes: scheduledClasses().map(({ id, day, dateLabel, time, name, teacher, room }) => ({ id, day, date: dateLabel, time, name, teacher, room })) };
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
      const existing = state.payments.find((item) => item.studentId === student.id && item.month === monthLabel(TODAY));
      const record = {
        id: existing?.id || nextPaymentId(),
        studentId: student.id,
        student: student.name,
        month: monthLabel(TODAY),
        amount: input.amount,
        method: input.method,
        date: shortDate(TODAY),
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
  const form = event.target;
  const classId = form.dataset.classId;
  state.attendance[classId] = [...form.querySelectorAll('input[name="attendance"]:checked')].map((input) => input.value);
  saveState();
  showToast('Asistencia guardada', `${state.attendance[classId].length} alumnos marcados como presentes.`);
  renderApp();
}

function openClassAttendance(classId) {
  if (findClass(classId)) activeClassId = classId;
  activeRole = 'teacher';
  activeRoute = 'asistencia';
  history.pushState(null, '', '#/asistencia');
  renderApp();
}

function applyClassFilter(button) {
  elements.content.querySelectorAll('[data-class-filter]').forEach((chip) => chip.classList.toggle('is-active', chip === button));
  const filter = button.dataset.classFilter;
  const classes = scheduledClasses();
  const filtered = filter === 'today' ? classes.filter((item) => item.day === 'Hoy')
    : filter === 'initial' ? classes.filter((item) => item.level.toLowerCase().includes('inicial'))
    : filter === 'advanced' ? classes.filter((item) => item.level.toLowerCase().includes('avanzado'))
    : classes;
  elements.content.querySelector('#studentSchedule').innerHTML = scheduleList(filtered);
}

function applyPaymentFilter(button) {
  elements.content.querySelectorAll('[data-payment-filter]').forEach((chip) => chip.classList.toggle('is-active', chip === button));
  const filter = button.dataset.paymentFilter;
  const filtered = filter === 'all' ? state.payments : state.payments.filter((item) => item.status === filter);
  elements.content.querySelector('#paymentTableBody').innerHTML = adminPaymentRows(filtered);
}

// Un solo manejador delegado para toda la página: el contenido se redibuja en cada
// render y enganchar listeners elemento por elemento los iba duplicando.
function handleContentClick(event) {
  const find = (selector) => event.target.closest(selector);

  const go = find('[data-go]');
  if (go) return routeTo(go.dataset.go);
  if (find('[data-open-scan]')) return openScanModal();
  if (find('[data-open-payment]')) return openPaymentModal();
  if (find('[data-open-student]')) return openNewStudentModal();
  if (find('[data-student-payment]')) return openStudentPayment();

  const attendance = find('[data-take-attendance]');
  if (attendance) return openClassAttendance(attendance.dataset.takeAttendance);
  const detail = find('[data-class-detail]');
  if (detail) return openClassDetail(detail.dataset.classDetail);
  const register = find('[data-register-for]');
  if (register) return openPaymentModal(register.dataset.registerFor);
  const receipt = find('[data-receipt]');
  if (receipt) return openReceipt(receipt.dataset.receipt);
  const studentDetail = find('[data-student-detail]');
  if (studentDetail) return openStudentDetail(studentDetail.dataset.studentDetail);

  const classFilter = find('[data-class-filter]');
  if (classFilter) return applyClassFilter(classFilter);
  const paymentFilter = find('[data-payment-filter]');
  if (paymentFilter) return applyPaymentFilter(paymentFilter);
}

function handleContentInput(event) {
  if (!event.target.closest('#studentSearch')) return;
  const query = event.target.value.trim().toLowerCase();
  const filtered = state.students.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(query));
  elements.content.querySelector('#studentTableBody').innerHTML = studentRows(filtered);
}

function handleContentSubmit(event) {
  if (event.target.id === 'attendanceForm') handleAttendanceSubmit(event);
}

document.querySelectorAll('[data-enter-role]').forEach((button) => button.addEventListener('click', () => enterDemo(button.dataset.enterRole)));
document.querySelector('#exitDemo').addEventListener('click', leaveDemo);
document.querySelector('#resetDemo')?.addEventListener('click', openResetModal);
elements.content.addEventListener('click', handleContentClick);
elements.content.addEventListener('input', handleContentInput);
elements.content.addEventListener('submit', handleContentSubmit);
elements.modalLayer.addEventListener('click', handleModalClick);
elements.modalLayer.addEventListener('submit', handleModalSubmit);
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
  }, 2450);
}

registerWebMcpTools();
