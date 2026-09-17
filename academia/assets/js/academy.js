const STORAGE_KEY = 'inmotion-academy-demo-v1';
const STATE_VERSION = 3;
let TODAY = new Date();
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
  },
  guardian: {
    label: 'Portal de tutor',
    initials: 'CR',
    routes: [
      ['inicio', 'Inicio', 'home'],
      ['carnet', 'Carnés', 'card']
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
  return upcomingClasses(scheduledClasses())[0];
}

function upcomingClasses(classes) {
  return classes.map((item) => {
    const startsAt = new Date(item.date);
    startsAt.setMinutes(timeValue(item.time));
    const date = startsAt <= TODAY ? addDays(item.date, 7) : item.date;
    return { ...item, date, day: dayLabel(date), dateLabel: shortDate(date) };
  }).sort((a, b) => (a.date - b.date) || (timeValue(a.time) - timeValue(b.time)));
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

// Clave local YYYY-MM-DD: toISOString daria el dia en UTC y en Guatemala (UTC-6)
// una clase de la noche quedaria registrada al dia siguiente.
function dayKey(date) {
  const day = startOfDay(date);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

function parseDayKey(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function previousDateFor(weekday) {
  return addDays(nextDateFor(weekday), -7);
}

function pastDayLabel(date) {
  const diff = daysBetween(date);
  if (diff === 0) return 'Hoy';
  if (diff === -1) return 'Ayer';
  return `${WEEKDAY_SHORT[date.getDay()]} ${shortDate(date)}`;
}

function membershipValidity() {
  const last = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0);
  const month = new Intl.DateTimeFormat('es-GT', { month: 'short' }).format(last).replace('.', '');
  return `${last.getDate()} · ${month.toUpperCase()} · ${last.getFullYear()}`;
}

function studentById(studentId) {
  return state.students.find((item) => item.id === studentId);
}

function classesForStudent(studentId) {
  const ids = studentById(studentId)?.classIds || [];
  return scheduledClasses().filter((item) => ids.includes(item.id));
}

function nextClassForStudent(studentId) {
  return upcomingClasses(classesForStudent(studentId))[0] || null;
}

function lastAttendanceFor(studentId) {
  const entries = state.attendanceLog
    .filter((entry) => entry.studentId === studentId)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const last = entries[0];
  if (!last) return null;
  const date = parseDayKey(last.at);
  return {
    label: pastDayLabel(date),
    className: classData.find((item) => item.id === last.classId)?.name || 'Clase'
  };
}

function monthlyPaymentFor(studentId) {
  return state.payments.find((item) => item.studentId === studentId && item.period === monthKey(TODAY));
}

function monthKey(date) {
  return dayKey(date).slice(0, 7);
}

function paymentStatus(payment) {
  if (!payment) return 'Sin registro';
  if (payment.status === 'Pagado') return 'Pagado';
  return payment.dueDate && payment.dueDate < dayKey(TODAY) ? 'En mora' : 'Pendiente';
}

function paymentDateText(payment) {
  if (!payment) return 'Sin registro para este mes.';
  if (payment.status === 'Pagado') return payment.paidAt ? shortDate(parseDayKey(payment.paidAt)) : payment.date;
  if (!payment.dueDate) return 'Sin fecha de vencimiento';
  return `${paymentStatus(payment) === 'En mora' ? 'Venció' : 'Vence'} ${shortDate(parseDayKey(payment.dueDate))}`;
}

function studentPaymentStatus(studentId) {
  const due = state.payments.filter((item) => item.studentId === studentId && item.period <= monthKey(TODAY) && item.status !== 'Pagado');
  if (due.some((item) => paymentStatus(item) === 'En mora')) return 'En mora';
  if (due.length) return 'Pendiente';
  return monthlyPaymentFor(studentId)?.status === 'Pagado' ? 'Al día' : 'Sin registro';
}

function planAmount(studentId) {
  return ({ 'Plan 4 clases': 300, 'Plan 8 clases': 450, 'Plan ilimitado': 625 })[studentById(studentId)?.plan] || 450;
}

function currentGuardian() {
  return guardians[0];
}

function childrenOf(guardian) {
  return (guardian?.childrenIds || []).map(studentById).filter(Boolean);
}

function attendanceFor(classId, date = TODAY) {
  return state.attendanceLog.filter((entry) => entry.classId === classId && entry.at === dayKey(date)).map((entry) => entry.studentId);
}

// Una unica bitacora identifica cada sesion por clase y fecha local.
function recordAttendance(classId, studentIds, sessionDate, { replaceDay = false } = {}) {
  TODAY = new Date();
  const item = classData.find((entry) => entry.id === classId);
  if (!item || sessionDate !== dayKey(TODAY) || item.weekday !== TODAY.getDay()) {
    throw new Error('Solo podés registrar una clase programada para hoy. Volvé a abrir la sesión.');
  }
  if (studentIds.some((studentId) => !studentById(studentId))) throw new Error('Alumno no encontrado.');
  const sameSession = (entry) => entry.classId === classId && entry.at === sessionDate;
  const nextState = structuredClone(state);
  if (replaceDay) nextState.attendanceLog = nextState.attendanceLog.filter((entry) => !sameSession(entry));
  studentIds.forEach((studentId) => {
    if (nextState.attendanceLog.some((entry) => sameSession(entry) && entry.studentId === studentId)) return;
    nextState.attendanceLog.push({ studentId, classId, at: sessionDate });
  });
  persistState(nextState);
}

const GUARDIAN_ID = 'TU-0031';

// classIds es la inscripcion real del alumno: sin ella no se puede saber cual es
// la proxima clase de un hijo, solo la proxima clase de la academia.
const baseStudents = [
  { id: 'IM-0241', name: 'Valeria Ruiz', initials: 'VR', plan: 'Plan 8 clases', phone: '5555-0142', status: 'Pendiente', level: 'Nivel intermedio', classIds: ['bachata-inter', 'kpop-teens'], guardianId: GUARDIAN_ID },
  { id: 'IM-0262', name: 'Diego Ruiz', initials: 'DR', plan: 'Plan 4 clases', phone: '5555-0177', status: 'Al día', level: '7 a 11 años', classIds: ['latino-kids'], guardianId: GUARDIAN_ID },
  { id: 'IM-0218', name: 'Luis Méndez', initials: 'LM', plan: 'Plan ilimitado', phone: '5555-0188', status: 'Al día', level: 'Nivel avanzado', classIds: ['salsa-on2', 'bachata-inter'] },
  { id: 'IM-0194', name: 'Andrea Pérez', initials: 'AP', plan: 'Plan 8 clases', phone: '5555-0120', status: 'Al día', level: 'Nivel intermedio', classIds: ['bachata-inter', 'latino'] },
  { id: 'IM-0250', name: 'Santiago Cruz', initials: 'SC', plan: 'Plan 4 clases', phone: '5555-0176', status: 'Pendiente', level: 'Nivel inicial', classIds: ['salsa-basico'] },
  { id: 'IM-0207', name: 'Camila Soto', initials: 'CS', plan: 'Plan ilimitado', phone: '5555-0159', status: 'Al día', level: 'Nivel intermedio', classIds: ['bachata-inter', 'latino', 'salsa-on2'] },
  { id: 'IM-0229', name: 'María Fernanda León', initials: 'ML', plan: 'Plan 8 clases', phone: '5555-0134', status: 'Al día', level: 'Nivel inicial', classIds: ['salsa-basico', 'latino'] }
];

// Los tutores no se editan desde la app: solo se consultan.
const guardians = [
  { id: GUARDIAN_ID, name: 'Carmen Ruiz', initials: 'CR', phone: '5555-0177', childrenIds: ['IM-0241', 'IM-0262'], consentSignedAt: dayKey(addDays(TODAY, -35)) }
];

const basePayments = [
  { id: 'P-1044', studentId: 'IM-0241', student: 'Valeria Ruiz', month: monthLabel(TODAY), amount: 450, method: 'Pendiente', date: `Vence ${shortDate(addDays(TODAY, 2))}`, status: 'Pendiente' },
  { id: 'P-1043', studentId: 'IM-0218', student: 'Luis Méndez', month: monthLabel(TODAY), amount: 625, method: 'POS', date: shortDate(addDays(TODAY, -1)), status: 'Pagado' },
  { id: 'P-1042', studentId: 'IM-0194', student: 'Andrea Pérez', month: monthLabel(TODAY), amount: 450, method: 'Transferencia', date: shortDate(addDays(TODAY, -3)), status: 'Pagado' },
  { id: 'P-1041', studentId: 'IM-0250', student: 'Santiago Cruz', month: monthLabel(TODAY), amount: 300, method: 'Pendiente', date: `Venció ${shortDate(addDays(TODAY, -6))}`, status: 'En mora' },
  { id: 'P-1040', studentId: 'IM-0207', student: 'Camila Soto', month: monthLabel(TODAY), amount: 625, method: 'Efectivo', date: shortDate(addDays(TODAY, -8)), status: 'Pagado' },
  { id: 'P-1039', studentId: 'IM-0262', student: 'Diego Ruiz', month: monthLabel(TODAY), amount: 300, method: 'Efectivo', date: shortDate(addDays(TODAY, -9)), status: 'Pagado' }
].map((payment, index) => ({
  ...payment,
  period: monthKey(TODAY),
  dueDate: payment.status === 'Pagado' ? null : dayKey(addDays(TODAY, index === 0 ? 2 : -6)),
  paidAt: payment.status === 'Pagado' ? dayKey(addDays(TODAY, [0, -1, -3, 0, -8, -9][index])) : null
}));

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
  // La bitacora es la fuente de la lista diaria y de la consulta de cada alumno.
  attendanceLog: [
    { studentId: 'IM-0241', classId: 'bachata-inter', at: dayKey(previousDateFor(3)) },
    { studentId: 'IM-0218', classId: 'bachata-inter', at: dayKey(previousDateFor(3)) },
    { studentId: 'IM-0194', classId: 'bachata-inter', at: dayKey(previousDateFor(3)) },
    { studentId: 'IM-0241', classId: 'kpop-teens', at: dayKey(previousDateFor(4)) },
    { studentId: 'IM-0262', classId: 'latino-kids', at: dayKey(previousDateFor(6)) }
  ]
};

// La version 2 guardaba fechas como texto. Conservamos sus registros al migrar;
// las marcas sin fecha no se trasladan a una sesion inventada.
function migratePayment(payment) {
  if (payment.period) return payment;
  const year = Number(String(payment.month).match(/\d{4}/)?.[0]);
  const month = Array.from({ length: 12 }, (_, index) => monthName(new Date(year, index, 1)))
    .findIndex((name) => String(payment.month).toLowerCase().startsWith(name));
  if (!year || month < 0) throw new Error('Período de pago inválido.');
  const periodDate = new Date(year, month, 1);
  const match = String(payment.date).match(/(\d{1,2})\s+([a-záéíóú]+)/i);
  let storedDate = null;
  if (match) {
    const dateMonth = Array.from({ length: 12 }, (_, index) => shortDate(new Date(year, index, 1)).split(' ').pop())
      .findIndex((name) => name === match[2].toLowerCase());
    if (dateMonth >= 0) {
      // Enero/diciembre: elegimos el año mas cercano al período aplicado.
      const dateYear = year + (dateMonth - month > 6 ? -1 : month - dateMonth > 6 ? 1 : 0);
      storedDate = dayKey(new Date(dateYear, dateMonth, Number(match[1])));
    }
  }
  return { ...payment, period: monthKey(periodDate), dueDate: payment.status === 'Pagado' ? null : storedDate, paidAt: payment.status === 'Pagado' ? storedDate : null };
}

// ---------------------------------------------------------------------------
// Validacion del estado guardado. Un registro ilegible se descarta solo: no
// tumba el arranque ni se lleva consigo los registros que si son validos.
// Lo descartado se cuenta y se le avisa al usuario al abrir.
// ---------------------------------------------------------------------------

const DAY_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAYMENT_METHODS = ['POS', 'Transferencia', 'Efectivo', 'Depósito'];
let recoveryReport = null;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidDayKey(value) {
  if (typeof value !== 'string' || !DAY_KEY_PATTERN.test(value)) return false;
  // Rechaza 2026-02-30: la fecha reconstruida tiene que coincidir con el texto.
  return dayKey(parseDayKey(value)) === value;
}

function cleanText(value, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function sanitizeStudent(raw) {
  if (!isPlainObject(raw)) return null;
  const id = cleanText(raw.id, 24);
  const name = cleanText(raw.name, 80);
  if (!/^IM-\d{3,6}$/.test(id) || !name) return null;
  const knownClassIds = classData.map((item) => item.id);
  const plan = ['Plan 4 clases', 'Plan 8 clases', 'Plan ilimitado'].includes(raw.plan) ? raw.plan : 'Plan 8 clases';
  return {
    id,
    name,
    initials: cleanText(raw.initials, 4) || initials(name),
    plan,
    phone: cleanText(raw.phone, 24) || 'Sin registrar',
    status: cleanText(raw.status, 20) || 'Pendiente',
    level: cleanText(raw.level, 40) || 'Sin nivel',
    classIds: Array.isArray(raw.classIds) ? [...new Set(raw.classIds.filter((value) => knownClassIds.includes(value)))] : [],
    guardianId: guardians.some((item) => item.id === raw.guardianId) ? raw.guardianId : undefined,
    notes: cleanText(raw.notes, 280)
  };
}

function sanitizePayment(raw, studentIds) {
  if (!isPlainObject(raw)) return null;
  let payment;
  try {
    payment = migratePayment(raw);
  } catch {
    return null;
  }
  const studentId = cleanText(payment.studentId, 24);
  const amount = Number(payment.amount);
  if (!studentIds.has(studentId)) return null;
  if (!PERIOD_PATTERN.test(String(payment.period))) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const isPaid = payment.status === 'Pagado';
  const paidAt = isValidDayKey(payment.paidAt) ? payment.paidAt : null;
  // Un pago liquidado sin fecha utilizable no puede quedar como pagado a ciegas.
  if (isPaid && !paidAt) return null;
  return {
    id: cleanText(payment.id, 24) || `P-${Math.round(amount)}-${payment.period}`,
    studentId,
    student: cleanText(payment.student, 80) || studentId,
    month: cleanText(payment.month, 40) || monthLabel(parseDayKey(`${payment.period}-01`)),
    period: payment.period,
    amount,
    method: PAYMENT_METHODS.includes(payment.method) ? payment.method : (isPaid ? 'Efectivo' : 'Pendiente'),
    date: cleanText(payment.date, 40),
    paidAt: isPaid ? paidAt : null,
    dueDate: isPaid ? null : (isValidDayKey(payment.dueDate) ? payment.dueDate : null),
    status: isPaid ? 'Pagado' : 'Pendiente',
    reference: cleanText(payment.reference, 60)
  };
}

function sanitizeAttendance(raw, studentIds) {
  if (!isPlainObject(raw)) return null;
  const studentId = cleanText(raw.studentId, 24);
  const classId = cleanText(raw.classId, 40);
  const at = cleanText(raw.at, 10);
  if (!studentIds.has(studentId)) return null;
  const item = classData.find((entry) => entry.id === classId);
  if (!item || !isValidDayKey(at)) return null;
  const date = parseDayKey(at);
  // Ni sesiones futuras ni sesiones en un dia en que esa clase no se dicta.
  if (daysBetween(date) > 0 || date.getDay() !== item.weekday) return null;
  return { studentId, classId, at };
}

function sanitizeState(saved) {
  const dropped = { students: 0, payments: 0, attendance: 0 };

  const rawStudents = Array.isArray(saved.students) ? saved.students : [];
  const students = [];
  const seenStudents = new Set();
  rawStudents.forEach((raw) => {
    const student = sanitizeStudent(raw);
    if (!student || seenStudents.has(student.id)) {
      dropped.students += 1;
      return;
    }
    seenStudents.add(student.id);
    students.push(student);
  });
  // Sin alumnos la app no tiene nada que mostrar: se vuelve al padron base.
  const usableStudents = students.length ? students : structuredClone(baseStudents);
  if (!students.length && rawStudents.length) dropped.students = rawStudents.length;
  const studentIds = new Set(usableStudents.map((item) => item.id));

  const rawPayments = Array.isArray(saved.payments) ? saved.payments : [];
  const payments = [];
  const seenPeriods = new Set();
  rawPayments.forEach((raw) => {
    const payment = sanitizePayment(raw, studentIds);
    const fingerprint = payment && `${payment.studentId}|${payment.period}`;
    if (!payment || seenPeriods.has(fingerprint)) {
      dropped.payments += 1;
      return;
    }
    seenPeriods.add(fingerprint);
    payments.push(payment);
  });

  const rawLog = Array.isArray(saved.attendanceLog) ? saved.attendanceLog : [];
  const attendanceLog = [];
  const seenSessions = new Set();
  rawLog.forEach((raw) => {
    const entry = sanitizeAttendance(raw, studentIds);
    const fingerprint = entry && `${entry.studentId}|${entry.classId}|${entry.at}`;
    if (!entry || seenSessions.has(fingerprint)) {
      dropped.attendance += 1;
      return;
    }
    seenSessions.add(fingerprint);
    attendanceLog.push(entry);
  });

  const total = dropped.students + dropped.payments + dropped.attendance;
  if (total) recoveryReport = { total, ...dropped };

  return {
    // Un rol desconocido no rompe el arranque: se cae a la pantalla de acceso.
    role: Object.keys(roleConfig).includes(saved.role) ? saved.role : null,
    students: usableStudents,
    payments,
    attendanceLog
  };
}

function loadState() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Almacenamiento bloqueado o JSON corrupto: arrancamos con la demo limpia.
    return structuredClone(defaultState);
  }
  if (!isPlainObject(saved) || ![2, STATE_VERSION].includes(saved.version)) return structuredClone(defaultState);
  try {
    return sanitizeState(saved);
  } catch {
    recoveryReport = { total: 0, students: 0, payments: 0, attendance: 0, fatal: true };
    return structuredClone(defaultState);
  }
}

let state = loadState();
let activeRole = state.role || 'student';
let activeRoute = 'inicio';
let activeClassId = classData[0].id;
let lastFocusedElement = null;
let activeChildId = null;

const MOBILE_QUERY = window.matchMedia('(max-width: 780px)');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const elements = {
  access: document.querySelector('#accessView'),
  app: document.querySelector('#appShell'),
  sidebar: document.querySelector('.sidebar'),
  modal: document.querySelector('#modalLayer .modal'),
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

function persistState(nextState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...nextState, version: STATE_VERSION }));
  } catch {
    throw new Error('No se pudo guardar en este navegador. Revisá el almacenamiento e intentá de nuevo.');
  }
  state = nextState;
}

// Los flujos que solo cambian preferencias persisten primero. Si el navegador no
// puede guardar, el cambio se aplica en memoria y se avisa: nunca se anuncia exito.
function persistOrWarn(nextState) {
  try {
    persistState(nextState);
    return true;
  } catch (error) {
    state = nextState;
    showToast('No se pudo guardar', error.message);
    return false;
  }
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
    <a class="nav-item ${activeRoute === route ? 'is-active' : ''}" href="#/${escapeHtml(route)}" data-route="${escapeHtml(route)}">
      <span class="nav-icon">${icon(iconName)}</span>
      <span>${escapeHtml(label)}</span>
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
  if (!roleConfig[role]) return;
  activeRole = role;
  activeRoute = 'inicio';
  persistOrWarn({ ...state, role });
  elements.access.classList.add('is-hidden');
  elements.app.classList.remove('is-hidden');
  history.replaceState(null, '', '#/inicio');
  renderApp();
}

function leaveDemo() {
  persistOrWarn({ ...state, role: null });
  elements.app.classList.add('is-hidden');
  elements.access.classList.remove('is-hidden');
  elements.app.classList.remove('menu-open');
  history.replaceState(null, '', window.location.pathname);
  document.querySelector('[data-enter-role="student"]')?.focus();
}

// El menu lateral queda fuera de pantalla en movil: mientras este cerrado no debe
// recibir foco ni anunciarse, o el tabulador se va a enlaces invisibles.
function syncMenuState() {
  const open = elements.app.classList.contains('menu-open');
  elements.menuButton.setAttribute('aria-expanded', String(open));
  if (!elements.sidebar) return;
  const collapsed = MOBILE_QUERY.matches && !open;
  elements.sidebar.inert = collapsed;
  if (collapsed) elements.sidebar.setAttribute('aria-hidden', 'true');
  else elements.sidebar.removeAttribute('aria-hidden');
}

function setMenuOpen(open, { moveFocus = false } = {}) {
  elements.app.classList.toggle('menu-open', open);
  syncMenuState();
  if (open && moveFocus) elements.sidebar?.querySelector(FOCUSABLE_SELECTOR)?.focus();
}

function renderApp() {
  TODAY = new Date();
  updateShell();
  const key = `${activeRole}:${activeRoute}`;
  const renderer = renderers[key] || renderers[`${activeRole}:inicio`];
  elements.content.innerHTML = `<div class="page-enter">${renderer()}</div>`;
  setMenuOpen(false);
  window.scrollTo({ top: 0, behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
}

function routeTo(route) {
  activeRoute = route;
  history.pushState(null, '', `#/${route}`);
  renderApp();
  elements.content.focus({ preventScroll: true });
}

function weekStrip(classes = classData) {
  const monday = addDays(TODAY, -((startOfDay(TODAY).getDay() + 6) % 7));
  const perWeekday = classes.reduce((acc, item) => {
    acc[item.weekday] = (acc[item.weekday] || 0) + 1;
    return acc;
  }, {});
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  return `<div class="week-strip">${days.map((date) => {
    const total = perWeekday[date.getDay()] || 0;
    const note = total ? `${total} clase${total === 1 ? '' : 's'}` : '';
    return `<div class="day-pill ${daysBetween(date) === 0 ? 'is-today' : ''}">
      <span>${escapeHtml(WEEKDAY_SHORT[date.getDay()])}</span><strong>${escapeHtml(date.getDate())}</strong><small>${escapeHtml(note)}</small>
    </div>`;
  }).join('')}</div>`;
}

function classCards(classes = scheduledClasses().slice(0, 3)) {
  return `<div class="cards-grid">${classes.map((item, index) => `
    <article class="class-card ${index === 0 ? 'is-featured' : ''}">
      <span class="class-card-index">0${index + 1}</span>
      <div class="class-card-top">
        <span class="tag ${index === 0 ? 'tag--dark' : ''}">${escapeHtml(item.day)} · ${escapeHtml(item.time)}</span>
        ${index === 0 ? '<span class="status-dot">Inscripta</span>' : ''}
      </div>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.teacher)}</p>
      <div class="class-card-foot"><span>${escapeHtml(item.level)}</span><span>${escapeHtml(item.room)}</span></div>
    </article>
  `).join('')}</div>`;
}

function scheduleList(classes = scheduledClasses()) {
  return `<div class="schedule-list">${classes.map((item) => `
    <div class="schedule-row">
      <div class="schedule-time">${escapeHtml(item.time)}<small>${escapeHtml(item.day)} · ${escapeHtml(item.dateLabel)}</small></div>
      <div class="schedule-name"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.level)} · ${escapeHtml(item.room)}</small></div>
      <div class="schedule-teacher">${escapeHtml(item.teacher)}<small>Maestro</small></div>
      <span class="capacity">${escapeHtml(capacityText(item))} inscritos</span>
      <button class="button button--light button--small" type="button" data-class-detail="${escapeHtml(item.id)}">Ver clase</button>
    </div>
  `).join('')}</div>`;
}

function renderStudentHome() {
  const planTotal = 8;
  const attendance = state.attendanceLog.filter((entry) => entry.studentId === 'IM-0241');
  const attended = attendance.filter((entry) => entry.at.startsWith(monthKey(TODAY))).length;
  const checkedIn = attendance.some((entry) => entry.at === dayKey(TODAY));
  const remaining = Math.max(0, planTotal - attended);
  const payment = monthlyPaymentFor('IM-0241');
  const paid = payment?.status === 'Pagado';
  const own = upcomingClasses(classesForStudent('IM-0241'));
  const next = own[0];
  const [hour, meridiem] = next?.time.split(' ') || [];
  return `
    <section class="student-hero">
      <div class="student-hero-copy">
        <div>
          <p class="eyebrow">${escapeHtml(shortDayLabel(TODAY))}</p>
          <h1 class="hero-title">Hola, Valeria.<br/><span>¿Bailamos?</span></h1>
        </div>
        <div class="hero-foot">
          <button class="button button--red" type="button" data-open-scan>Marcar asistencia <span aria-hidden="true">↗</span></button>
          <p>${checkedIn ? 'Tu asistencia de hoy ya quedó registrada en esta demo.' : 'Mostrá tu carnet QR en recepción al llegar a la academia.'}</p>
        </div>
      </div>
      <aside class="next-class">
        <div class="next-class-label"><span>Próxima clase</span><span>01</span></div>
        ${next ? `<time><strong>${escapeHtml(hour)}</strong><span>${escapeHtml(meridiem)} · ${escapeHtml(next.day)}</span></time>
        <div><h2>${escapeHtml(next.name)}</h2><p>${escapeHtml(next.teacher)} · ${escapeHtml(next.room)}</p></div>` : '<p>Sin clases asignadas.</p>'}
      </aside>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Esta semana</h2><p>Tu agenda de clases del ${escapeHtml(weekRange())}.</p></div><button class="text-button" type="button" data-go="clases">Ver calendario →</button></div>
      ${weekStrip(classesForStudent('IM-0241'))}
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Tus próximas clases</h2><p>Plan ${planTotal} clases · ${remaining} disponibles este mes</p></div></div>
      ${classCards(own)}
    </section>

    <section class="section split-grid">
      <article class="surface-card">
        <p class="eyebrow">Mensualidad · ${escapeHtml(monthName(TODAY))}</p>
        <div class="payment-status">
          <div><p class="payment-amount">Q ${escapeHtml(payment?.amount ?? '—')}</p><p class="payment-meta">${escapeHtml(paymentStatus(payment))} · ${escapeHtml(paymentDateText(payment))}</p></div>
          <button class="button ${paid ? 'button--light' : ''}" type="button" data-student-payment>${paid ? 'Ver comprobante' : 'Ver detalle'}</button>
        </div>
      </article>
      <article class="surface-card">
        <p class="eyebrow">Asistencia del mes</p>
        <h2>${attended} de ${planTotal} clases</h2>
        <p class="payment-meta">${remaining} clases disponibles este mes.</p>
      </article>
    </section>
  `;
}

function renderStudentClasses() {
  return `
    <header class="page-heading">
      <div><p class="eyebrow">Calendario de clases</p><h1>Elegí tu próximo<br/>movimiento.</h1><p>Consultá horarios y cupos de demostración. Las reservas no están habilitadas en este prototipo.</p></div>
      <button class="button" type="button" data-go="carnet">Mostrar mi QR</button>
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

// Patron de 21x21 derivado del carne. No es un QR legible -el rotulo lo dice-,
// pero dos alumnos distintos no muestran el mismo codigo en pantalla.
function qrPattern(seed) {
  let hash = 2166136261 >>> 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const next = () => {
    hash ^= (hash << 13) >>> 0;
    hash >>>= 0;
    hash ^= hash >>> 17;
    hash ^= (hash << 5) >>> 0;
    hash >>>= 0;
    return hash / 4294967296;
  };
  const size = 21;
  const grid = Array.from({ length: size }, () => new Array(size).fill(0));
  const reserved = (x, y) => (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12) || x === 6 || y === 6;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!reserved(x, y)) grid[y][x] = next() < 0.45 ? 1 : 0;
    }
  }
  [[0, 0], [14, 0], [0, 14]].forEach(([ox, oy]) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[oy + y][ox + x] = edge || core ? 1 : 0;
      }
    }
  });
  for (let i = 8; i < 13; i += 1) {
    grid[6][i] = i % 2 === 0 ? 1 : 0;
    grid[i][6] = i % 2 === 0 ? 1 : 0;
  }
  return grid;
}

function qrMarkup(seed = 'IM-0241') {
  return `<svg viewBox="0 0 21 21" aria-label="Código QR de demostración ${escapeHtml(seed)}" role="img" shape-rendering="crispEdges">
    <rect width="21" height="21" fill="#fff"/>
    ${qrPattern(seed).flatMap((row, y) => row.map((cell, x) => cell ? `<rect x="${x}" y="${y}" width="1" height="1" fill="#0b0b0c"/>` : '')).join('')}
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
        <div class="member-validity"><span>Vigencia</span><strong>${membershipValidity()}</strong></div>
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
      <div class="teacher-class-time">${escapeHtml(item.time).replace(' ', '<br/>')}</div>
      <div><span class="tag ${index === 0 ? 'tag--red' : ''}">${escapeHtml(item.day)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.room)} · ${escapeHtml(capacityText(item))} inscritos</p></div>
      <button class="button button--small ${index === 0 ? 'button--red' : 'button--light'}" type="button" data-take-attendance="${escapeHtml(item.id)}">${index === 0 ? 'Pasar asistencia' : 'Abrir clase'}</button>
    </article>
  `).join('')}</div>`;
}

function renderTeacherHome() {
  const own = teacherClasses();
  const today = own.filter((item) => item.day === 'Hoy');
  const next = upcomingClasses(own)[0];
  const count = today.length;
  return `
    <section class="teacher-hero">
      <p class="eyebrow">${escapeHtml(shortDayLabel(TODAY))} · ${count ? `${count} clase${count === 1 ? '' : 's'} programada${count === 1 ? '' : 's'}` : 'sin clases hoy'}</p>
      <h1>${escapeHtml(greeting())},<br/><span>Alex.</span></h1>
      <div class="teacher-hero-foot">
        ${next ? `<button class="button button--red" type="button" data-take-attendance="${escapeHtml((today[0] || next).id)}">${count ? 'Abrir asistencia de hoy' : 'Abrir próxima clase'}</button>` : ''}
        <p>${next ? `Tu siguiente clase es ${escapeHtml(next.day.toLowerCase())} a las ${escapeHtml(next.time)}<br/>en el ${escapeHtml(next.room)}.` : 'No tenés clases asignadas en esta demostración.'}</p>
      </div>
    </section>
    <section class="section"><div class="section-head"><div><h2>Tu agenda</h2><p>Próximas clases asignadas.</p></div><button class="text-button" type="button" data-go="agenda">Ver semana →</button></div>${teacherCards()}</section>
  `;
}

function renderTeacherAgenda() {
  return `
    <header class="page-heading"><div><p class="eyebrow">Agenda docente</p><h1>Una semana<br/>en movimiento.</h1><p>Clases asignadas a Alex Aquino en esta demostración.</p></div></header>
    ${weekStrip(teacherClasses())}
    <section class="section">${teacherCards()}</section>
  `;
}

function rosterMarkup(classId = activeClassId, date = TODAY) {
  const selected = attendanceFor(classId, date);
  return `<div class="attendance-roster">${roster.map((student) => `
    <label class="student-check">
      <input type="checkbox" name="attendance" value="${escapeHtml(student.id)}" ${selected.includes(student.id) ? 'checked' : ''} ${dayKey(date) !== dayKey(TODAY) ? 'disabled' : ''} />
      <span class="avatar">${escapeHtml(student.initials)}</span>
      <span><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.id)} · ${escapeHtml(student.plan)}</small></span>
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
        <div class="section-head"><div><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.day)} · ${escapeHtml(item.time)} · ${escapeHtml(item.room)}</p></div><span class="tag ${live ? 'tag--red' : ''}">${live ? 'Programada para hoy' : 'Programada'}</span></div>
        <form id="attendanceForm" data-class-id="${escapeHtml(item.id)}" data-session-date="${escapeHtml(dayKey(item.date))}">
          ${rosterMarkup(item.id, item.date)}
          ${!live ? '<p class="modal-note">La asistencia se habilita el día de esta clase.</p>' : ''}
          <div class="form-actions"><button class="button button--red" type="submit" ${!live ? 'disabled' : ''}>Guardar asistencia</button></div>
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
    <tr data-payment-row="${escapeHtml(item.id)}">
      <td><div class="person-cell"><span class="avatar">${escapeHtml(initials(item.student))}</span><span><strong>${escapeHtml(item.student)}</strong><small>${escapeHtml(item.studentId)}</small></span></div></td>
      <td>${escapeHtml(item.month)}</td>
      <td><strong>Q ${escapeHtml(item.amount)}</strong></td>
      <td>${escapeHtml(item.method)}</td>
      <td><span class="status-pill ${item.status === 'Pagado' ? 'is-paid' : 'is-due'}">${escapeHtml(paymentStatus(item))}</span></td>
      <td>${item.status === 'Pagado' ? `<button class="table-action" type="button" data-receipt="${escapeHtml(item.id)}">Comprobante</button>` : `<button class="table-action" type="button" data-register-for="${escapeHtml(item.studentId)}" data-payment-period="${escapeHtml(item.period)}">Registrar</button>`}</td>
    </tr>
  `).join('');
}

function studentRows(students = state.students) {
  if (!students.length) return '<tr><td colspan="5"><div class="empty-state"><strong>Sin coincidencias</strong>Revisá el nombre o número de carnet.</div></td></tr>';
  return students.map((student) => `
    <tr>
      <td><div class="person-cell"><span class="avatar">${escapeHtml(initials(student.name))}</span><span><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.id)}</small></span></div></td>
      <td>${escapeHtml(student.plan)}</td>
      <td>${escapeHtml(student.phone)}</td>
      <td><span class="status-pill ${studentPaymentStatus(student.id) === 'Al día' ? 'is-paid' : 'is-due'}">${escapeHtml(studentPaymentStatus(student.id))}</span></td>
      <td><button class="table-action" type="button" data-student-detail="${escapeHtml(student.id)}">Ver ficha</button></td>
    </tr>
  `).join('');
}

function renderAdminHome() {
  const due = pendingPayments();
  return `
    <section class="admin-intro">
      <div><p class="eyebrow">Administración · ${escapeHtml(shortDayLabel(TODAY))}</p><h1>La academia,<br/>en orden.</h1></div>
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
    <div class="section-head"><label class="search-box"><span>⌕</span><input id="studentSearch" type="search" placeholder="Buscar por nombre o carnet" autocomplete="off" /></label><span class="tag">${escapeHtml(state.students.length)} registros demo</span></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Alumno</th><th>Plan</th><th>Teléfono</th><th>Estado</th><th>Acción</th></tr></thead><tbody id="studentTableBody">${studentRows()}</tbody></table></div>
  `;
}

function renderAdminPayments() {
  const paid = state.payments.filter((item) => item.status === 'Pagado' && item.paidAt?.startsWith(monthKey(TODAY))).reduce((sum, item) => sum + item.amount, 0);
  const due = pendingPayments().reduce((sum, item) => sum + item.amount, 0);
  return `
    <header class="page-heading"><div><p class="eyebrow">Control de pagos</p><h1>Registrar.<br/>Conciliar. Listo.</h1><p>Solo registra cobros realizados fuera del sistema. No procesa tarjetas ni emite FEL.</p></div><button class="button button--red" type="button" data-open-payment>+ Registrar pago</button></header>
    <section class="split-grid" style="margin-bottom:28px">
      <article class="surface-card"><p class="eyebrow">Registrado en ${escapeHtml(monthName(TODAY))}</p><p class="payment-amount">Q ${escapeHtml(paid.toLocaleString('es-GT'))}</p><p class="payment-meta">Monto visible en esta demo local.</p></article>
      <article class="surface-card"><p class="eyebrow">Pendiente / mora</p><p class="payment-amount">Q ${escapeHtml(due.toLocaleString('es-GT'))}</p><p class="payment-meta">Requiere seguimiento administrativo.</p></article>
    </section>
    <div class="filter-row" id="paymentFilters"><button class="filter-chip is-active" type="button" data-payment-filter="all">Todos</button><button class="filter-chip" type="button" data-payment-filter="Pagado">Pagados</button><button class="filter-chip" type="button" data-payment-filter="Pendiente">Pendientes</button><button class="filter-chip" type="button" data-payment-filter="En mora">En mora</button></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Alumno</th><th>Mes</th><th>Monto</th><th>Método</th><th>Estado</th><th>Acción</th></tr></thead><tbody id="paymentTableBody">${adminPaymentRows()}</tbody></table></div>
  `;
}

function renderAdminAttendance() {
  const sessions = scheduledClasses().map((item) => {
    const marked = attendanceFor(item.id, item.date).length;
    const live = item.day === 'Hoy';
    return [
      `${item.day} · ${item.time}`,
      item.name,
      item.teacher,
      `${marked} marcado${marked === 1 ? '' : 's'} de ${item.enrolled}`,
      live ? 'Programada para hoy' : 'Programada'
    ];
  });
  return `
    <header class="page-heading"><div><p class="eyebrow">Registro de asistencia</p><h1>Cada llegada<br/>cuenta.</h1><p>Las ${classData.length} clases de la semana. Consulta operativa, sin gráficas ni analítica avanzada.</p></div><button class="button" type="button" data-open-scan>Simular escáner QR</button></header>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha y hora</th><th>Clase</th><th>Maestro</th><th>Asistencia</th><th>Estado</th></tr></thead><tbody>${sessions.map((row, index) => `<tr>${row.map((cell, cellIndex) => `<td>${cellIndex === 4 ? `<span class="status-pill ${index ? 'is-paid' : 'is-due'}">${escapeHtml(cell)}</span>` : escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  `;
}

// ---------------------------------------------------------------------------
// Tutor: vista de solo lectura. Ve a sus propios hijos y nada mas. Sin pagar,
// sin justificar ausencias y sin estadisticas: eso no esta en el arranque.
// ---------------------------------------------------------------------------

function childCardMarkup(child) {
  const next = nextClassForStudent(child.id);
  const last = lastAttendanceFor(child.id);
  const payment = monthlyPaymentFor(child.id);
  const paid = payment?.status === 'Pagado';
  return `
    <article class="surface-card">
      <div class="person-cell">
        <span class="avatar">${escapeHtml(initials(child.name))}</span>
        <span><strong>${escapeHtml(child.name)}</strong><small>${escapeHtml(child.id)} · ${escapeHtml(child.level)}</small></span>
      </div>
      <p class="eyebrow" style="margin-top:22px">Próxima clase</p>
      ${next
        ? `<h3>${escapeHtml(next.name)}</h3><p class="payment-meta">${escapeHtml(next.day)} · ${escapeHtml(next.time)} · ${escapeHtml(next.room)}<br/>${escapeHtml(next.teacher)}</p>`
        : '<p class="payment-meta">Sin clases asignadas en esta demostración.</p>'}
      <p class="eyebrow" style="margin-top:20px">Última asistencia</p>
      <p class="payment-meta">${last ? `${escapeHtml(last.label)} · ${escapeHtml(last.className)}` : 'Sin registros todavía.'}</p>
      <p class="eyebrow" style="margin-top:20px">Mensualidad · ${escapeHtml(monthName(TODAY))}</p>
      <h3>Q ${payment ? escapeHtml(payment.amount) : '—'} <span class="status-pill ${paid ? 'is-paid' : 'is-due'}">${escapeHtml(paymentStatus(payment))}</span></h3>
      <div class="form-actions">
        <button class="button button--light button--small" type="button" data-child-payment="${escapeHtml(child.id)}">Ver mensualidad</button>
        <button class="button button--small" type="button" data-child-carnet="${escapeHtml(child.id)}">Ver carné</button>
      </div>
    </article>
  `;
}

function consentCardMarkup(guardian) {
  const signed = parseDayKey(guardian.consentSignedAt);
  return `
    <article class="surface-card">
      <p class="eyebrow">Manejo de datos de menores</p>
      <h3>Consentimiento firmado</h3>
      <p class="payment-meta">${escapeHtml(guardian.name)}<br/>Firmado el ${escapeHtml(shortDate(signed))} ${signed.getFullYear()}</p>
      <p class="payment-meta" style="margin-top:16px">Como tutor accedés únicamente a la información de tus propios hijos.</p>
      <div class="form-actions"><button class="button button--light button--small" type="button" data-open-consent>Ver constancia</button></div>
    </article>
  `;
}

function renderGuardianHome() {
  const guardian = currentGuardian();
  const children = childrenOf(guardian);
  return `
    <header class="page-heading">
      <div>
        <p class="eyebrow">${escapeHtml(shortDayLabel(TODAY))}</p>
        <h1>${escapeHtml(greeting())},<br/><span>${escapeHtml(guardian.name.split(' ')[0])}.</span></h1>
        <p>${children.length === 1 ? 'Seguimiento de tu hijo' : 'Seguimiento de tus hijos'} en la academia. Esta vista es de solo consulta.</p>
      </div>
      <button class="button" type="button" data-go="carnet">Ver carnés</button>
    </header>
    <section class="section">
      <div class="section-head"><div><h2>A tu cargo</h2><p>Próxima clase, última asistencia y mensualidad del mes.</p></div><span class="tag">${children.length} alumno${children.length === 1 ? '' : 's'}</span></div>
      <div class="cards-grid">
        ${children.map(childCardMarkup).join('')}
        ${consentCardMarkup(guardian)}
      </div>
    </section>
  `;
}

function guardianCarnetMarkup() {
  const child = studentById(activeChildId);
  if (!child) return '<div class="empty-state"><strong>Sin alumnos a cargo</strong>Esta demostración no tiene hijos asignados.</div>';
  const [firstName, ...rest] = child.name.split(' ');
  const next = nextClassForStudent(child.id);
  return `
    <div class="member-card-wrap">
      <article class="member-card">
        <img class="member-logo" src="./assets/inmotion-logo.svg" alt="In Motion Dance Academy" />
        <p class="member-card-label">Miembro activo · ${escapeHtml(child.plan)}</p>
        <h2>${escapeHtml(firstName)}<br/>${escapeHtml(rest.join(' '))}</h2>
        <span class="member-id">${escapeHtml(child.id)} · ${escapeHtml(child.level)}</span>
        <div class="member-validity"><span>Vigencia</span><strong>${membershipValidity()}</strong></div>
      </article>
      <aside class="qr-panel">
        <h2>Registro en recepción</h2>
        <p>${next ? `Mostrá este código al llegar a ${escapeHtml(next.name)}, ${escapeHtml(next.day.toLowerCase())} a las ${escapeHtml(next.time)}.` : 'Mostrá este código al llegar a la academia.'}</p>
        <div class="qr-code">${qrMarkup(child.id)}</div>
        <p class="qr-demo-label">QR de demostración · ${escapeHtml(child.id)}</p>
      </aside>
    </div>
  `;
}

function renderGuardianCard() {
  const children = childrenOf(currentGuardian());
  if (!children.some((child) => child.id === activeChildId)) activeChildId = children[0]?.id || null;
  return `
    <header class="page-heading"><div><p class="eyebrow">Identificación digital</p><h1>El carné<br/>de tus hijos.</h1><p>Se muestra en recepción para registrar la llegada. El tutor no marca la asistencia.</p></div></header>
    <div class="filter-row" aria-label="Elegir alumno">
      ${children.map((child) => `<button class="filter-chip ${child.id === activeChildId ? 'is-active' : ''}" type="button" data-child-select="${escapeHtml(child.id)}">${escapeHtml(child.name)}</button>`).join('')}
    </div>
    <div id="guardianCarnet">${guardianCarnetMarkup()}</div>
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
  'admin:asistencia': renderAdminAttendance,
  'guardian:inicio': renderGuardianHome,
  'guardian:carnet': renderGuardianCard
};

function initials(name) {
  return String(name).split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
}

function modalFocusables() {
  return [...elements.modalLayer.querySelectorAll(FOCUSABLE_SELECTOR)].filter((node) => !node.hasAttribute('inert') && node.offsetParent !== null);
}

// Mientras el dialogo esta abierto el resto de la pagina no recibe foco ni se
// anuncia: inert cubre puntero y teclado, aria-hidden cubre el lector.
function setBackgroundInert(active) {
  [elements.app, elements.access].forEach((node) => {
    if (!node) return;
    node.inert = active;
    if (active) node.setAttribute('aria-hidden', 'true');
    else node.removeAttribute('aria-hidden');
  });
}

function openModal({ title, eyebrow = 'Acción demo', body }) {
  lastFocusedElement = document.activeElement;
  elements.modalTitle.textContent = title;
  elements.modalEyebrow.textContent = eyebrow;
  elements.modalBody.innerHTML = body;
  elements.modalLayer.classList.remove('is-hidden');
  elements.modalLayer.setAttribute('aria-hidden', 'false');
  setBackgroundInert(true);
  document.body.classList.add('modal-open');
  const firstInBody = elements.modalBody.querySelector(FOCUSABLE_SELECTOR);
  (firstInBody || elements.modalLayer.querySelector('.icon-button[data-close-modal]') || elements.modal)?.focus();
}

// El render puede reemplazar el elemento que abrio el dialogo: si ya no existe,
// el foco vuelve a un destino valido en vez de caer al fondo de la pagina.
function restoreFocus() {
  const previous = lastFocusedElement;
  lastFocusedElement = null;
  if (previous?.isConnected && typeof previous.focus === 'function' && !previous.disabled) {
    previous.focus({ preventScroll: true });
    return;
  }
  const fallback = elements.app.classList.contains('is-hidden')
    ? document.querySelector('[data-enter-role="student"]')
    : elements.content;
  fallback?.focus?.({ preventScroll: true });
}

function closeModal() {
  // Cerrar por Escape, por el fondo o por la X equivale a cancelar la solicitud.
  const pending = webMcpResolver;
  webMcpResolver = null;
  elements.modalLayer.classList.add('is-hidden');
  elements.modalLayer.setAttribute('aria-hidden', 'true');
  setBackgroundInert(false);
  document.body.classList.remove('modal-open');
  restoreFocus();
  pending?.(false);
}

function trapModalTab(event) {
  const targets = modalFocusables();
  if (!targets.length) {
    event.preventDefault();
    elements.modal?.focus();
    return;
  }
  const first = targets[0];
  const last = targets[targets.length - 1];
  const active = document.activeElement;
  const outside = !elements.modalLayer.contains(active);
  if (event.shiftKey && (outside || active === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (outside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

function showToast(title, detail) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i></i><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span>`;
  elements.toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

let webMcpResolver = null;

// WebMCP no escribe nada sin que la solicitud se vea y se apruebe en pantalla.
function confirmWebMcpWrite({ title, lines, confirmLabel }) {
  return new Promise((resolve) => {
    if (webMcpResolver) {
      resolve(false);
      return;
    }
    webMcpResolver = resolve;
    openModal({
      title,
      eyebrow: 'Solicitud de un asistente de IA',
      body: `
        <article class="surface-card">
          <p class="eyebrow">Se va a registrar</p>
          ${lines.map((line) => `<p class="payment-meta">${escapeHtml(line)}</p>`).join('')}
        </article>
        <p class="modal-note" style="margin-top:16px">Nada se guarda hasta que confirmés. Si cancelás, la solicitud se rechaza y el estado no cambia.</p>
        <div class="form-actions"><button class="button button--light" type="button" data-close-modal>Cancelar</button><button class="button button--red" type="button" id="confirmWebMcp">${escapeHtml(confirmLabel)}</button></div>
      `
    });
  });
}

function resolveWebMcp(value) {
  const resolver = webMcpResolver;
  webMcpResolver = null;
  closeModal();
  resolver?.(value);
}

function scanClasses() {
  return classesForStudent('IM-0241').filter((item) => item.day === 'Hoy' &&
    (activeRole !== 'teacher' || (item.id === activeClassId && item.teacher === TEACHER_NAME)));
}

function openScanModal() {
  TODAY = new Date();
  const classes = scanClasses();
  openModal({
    title: 'Escanear carnet',
    eyebrow: 'Asistencia QR · Simulación',
    body: `
      <div class="scan-stage"><span class="scan-line"></span><p class="scan-copy">Alineá el código dentro del recuadro</p></div>
      <p class="modal-note">Demo local: no se activa la cámara. El botón simula la lectura del carnet IM-0241.</p>
      ${classes.length ? `<label class="field"><span>Clase de hoy · Valeria Ruiz</span><select id="scanClass">${classes.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.time)}</option>`).join('')}</select></label>
      <div class="form-actions"><button class="button button--red" type="button" id="simulateScan" data-session-date="${escapeHtml(dayKey(TODAY))}">Simular lectura</button></div>`
        : '<p class="modal-note">Valeria no tiene una clase asignada para hoy en esta sesión. No se registrará ninguna asistencia.</p>'}
    `
  });
}

function openPaymentModal(studentId = 'IM-0241', period = monthKey(TODAY)) {
  const student = state.students.find((item) => item.id === studentId) || state.students[0];
  const periods = [...new Set([monthKey(TODAY), monthKey(nextMonthDate()), period, ...pendingPayments().map((item) => item.period)])].sort();
  openModal({
    title: 'Registrar pago',
    eyebrow: 'Administración · Registro interno',
    body: `
      <form id="paymentForm">
        <div class="form-grid">
          <label class="field field--wide"><span>Alumno</span><select name="studentId" required>${state.students.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === student.id ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(item.id)}</option>`).join('')}</select></label>
          <label class="field"><span>Monto (Q)</span><input name="amount" type="number" min="0.01" step="0.01" required /></label>
          <label class="field"><span>Método</span><select name="method" required><option>POS</option><option>Transferencia</option><option>Efectivo</option><option>Depósito</option></select></label>
          <label class="field"><span>Mes aplicado</span><select name="period">${periods.map((value) => `<option value="${escapeHtml(value)}" ${value === period ? 'selected' : ''}>${escapeHtml(monthLabel(parseDayKey(`${value}-01`)))}</option>`).join('')}</select></label>
          <label class="field"><span>Referencia</span><input name="reference" placeholder="Ej. voucher 1842" /></label>
        </div>
        <p class="modal-note">Este registro no realiza ningún cobro, no procesa tarjetas y no genera factura FEL.</p>
        <p class="payment-meta" id="paymentFormMessage" role="status"></p>
        <div class="form-actions"><button class="button button--light" type="button" data-close-modal>Cancelar</button><button class="button button--red" type="submit">Guardar pago</button></div>
      </form>
    `
  });
  updatePaymentForm();
}

function updatePaymentForm() {
  const form = document.querySelector('#paymentForm');
  if (!form) return;
  const studentId = form.elements.studentId.value;
  const existing = state.payments.find((item) => item.studentId === studentId && item.period === form.elements.period.value);
  const paid = existing?.status === 'Pagado';
  form.elements.amount.value = existing?.amount ?? planAmount(studentId);
  form.elements.amount.readOnly = !!existing;
  form.querySelector('[type="submit"]').disabled = paid;
  document.querySelector('#paymentFormMessage').textContent = paid
    ? 'Este mes ya está pagado. El registro existente se conserva y no se puede reemplazar desde este formulario.'
    : existing ? 'Se registrará la liquidación completa de esta mensualidad pendiente.' : 'Se creará un registro para el período elegido. No cancela deudas de otros meses.';
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
        <p class="payment-meta" id="studentFormMessage" role="status"></p>
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
      <div class="surface-card" style="padding:20px;margin-bottom:16px"><p class="eyebrow">Detalle de clase</p><h3>${escapeHtml(item.level)}</h3><p class="payment-meta">${escapeHtml(item.teacher)} · ${escapeHtml(item.room)}<br/>${escapeHtml(capacityText(item))} alumnos inscritos</p></div>
      <p class="modal-note">Esta pantalla permite consultar horarios y cupos de demostración. Las reservas no están habilitadas en este prototipo.</p>
      <div class="form-actions"><button class="button button--red" type="button" data-close-modal>Entendido</button></div>
    `
  });
}

function openStudentPayment() {
  const payment = monthlyPaymentFor('IM-0241');
  const paid = payment?.status === 'Pagado';
  openModal({
    title: paid ? 'Comprobante interno' : payment ? 'Mensualidad pendiente' : 'Mensualidad sin registro',
    eyebrow: monthLabel(TODAY),
    body: `
      <article class="surface-card"><p class="eyebrow">${escapeHtml(paymentStatus(payment))}</p><p class="payment-amount">Q ${escapeHtml(payment?.amount ?? '—')}</p><p class="payment-meta">${paid ? `${escapeHtml(payment.method)} · ` : ''}${escapeHtml(paymentDateText(payment))}</p></article>
      <p class="modal-note" style="margin-top:16px">La academia cobra por sus medios habituales. La app solo refleja el registro interno; no hay pasarela ni pago con tarjeta.</p>
    `
  });
}

function openConsentModal() {
  const guardian = currentGuardian();
  const signed = parseDayKey(guardian.consentSignedAt);
  openModal({
    title: 'Constancia de consentimiento',
    eyebrow: 'Menores de edad',
    body: `
      <article class="surface-card">
        <p class="eyebrow">Firmado el ${escapeHtml(shortDate(signed))} ${signed.getFullYear()}</p>
        <p class="payment-meta">Como tutor accedés únicamente a la información de tus propios hijos.</p>
      </article>
      <p class="modal-note" style="margin-top:16px">El consentimiento se firma con la academia fuera del sistema. Esta pantalla no contiene el documento: solo deja constancia de que existe y de su fecha.</p>
      <div class="form-actions"><button class="button button--red" type="button" data-close-modal>Entendido</button></div>
    `
  });
}

function openChildPayment(studentId) {
  const child = studentById(studentId);
  if (!child) return;
  const payment = monthlyPaymentFor(child.id);
  const paid = payment?.status === 'Pagado';
  openModal({
    title: `Mensualidad · ${child.name}`,
    eyebrow: monthLabel(TODAY),
    body: `
      <article class="surface-card">
        <p class="eyebrow">${escapeHtml(paymentStatus(payment))}</p>
        <p class="payment-amount">Q ${payment ? escapeHtml(payment.amount) : '—'}</p>
        <p class="payment-meta">${paid ? `${escapeHtml(payment.method)} · ` : ''}${escapeHtml(paymentDateText(payment))}</p>
      </article>
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
      <article class="surface-card"><p class="eyebrow">Pago registrado</p><p class="payment-amount">Q ${escapeHtml(payment.amount)}</p><h3>${escapeHtml(payment.student)}</h3><p class="payment-meta">${escapeHtml(payment.month)} · ${escapeHtml(payment.method)} · ${escapeHtml(payment.date)}</p></article>
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
      <article class="surface-card"><div class="person-cell"><span class="avatar" style="width:54px;height:54px">${escapeHtml(initials(student.name))}</span><span><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.plan)}</small></span></div><p class="payment-meta" style="margin-top:22px">Teléfono · ${escapeHtml(student.phone || 'Sin registrar')}<br/>Estado de pago · ${escapeHtml(studentPaymentStatus(student.id))}</p></article>
      <p class="modal-note" style="margin-top:16px">Ficha demo sin información sensible real.</p>
    `
  });
}

function openProfile() {
  const profiles = {
    student: ['Valeria Ruiz', 'Alumno · Plan 8 clases', 'IM-0241'],
    teacher: ['Alex Aquino', 'Maestro', `${teacherClasses().length} clase${teacherClasses().length === 1 ? '' : 's'} asignada${teacherClasses().length === 1 ? '' : 's'}`],
    admin: ['Majo Borrayo', 'Administración', 'Acceso de demostración'],
    guardian: ['Carmen Ruiz', 'Tutor', 'Valeria Ruiz y Diego Ruiz a su cargo']
  };
  const [name, role, meta] = profiles[activeRole] || profiles.student;
  openModal({
    title: name,
    eyebrow: roleConfig[activeRole].label,
    body: `
      <article class="surface-card"><div class="person-cell"><span class="avatar" style="width:58px;height:58px">${escapeHtml(roleConfig[activeRole].initials)}</span><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(role)}</small></span></div><p class="payment-meta" style="margin-top:22px">${escapeHtml(meta)}</p></article>
      <p class="modal-note" style="margin-top:16px">Perfil ficticio para recorrer el prototipo. No existe autenticación ni cuenta real.</p>
    `
  });
}

function simulateScan() {
  TODAY = new Date();
  const target = scanClasses().find((item) => item.id === document.querySelector('#scanClass')?.value);
  try {
    if (!target) throw new Error('No hay una clase válida para registrar esta lectura.');
    recordAttendance(target.id, ['IM-0241'], document.querySelector('#simulateScan').dataset.sessionDate);
  } catch (error) {
    showToast('No se registró la asistencia', error.message);
    return;
  }
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
      <p class="payment-meta" id="resetMessage" role="status"></p>
      <div class="form-actions"><button class="button button--light" type="button" data-close-modal>Cancelar</button><button class="button button--red" type="button" id="confirmReset">Sí, reiniciar</button></div>
    `
  });
}

function resetDemo() {
  // Se escribe el estado inicial encima del guardado: nada se borra antes de
  // comprobar que el reinicio se puede persistir.
  const fresh = structuredClone(defaultState);
  fresh.role = activeRole;
  try {
    persistState(fresh);
  } catch (error) {
    const message = document.querySelector('#resetMessage');
    if (message) message.textContent = error.message;
    return;
  }
  activeClassId = classData[0].id;
  activeRoute = 'inicio';
  activeChildId = null;
  closeModal();
  showToast('Demo reiniciada', 'Los datos volvieron a su estado inicial.');
  renderApp();
}

function handleModalClick(event) {
  if (event.target.closest('#confirmWebMcp')) return resolveWebMcp(true);
  if (event.target.closest('[data-close-modal]')) return closeModal();
  if (event.target.closest('#simulateScan')) return simulateScan();
  if (event.target.closest('#confirmReset')) return resetDemo();
}

function handleModalSubmit(event) {
  if (event.target.id === 'paymentForm') handlePaymentSubmit(event);
  if (event.target.id === 'studentForm') handleStudentSubmit(event);
}

function registerPayment({ studentId, period, amount, method, reference = '' }) {
  TODAY = new Date();
  const student = studentById(studentId);
  if (!student) throw new Error('Alumno no encontrado.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Elegí un período válido.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('El monto debe ser mayor que cero.');
  if (!['POS', 'Transferencia', 'Efectivo', 'Depósito'].includes(method)) throw new Error('Método de pago no válido.');
  const existing = state.payments.find((item) => item.studentId === student.id && item.period === period);
  if (existing?.status === 'Pagado') throw new Error('Este mes ya está pagado. El registro existente no se reemplazó.');
  if (existing && amount !== existing.amount) throw new Error(`La mensualidad pendiente es de Q ${existing.amount}. Este formulario registra su liquidación completa.`);
  const record = {
    id: existing?.id || nextPaymentId(),
    studentId: student.id,
    student: student.name,
    month: monthLabel(parseDayKey(`${period}-01`)),
    period,
    amount,
    method,
    date: shortDate(TODAY),
    paidAt: dayKey(TODAY),
    dueDate: existing?.dueDate || null,
    status: 'Pagado',
    reference: String(reference)
  };
  const nextState = { ...state, payments: existing ? state.payments.map((item) => item.id === existing.id ? record : item) : [record, ...state.payments] };
  persistState(nextState);
  return record;
}

function handlePaymentSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  let record;
  try {
    record = registerPayment({ studentId: data.get('studentId'), period: data.get('period'), amount: Number(data.get('amount')), method: data.get('method'), reference: data.get('reference') || '' });
  } catch (error) {
    document.querySelector('#paymentFormMessage').textContent = error.message;
    return;
  }
  closeModal();
  showToast('Pago guardado', `${record.student} · Q ${record.amount} · ${record.method}`);
  renderApp();
}

function handleStudentSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const message = document.querySelector('#studentFormMessage');
  const name = String(data.get('name') || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3) {
    if (message) message.textContent = 'Escribí el nombre completo del alumno.';
    return;
  }
  const student = {
    id: nextStudentId(),
    name: name.slice(0, 80),
    initials: initials(name),
    plan: String(data.get('plan')),
    phone: String(data.get('phone') || '').trim().slice(0, 24) || 'Sin registrar',
    status: 'Pendiente',
    level: 'Sin nivel',
    classIds: [],
    notes: String(data.get('notes') || '').trim().slice(0, 280)
  };
  // Se guarda antes de tocar la memoria: si el navegador no puede, no se creo nada.
  try {
    persistState({ ...state, students: [student, ...state.students] });
  } catch (error) {
    if (message) message.textContent = error.message;
    return;
  }
  closeModal();
  showToast('Alumno creado', `${student.name} · registro local`);
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
      // WebMCP es opcional; la interfaz visible sigue disponible.
    }
  };

  register({
    name: 'read_demo_schedule',
    title: 'Consultar horario demo',
    description: 'Devuelve las clases visibles en el horario de demostración de In Motion.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute() {
      TODAY = new Date();
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
    async execute(input) {
      const classItem = classData.find((item) => item.id === input?.classId);
      const student = state.students.find((item) => item.id === input?.studentId);
      if (!classItem) throw new Error('Clase demo no encontrada.');
      if (!student) throw new Error('Alumno demo no encontrado.');
      const approved = await confirmWebMcpWrite({
        title: 'Confirmar asistencia',
        lines: [`Alumno · ${student.name} (${student.id})`, `Clase · ${classItem.name} · ${classItem.time}`, `Fecha · ${longDate(new Date())}`],
        confirmLabel: 'Sí, registrar asistencia'
      });
      if (!approved) throw new Error('La confirmación se canceló en pantalla. No se registró ninguna asistencia.');
      recordAttendance(classItem.id, [student.id], dayKey(new Date()));
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
    async execute(input) {
      const student = state.students.find((item) => item.id === input?.studentId);
      if (!student) throw new Error('Alumno demo no encontrado.');
      const approved = await confirmWebMcpWrite({
        title: 'Confirmar pago',
        lines: [`Alumno · ${student.name} (${student.id})`, `Monto · Q ${input?.amount}`, `Método · ${input?.method}`, `Mes aplicado · ${monthLabel(new Date())}`],
        confirmLabel: 'Sí, registrar pago'
      });
      if (!approved) throw new Error('La confirmación se canceló en pantalla. No se registró ningún pago.');
      const record = registerPayment({ studentId: input?.studentId, amount: input?.amount, method: input?.method, period: monthKey(new Date()) });
      if (!elements.app.classList.contains('is-hidden')) renderApp();
      return { paymentId: record.id, studentId: record.studentId, amount: record.amount, status: 'recorded' };
    }
  });
}

function handleAttendanceSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const classId = form.dataset.classId;
  const studentIds = [...form.querySelectorAll('input[name="attendance"]:checked')].map((input) => input.value);
  try {
    recordAttendance(classId, studentIds, form.dataset.sessionDate, { replaceDay: true });
  } catch (error) {
    showToast('No se guardó la asistencia', error.message);
    return;
  }
  showToast('Asistencia guardada', `${studentIds.length} alumnos marcados como presentes.`);
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

// Se redibuja solo el carne para no perder la posicion de scroll al cambiar de hijo.
function applyChildSelect(button) {
  activeChildId = button.dataset.childSelect;
  elements.content.querySelectorAll('[data-child-select]').forEach((chip) => chip.classList.toggle('is-active', chip === button));
  const panel = elements.content.querySelector('#guardianCarnet');
  if (panel) panel.innerHTML = guardianCarnetMarkup();
}

function applyPaymentFilter(button) {
  elements.content.querySelectorAll('[data-payment-filter]').forEach((chip) => chip.classList.toggle('is-active', chip === button));
  const filter = button.dataset.paymentFilter;
  const filtered = filter === 'all' ? state.payments : state.payments.filter((item) => paymentStatus(item) === filter);
  elements.content.querySelector('#paymentTableBody').innerHTML = adminPaymentRows(filtered);
}

// Un solo manejador delegado para toda la página: el contenido se redibuja en cada
// render y enganchar listeners elemento por elemento los iba duplicando.
function handleContentClick(event) {
  TODAY = new Date();
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
  if (register) return openPaymentModal(register.dataset.registerFor, register.dataset.paymentPeriod);
  const receipt = find('[data-receipt]');
  if (receipt) return openReceipt(receipt.dataset.receipt);
  const studentDetail = find('[data-student-detail]');
  if (studentDetail) return openStudentDetail(studentDetail.dataset.studentDetail);

  const childCarnet = find('[data-child-carnet]');
  if (childCarnet) {
    activeChildId = childCarnet.dataset.childCarnet;
    return routeTo('carnet');
  }
  const childSelect = find('[data-child-select]');
  if (childSelect) return applyChildSelect(childSelect);
  const childPayment = find('[data-child-payment]');
  if (childPayment) return openChildPayment(childPayment.dataset.childPayment);
  if (find('[data-open-consent]')) return openConsentModal();

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
elements.modalLayer.addEventListener('change', (event) => {
  if (event.target.closest('#paymentForm') && ['studentId', 'period'].includes(event.target.name)) updatePaymentForm();
});
document.querySelector('#profileButton').addEventListener('click', openProfile);

elements.roleSwitcher.addEventListener('change', (event) => {
  if (!roleConfig[event.target.value]) return;
  activeRole = event.target.value;
  activeRoute = 'inicio';
  const saved = persistOrWarn({ ...state, role: activeRole });
  history.pushState(null, '', '#/inicio');
  renderApp();
  if (saved) showToast('Vista actualizada', `Ahora estás viendo ${roleConfig[activeRole].label.toLowerCase()}.`);
});

elements.menuButton.addEventListener('click', () => {
  setMenuOpen(!elements.app.classList.contains('menu-open'), { moveFocus: true });
});

MOBILE_QUERY.addEventListener('change', syncMenuState);
syncMenuState();

document.addEventListener('click', (event) => {
  const routeLink = event.target.closest('[data-route]');
  if (!routeLink) return;
  event.preventDefault();
  routeTo(routeLink.dataset.route);
});

document.addEventListener('keydown', (event) => {
  const modalOpen = !elements.modalLayer.classList.contains('is-hidden');
  if (modalOpen && event.key === 'Escape') return closeModal();
  if (modalOpen && event.key === 'Tab') return trapModalTab(event);
  if (event.key === 'Escape' && elements.app.classList.contains('menu-open')) {
    setMenuOpen(false);
    elements.menuButton.focus();
  }
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

// Si al abrir se descartaron registros ilegibles, se dice en pantalla en vez de
// dejar que el usuario descubra solo que le faltan datos.
if (recoveryReport) {
  const parts = [
    recoveryReport.students ? `${recoveryReport.students} alumno${recoveryReport.students === 1 ? '' : 's'}` : '',
    recoveryReport.payments ? `${recoveryReport.payments} pago${recoveryReport.payments === 1 ? '' : 's'}` : '',
    recoveryReport.attendance ? `${recoveryReport.attendance} asistencia${recoveryReport.attendance === 1 ? '' : 's'}` : ''
  ].filter(Boolean);
  showToast(
    recoveryReport.fatal ? 'Demo reiniciada' : 'Datos recuperados',
    recoveryReport.fatal
      ? 'Los datos guardados no se pudieron leer y se volvió al estado inicial.'
      : `Se descartaron registros ilegibles: ${parts.join(', ')}. El resto se conservó.`
  );
}

registerWebMcpTools();
