import {
  signInWithPassword,
  signOut,
  restoreSession,
  refreshSession,
  getAuthenticatedProfile,
  clearLocalAuthCache,
  fetchRemoteClasses,
  fetchRemoteStudents,
  fetchRemoteAttendance,
  fetchRemotePayments,
  syncRemoteAttendance,
  deleteRemoteAttendance,
  syncRemotePayment,
  createRemoteStudent,
  syncRemoteEnrollments,
  syncSessionAttendances
} from './supabase.js';

let isSupabaseConnected = false;
let supabaseSyncError = null;
let authenticatedUser = null;
let authenticatedProfile = null;
const pendingLocalStudentEdits = new Set();

const STORAGE_KEY = 'inmotion-academy-demo-v1';
const STATE_VERSION = 3;

function getStorageKey() {
  if (isSupabaseConnected && authenticatedUser?.id) {
    return `inmotion-academy-user-${authenticatedUser.id}`;
  }
  return STORAGE_KEY;
}

function createEmptyConnectedState() {
  return {
    role: authenticatedProfile?.role || null,
    students: [],
    payments: [],
    attendanceLog: [],
    musicSuggestions: [],
    singlePasses: []
  };
}

function clearCurrentSessionState() {
  state = {
    role: null,
    students: [],
    payments: [],
    attendanceLog: [],
    musicSuggestions: [],
    singlePasses: []
  };
  activeChildId = null;
  supabaseSyncError = null;
}
let TODAY = new Date();
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const icons = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  scan: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14h.01M17 10h.01"/><circle cx="12" cy="12" r="2.3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>'
};

const roleConfig = {
  student: {
    label: 'Portal de alumno',
    initials: 'VR',
    routes: [
      ['inicio', 'Inicio', 'home'],
      ['clases', 'Clases', 'calendar'],
      ['planes', 'Planes', 'money'],
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
      ['asistencia', 'Asistencia', 'list'],
      ['pases', 'Pases', 'ticket']
    ]
  },
  guardian: {
    label: 'Portal de tutor',
    initials: 'CR',
    routes: [
      ['inicio', 'Inicio', 'home'],
      ['carnet', 'Carnés', 'card'],
      ['planes', 'Planes', 'money']
    ]
  }
};

let classData = [
  { id: 'bachata-inter', weekday: 3, time: '6:00 PM', name: 'Bachata Intermedio', level: 'Nivel intermedio', teacher: 'Alex Aquino', room: 'Salón', enrolled: 14, capacity: 18 },
  { id: 'salsa-basico', weekday: 3, time: '7:15 PM', name: 'Salsa Principiantes', level: 'Nivel inicial', teacher: 'Luis Ramírez', room: 'Salón', enrolled: 9, capacity: 20 },
  { id: 'kpop-teens', weekday: 4, time: '5:00 PM', name: 'K-Pop Teens', level: '12 a 17 años', teacher: 'Majo Borrayo', room: 'Salón', enrolled: 18, capacity: 18 },
  { id: 'latino', weekday: 4, time: '7:00 PM', name: 'Baile Latino', level: 'Todos los niveles', teacher: 'Alex Aquino', room: 'Salón', enrolled: 12, capacity: 20 },
  { id: 'latino-kids', weekday: 6, time: '10:00 AM', name: 'Baile Latino Kids', level: '7 a 11 años', teacher: 'Sofía Castillo', room: 'Salón', enrolled: 7, capacity: 12 },
  { id: 'salsa-casino', weekday: 6, time: '11:30 AM', name: 'Salsa Casino', level: 'Nivel avanzado', teacher: 'Leo Méndez', room: 'Salón', enrolled: 10, capacity: 14 }
];

// ---------------------------------------------------------------------------
// Horario semanal, pases y tarifas del Comparador de Planes (SelectorPlanes)
//
// SUPUESTOS DE LA SIMULACION, NO CONDICIONES DE LA ACADEMIA.
// Las cifras de pases y los cargos de apertura salen de un video de referencia
// y no estan confirmadas con In Motion. Las reglas derivadas -un Dancer Pass por
// track, Night Pass para lunes a jueves, Weekend Pass por dia de fin de semana,
// parqueo de Q 15 entre semana y Q 20 el fin de semana, y el parqueo incluido
// del Full In Motion- las armo la demo para poder comparar; nadie las aprobo.
// Mientras sigan sin confirmarse, la interfaz las presenta como supuestos.
// ---------------------------------------------------------------------------
const SCHEDULE_FEES = {
  registration: 150,
  membership: 125,
};

const PASS_PLANS = {
  dancer: { id: 'dancer', name: 'Dancer Pass', price: 395 },
  night: { id: 'night', name: 'Night Pass', price: 595 },
  weekend: { id: 'weekend', name: 'Weekend Pass', price: 300 },
  teens: { id: 'teens', name: 'Teens In Motion', price: 495 },
  full: { id: 'full', name: 'Full In Motion', price: 750 },
};

const SCHEDULE_DAYS = [
  { id: 'lunes', label: 'Lunes', type: 'weekday' },
  { id: 'martes', label: 'Martes', type: 'weekday' },
  { id: 'miercoles', label: 'Miércoles', type: 'weekday' },
  { id: 'jueves', label: 'Jueves', type: 'weekday' },
  { id: 'sabado', label: 'Sábado', type: 'weekend' },
  { id: 'domingo', label: 'Domingo', type: 'weekend' }
];

const SCHEDULE_TIME_SLOTS = [
  { id: '9am', label: '9 a 10 am' },
  { id: '10am', label: '10 a 11 am' },
  { id: '11am', label: '11 am a 12 pm' },
  { id: '4pm', label: '4:00 a 5:30 pm' },
  { id: '6pm', label: '6:00 pm' },
  { id: '7pm', label: '7:00 pm' },
  { id: '8pm', label: '8:00 pm' }
];

const SCHEDULE_TRACKS = {
  latinOpen: 'Latin Dance Nivel Abierto',
  level1: 'Nivel 1 Salsa y Bachata',
  level2: 'Nivel 2 Salsa y Bachata',
  urbano: 'Urbano',
  level4: 'Nivel 4 Salsa y Bachata',
  level3: 'Nivel 3 Salsa y Bachata',
  salsaCubana: 'Salsa Cubana',
  salsaCasino: 'Salsa Casino',
  teens: 'Teens',
  kpop: 'K-Pop'
};

const SCHEDULE_COLORS = {
  latinOpen: '#686d72',
  level1: '#e20c14',
  level2: '#d97706',
  urbano: '#16a34a',
  level4: '#ea580c',
  level3: '#2563eb',
  teens: '#db2777',
  salsaCubana: '#0891b2',
  kpop: '#059669',
  salsaCasino: '#7c3aed'
};

const SCHEDULE_CLASSES = [
  { id: 'latin-mon', day: 'lunes', slot: '6pm', time: '6:00 pm', name: 'Latin Dance Nivel Abierto', track: 'latinOpen', category: 'weekday', color: SCHEDULE_COLORS.latinOpen },
  { id: 'level1-mon', day: 'lunes', slot: '7pm', time: '7:00 pm', name: 'Nivel 1 Básico Salsa y Bachata', track: 'level1', category: 'weekday', color: SCHEDULE_COLORS.level1 },
  { id: 'level2-mon', day: 'lunes', slot: '8pm', time: '8:00 pm', name: 'Nivel 2 Principiante Salsa y Bachata', track: 'level2', category: 'weekday', color: SCHEDULE_COLORS.level2 },
  { id: 'urbano-tue', day: 'martes', slot: '6pm', time: '6:00 pm', name: 'Urbano', track: 'urbano', category: 'weekday', color: SCHEDULE_COLORS.urbano },
  { id: 'level4-tue', day: 'martes', slot: '7pm', time: '7:00 pm', name: 'Nivel 4 Intermedio Salsa y Bachata', track: 'level4', category: 'weekday', color: SCHEDULE_COLORS.level4 },
  { id: 'level3-tue', day: 'martes', slot: '8pm', time: '8:00 pm', name: 'Nivel 3 Prin / Inter Salsa y Bachata', track: 'level3', category: 'weekday', color: SCHEDULE_COLORS.level3 },
  { id: 'latin-wed', day: 'miercoles', slot: '6pm', time: '6:00 pm', name: 'Latin Dance Nivel Abierto', track: 'latinOpen', category: 'weekday', color: SCHEDULE_COLORS.latinOpen },
  { id: 'level1-wed', day: 'miercoles', slot: '7pm', time: '7:00 pm', name: 'Nivel 1 Básico Salsa y Bachata', track: 'level1', category: 'weekday', color: SCHEDULE_COLORS.level1 },
  { id: 'level2-wed', day: 'miercoles', slot: '8pm', time: '8:00 pm', name: 'Nivel 2 Principiante Salsa y Bachata', track: 'level2', category: 'weekday', color: SCHEDULE_COLORS.level2 },
  { id: 'urbano-thu', day: 'jueves', slot: '6pm', time: '6:00 pm', name: 'Urbano', track: 'urbano', category: 'weekday', color: SCHEDULE_COLORS.urbano },
  { id: 'level4-thu', day: 'jueves', slot: '7pm', time: '7:00 pm', name: 'Nivel 4 Intermedio Salsa y Bachata', track: 'level4', category: 'weekday', color: SCHEDULE_COLORS.level4 },
  { id: 'level3-thu', day: 'jueves', slot: '8pm', time: '8:00 pm', name: 'Nivel 3 Prin / Inter Salsa y Bachata', track: 'level3', category: 'weekday', color: SCHEDULE_COLORS.level3 },
  { id: 'teens-urbano-sat', day: 'sabado', slot: '9am', time: '9:00 a 10:00 am', name: 'Urbano Teens', track: 'teens', category: 'teen', color: SCHEDULE_COLORS.teens },
  { id: 'teens-kpop-sat', day: 'sabado', slot: '10am', time: '10:00 a 11:00 am', name: 'K-Pop Teens', track: 'teens', category: 'teen', color: SCHEDULE_COLORS.teens },
  { id: 'teens-latino-sat', day: 'sabado', slot: '11am', time: '11:00 am a 12:00 pm', name: 'Latino Teens', track: 'teens', category: 'teen', color: SCHEDULE_COLORS.teens },
  { id: 'cubana-sat', day: 'sabado', slot: '4pm', time: '4:00 a 5:30 pm', name: 'Salsa Cubana (Rueda de Casino)', track: 'salsaCubana', category: 'weekend', color: SCHEDULE_COLORS.salsaCubana },
  { id: 'kpop-sun', day: 'domingo', slot: '10am', time: '10:00 a 11:00 am', name: 'K-Pop', track: 'kpop', category: 'weekend', color: SCHEDULE_COLORS.kpop },
  { id: 'casino-sun', day: 'domingo', slot: '4pm', time: '4:00 a 5:30 pm', name: 'Salsa Casino', track: 'salsaCasino', category: 'weekend', color: SCHEDULE_COLORS.salsaCasino }
];


// ---------------------------------------------------------------------------
// Definicion unica de los planes. De aca salen el comparador, la cuota que se
// sugiere al registrar un pago, el carnet y el cupo de clases del mes: antes
// cada pantalla llevaba su propia copia de los importes y del numero de clases.
// Importes ficticios de demostracion.
// ---------------------------------------------------------------------------
const membershipPlans = [
  {
    id: 'four',
    planName: 'Plan 4 clases',
    name: '4 clases',
    price: 300,
    monthlyClasses: 4,
    unlimited: false,
    weeklyRhythm: 1,
    subtitle: 'Tu primer paso',
    description: 'Un espacio semanal para empezar y disfrutar.'
  },
  {
    id: 'eight',
    planName: 'Plan 8 clases',
    name: '8 clases',
    price: 450,
    monthlyClasses: 8,
    unlimited: false,
    weeklyRhythm: 2,
    subtitle: 'Encontrá tu ritmo',
    description: 'Más práctica para avanzar con constancia.'
  },
  {
    id: 'unlimited',
    planName: 'Plan ilimitado',
    name: 'Ilimitado',
    price: 625,
    // Sin cupo mensual: se representa con null, nunca con Infinity, para que
    // ninguna pantalla muestre "Infinity" ni calcule un saldo negativo.
    monthlyClasses: null,
    unlimited: true,
    weeklyRhythm: 3,
    subtitle: 'Todo tu movimiento',
    description: 'Para hacer del baile parte de tu semana.'
  },
  {
    id: 'dancer',
    planName: 'Dancer Pass',
    name: 'Dancer Pass',
    price: 395,
    monthlyClasses: null,
    unlimited: true,
    weeklyRhythm: 2,
    subtitle: 'Tu disciplina favorita',
    description: 'Acceso al track de baile seleccionado entre semana.'
  },
  {
    id: 'night',
    planName: 'Night Pass',
    name: 'Night Pass',
    price: 595,
    monthlyClasses: null,
    unlimited: true,
    weeklyRhythm: 3,
    subtitle: 'Noches entre semana',
    description: 'Acceso a todas las clases de lunes a jueves en la noche.'
  },
  {
    id: 'weekend',
    planName: 'Weekend Pass',
    name: 'Weekend Pass',
    price: 300,
    monthlyClasses: null,
    unlimited: true,
    weeklyRhythm: 1,
    subtitle: 'Fin de semana',
    description: 'Acceso a clases de fin de semana (sábado o domingo).'
  },
  {
    id: 'teens',
    planName: 'Teens In Motion',
    name: 'Teens In Motion',
    price: 495,
    monthlyClasses: null,
    unlimited: true,
    weeklyRhythm: 1,
    subtitle: 'Sábados Teens',
    description: 'Acceso a las clases juveniles Teens de los sábados.'
  },
  {
    id: 'full',
    planName: 'Full In Motion',
    name: 'Full In Motion',
    price: 750,
    monthlyClasses: null,
    unlimited: true,
    weeklyRhythm: 4,
    subtitle: 'Pase ilimitado total',
    description: 'Acceso ilimitado a todos los horarios con parqueo incluido hasta 3 horas.'
  }
];

const DEFAULT_PLAN = membershipPlans[1];
const PLAN_NAMES = membershipPlans.map((plan) => plan.planName);

function formatAmount(value) {
  return Number(value).toLocaleString('es-GT', { maximumFractionDigits: 2 });
}

function planByName(name) {
  if (!name) return null;
  const clean = String(name).trim().toLowerCase();
  const match = membershipPlans.find((plan) =>
    plan.planName.toLowerCase() === clean ||
    plan.name.toLowerCase() === clean ||
    plan.id.toLowerCase() === clean
  );
  if (match) return match;
  // Un plan que no esta en el catalogo NO se convierte al predeterminado ni se le
  // deduce precio, cupo o equivalencia: se conserva tal como quedo guardado y se
  // marca para revision. Antes, un titulo combinado del comparador se resolvia
  // como un plan inventado de Q 695 que nadie aprobo.
  return unknownPlan(name);
}

function unknownPlan(name) {
  return {
    id: null,
    planName: String(name),
    name: String(name),
    price: null,
    monthlyClasses: null,
    unlimited: false,
    weeklyRhythm: null,
    subtitle: 'Plan fuera del catálogo',
    description: 'Este plan no figura en el catálogo de la demo. Se conserva tal como fue guardado y necesita revisión antes de cobrarlo o asignarle cupos.',
    needsReview: true
  };
}

function noPlanDefined() {
  return {
    id: null,
    planName: 'Sin plan asignado',
    name: 'Sin plan asignado',
    price: null,
    monthlyClasses: null,
    unlimited: false,
    weeklyRhythm: null,
    subtitle: 'Sin cuota definida',
    description: 'Este alumno no tiene un plan o cuota asignada. Registrá su membresía antes de procesar cobros.',
    needsReview: true
  };
}

// Un importe que la demo no puede derivar se dice; no se rellena con un numero.
function priceText(value) {
  return Number.isFinite(value) ? `Q ${formatAmount(value)}` : 'Por confirmar';
}


function planRhythmText(plan) {
  if (plan.needsReview) return 'Frecuencia semanal por confirmar';
  if (plan.unlimited) return `${plan.weeklyRhythm} o más clases por semana`;
  return `${plan.weeklyRhythm} clase${plan.weeklyRhythm === 1 ? '' : 's'} por semana`;
}

function planAllowanceText(plan) {
  if (plan.needsReview) return 'Cupo mensual por confirmar';
  return plan.unlimited ? 'Asistencia sin límite mensual' : `${plan.monthlyClasses} clases al mes`;
}

function planUnitText(plan) {
  if (plan.needsReview) return 'Importe por clase por confirmar';
  if (plan.unlimited) return 'Sin límite de clases en el plan demo';
  return `Q ${formatAmount(plan.price / plan.monthlyClasses)} por clase`;
}

// Etiqueta corta para senalar en pantalla un plan que quedo fuera del catalogo.
function planReviewTag(plan) {
  return plan.needsReview ? ' <span class="tag">Revisar plan</span>' : '';
}

function recommendedPlanFor(frequency) {
  return membershipPlans.find((plan) => plan.weeklyRhythm === frequency) || membershipPlans[membershipPlans.length - 1];
}

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
    let sessionDate = item.date ? new Date(item.date) : nextDateFor(item.weekday);
    let startsAt = new Date(sessionDate);
    startsAt.setMinutes(timeValue(item.time));
    // Regla explícita de duración: cada clase dura 60 minutos.
    // Una clase finaliza exactamente 60 minutos después de su hora de inicio.
    let endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    let isOngoing = false;
    let hasEnded = false;

    if (TODAY > endsAt) {
      // Si la sesión de hoy ya concluyó, su siguiente ocurrencia es en 7 días
      hasEnded = true;
      sessionDate = addDays(sessionDate, 7);
      startsAt = new Date(sessionDate);
      startsAt.setMinutes(timeValue(item.time));
      endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    } else if (TODAY >= startsAt && TODAY <= endsAt) {
      isOngoing = true;
    }

    return {
      ...item,
      date: sessionDate,
      startsAt,
      endsAt,
      isOngoing,
      hasEnded,
      day: dayLabel(sessionDate),
      dateLabel: shortDate(sessionDate),
      fullDateLabel: longDate(sessionDate)
    };
  }).sort((a, b) => (a.date - b.date) || (timeValue(a.time) - timeValue(b.time)));
}

const TEACHER_NAME = 'Alex Aquino';

function currentTeacher() {
  if (isSupabaseConnected) {
    if (authenticatedProfile?.role !== 'teacher') return null;
    const name = `${authenticatedProfile.first_name || ''} ${authenticatedProfile.last_name || ''}`.trim() || 'Maestro';
    return {
      id: authenticatedProfile.id,
      name,
      firstName: authenticatedProfile.first_name || 'Maestro'
    };
  }
  return {
    id: 'demo-teacher',
    name: TEACHER_NAME,
    firstName: 'Alex'
  };
}

function teacherClasses() {
  const teacher = currentTeacher();
  if (isSupabaseConnected) {
    if (!teacher) return [];
    return scheduledClasses().filter((item) =>
      (item.teacherId && item.teacherId === teacher.id) ||
      (teacher.name && item.teacher === teacher.name)
    );
  }
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

// Solo los correlativos con forma P-<numero> entran en la cuenta: un id de
// recuperacion como P-2026-09-IM-0241 disparaba el correlativo a millones.
function nextPaymentId() {
  const highest = state.payments.reduce((acc, item) => {
    const match = /^P-(\d+)$/.exec(String(item.id));
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 1000);
  let number = highest + 1;
  while (state.payments.some((item) => item.id === `P-${number}`)) number += 1;
  return `P-${number}`;
}

function nextStudentId() {
  const highest = state.students.reduce((acc, item) => Math.max(acc, Number(String(item.id).replace(/\D/g, '')) || 0), 240);
  return `IM-${String(highest + 1).padStart(4, '0')}`;
}

// Cifras de referencia del calendario (academia de 50 alumnos), distintas de la
// lista de la sesion, que sale de las inscripciones demo.
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

// El periodo de la mensualidad que se consulta hoy. No es la vigencia del
// carne: el carne no vence.
function currentPeriodLabel() {
  return monthLabel(TODAY);
}

function studentById(studentId) {
  return state.students.find((item) => item.id === studentId);
}

function currentStudent() {
  if (isSupabaseConnected) {
    if (!authenticatedProfile && !authenticatedUser) return null;
    return state.students.find((s) =>
      (authenticatedUser && s.userId === authenticatedUser.id) ||
      (authenticatedProfile && s.profileId === authenticatedProfile.id)
    ) || null;
  }
  return studentById(DEMO_STUDENT_ID) || state.students[0] || null;
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
  const student = studentById(studentId);
  if (!student) return 'Sin registro';

  const due = state.payments.filter((item) => item.studentId === studentId && item.period <= monthKey(TODAY) && item.status !== 'Pagado');
  if (due.some((item) => paymentStatus(item) === 'En mora')) return 'En mora';
  if (due.length) return 'Pendiente';

  const monthly = monthlyPaymentFor(studentId);
  if (monthly?.status === 'Pagado') return 'Al día';

  const required = requiredPaymentFor(studentId, monthKey(TODAY));
  if (required.amount === null) return 'Sin cuota definida';
  return 'Pendiente';
}

function planForStudent(studentId) {
  const student = studentById(studentId);
  if (!student?.plan) return noPlanDefined();
  return planByName(student.plan) || noPlanDefined();
}

function planAmount(studentId) {
  return planForStudent(studentId).price;
}

// Cupo del mes segun el plan real del alumno.
// null = sin limite. undefined = plan fuera del catalogo, cupo desconocido:
// no se asume ilimitado, que seria regalar clases que nadie autorizo.
function monthlyAllowanceFor(studentId) {
  const plan = planForStudent(studentId);
  if (plan.needsReview) return undefined;
  return plan.unlimited ? null : plan.monthlyClasses;
}

function attendedThisMonth(studentId) {
  return state.attendanceLog.filter((entry) => entry.studentId === studentId && entry.at.startsWith(monthKey(TODAY))).length;
}

// La lista de una sesion son los alumnos inscritos en esa clase, no un padron
// fijo: asi coincide con lo que se puede marcar y con lo que se guarda.
function rosterFor(classId) {
  return state.students.filter((student) => (student.classIds || []).includes(classId));
}

function currentGuardian() {
  if (isSupabaseConnected) {
    if (authenticatedProfile?.role !== 'guardian') return null;
    const name = `${authenticatedProfile.first_name || ''} ${authenticatedProfile.last_name || ''}`.trim() || authenticatedUser?.email || 'Tutor';
    return {
      id: authenticatedProfile.id,
      name,
      firstName: authenticatedProfile.first_name || 'Tutor',
      phone: authenticatedProfile.phone || '',
      consentSignedAt: authenticatedProfile.consent_signed_at ? dayKey(new Date(authenticatedProfile.consent_signed_at)) : null,
      isDemo: false
    };
  }
  return guardians[0] || null;
}

function childrenOf(guardian) {
  if (isSupabaseConnected) {
    if (!guardian) return [];
    return state.students.filter((student) =>
      student.rawGuardianUuid === guardian.id ||
      student.guardianId === guardian.id ||
      (student.guardianId && student.guardianId === guardian.name)
    );
  }
  return (guardian?.childrenIds || []).map(studentById).filter(Boolean);
}

function attendanceFor(classId, date = TODAY) {
  return state.attendanceLog.filter((entry) => entry.classId === classId && entry.at === dayKey(date)).map((entry) => entry.studentId);
}

// Aca vivian bookClass, cancelBooking y updateStudentPlan. Se retiraron porque
// escribian sobre datos que no les correspondian:
// - Reservar y liberar movian classIds, que es la inscripcion permanente del
//   alumno, no una reserva por sesion. Un alumno "liberando su lugar" se
//   desinscribia de la clase y desaparecia de la lista del maestro.
// - Elegir un plan desde el comparador guardaba en el alumno el titulo
//   combinado de la sugerencia, que no es un plan del catalogo.
// La inscripcion se administra desde administracion; el comparador consulta.

function exportTableToCsv(type) {
  let csvContent = '';
  let filename = '';

  if (type === 'students') {
    filename = `inmotion_alumnos_${dayKey(TODAY)}.csv`;
    const headers = ['ID', 'Nombre', 'Plan', 'Nivel', 'Telefono', 'Tutor', 'Estado'];
    const rows = state.students.map((s) => [
      s.id,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(planForStudent(s.id).planName || '').replace(/"/g, '""')}"`,
      `"${(s.level || '').replace(/"/g, '""')}"`,
      `"${s.phone || ''}"`,
      `"${s.guardianName || ''}"`,
      `"${studentPaymentStatus(s.id)}"`
    ]);
    csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  } else if (type === 'payments') {
    filename = `inmotion_pagos_${dayKey(TODAY)}.csv`;
    const headers = ['ID', 'ID Alumno', 'Alumno', 'Periodo', 'Monto', 'Metodo', 'Estado', 'Fecha Pago'];
    const rows = state.payments.map((p) => {
      const student = studentById(p.studentId);
      return [
        p.id,
        p.studentId,
        `"${(student?.name || '').replace(/"/g, '""')}"`,
        p.period,
        p.amount,
        `"${p.method || ''}"`,
        `"${paymentStatus(p)}"`,
        p.paidAt || ''
      ];
    });
    csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  if (!csvContent) return;

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Descarga lista', `Se generó el archivo ${filename}.`);
}


// Una única bitácora identifica cada sesión por clase y fecha local.
function recordAttendance(classId, studentIds, sessionDate, { replaceDay = false, scope = null } = {}) {
  TODAY = new Date();
  const item = classData.find((entry) => entry.id === classId);
  if (!item || !sessionDate) {
    throw new Error('Solo podés registrar una clase programada válida. Volvé a abrir la sesión.');
  }
  if (studentIds.some((studentId) => !studentById(studentId))) throw new Error('Alumno no encontrado.');
  // La sesión valida la inscripción: evita marcaciones cruzadas entre clases.
  if (studentIds.some((studentId) => !(studentById(studentId).classIds || []).includes(classId))) {
    throw new Error('Solo se puede marcar a alumnos inscritos en esta clase.');
  }
  const sameSession = (entry) => entry.classId === classId && entry.at === sessionDate;
  const nextState = structuredClone(state);
  if (replaceDay) {
    // Con scope, solo se reescriben los alumnos que la lista podía marcar
    const inScope = (entry) => !scope || scope.includes(entry.studentId);
    nextState.attendanceLog = nextState.attendanceLog.filter((entry) => !(sameSession(entry) && inScope(entry)));
  }
  studentIds.forEach((studentId) => {
    if (nextState.attendanceLog.some((entry) => sameSession(entry) && entry.studentId === studentId)) return;
    nextState.attendanceLog.push({ studentId, classId, at: sessionDate });
  });
  persistState(nextState);
}

const GUARDIAN_ID = 'TU-0031';
// La demo entra siempre con la misma alumna: antes su carnet estaba escrito a
// mano en cinco pantallas y cualquier cambio de plan las dejaba en desacuerdo.
const DEMO_STUDENT_ID = 'IM-0241';

// classIds es la inscripcion real del alumno: sin ella no se puede saber cual es
// la proxima clase de un hijo, solo la proxima clase de la academia.
const baseStudentSeed = [
  { id: 'IM-0241', name: 'Valeria Ruiz', initials: 'VR', plan: 'Plan 8 clases', phone: '5555-0142', status: 'Pendiente', level: 'Nivel intermedio', classIds: ['bachata-inter', 'kpop-teens'], guardianId: GUARDIAN_ID },
  { id: 'IM-0262', name: 'Diego Ruiz', initials: 'DR', plan: 'Plan 4 clases', phone: '5555-0177', status: 'Al día', level: '7 a 11 años', classIds: ['latino-kids'], guardianId: GUARDIAN_ID },
  { id: 'IM-0218', name: 'Luis Méndez', initials: 'LM', plan: 'Plan ilimitado', phone: '5555-0188', status: 'Al día', level: 'Nivel avanzado', classIds: ['salsa-casino', 'bachata-inter'] },
  { id: 'IM-0194', name: 'Andrea Pérez', initials: 'AP', plan: 'Plan 8 clases', phone: '5555-0120', status: 'Al día', level: 'Nivel intermedio', classIds: ['bachata-inter', 'latino'] },
  { id: 'IM-0250', name: 'Santiago Cruz', initials: 'SC', plan: 'Plan 4 clases', phone: '5555-0176', status: 'Pendiente', level: 'Nivel inicial', classIds: ['salsa-basico'] },
  { id: 'IM-0207', name: 'Camila Soto', initials: 'CS', plan: 'Plan ilimitado', phone: '5555-0159', status: 'Al día', level: 'Nivel intermedio', classIds: ['bachata-inter', 'latino', 'salsa-casino'] },
  { id: 'IM-0229', name: 'María Fernanda León', initials: 'ML', plan: 'Plan 8 clases', phone: '5555-0134', status: 'Al día', level: 'Nivel inicial', classIds: ['salsa-basico', 'latino'] }
];

function createBaseStudents() {
  return structuredClone(baseStudentSeed);
}

// Los tutores no se editan desde la app: solo se consultan.
const guardians = [
  { id: GUARDIAN_ID, name: 'Carmen Ruiz', initials: 'CR', phone: '5555-0177', childrenIds: ['IM-0241', 'IM-0262'], consentSignedAt: dayKey(addDays(TODAY, -35)), isDemo: true }
];

// El monto de cada mensualidad demo sale del plan del alumno, no de una cifra
// suelta: si un plan cambia de precio, el padron de pagos lo sigue.
function createBasePayments() {
  const rows = [
    { id: 'P-1044', studentId: 'IM-0241', method: 'Pendiente', paid: false, offset: 2 },
    { id: 'P-1043', studentId: 'IM-0218', method: 'Tarjeta', paid: true, offset: -1 },
    { id: 'P-1042', studentId: 'IM-0194', method: 'Transferencia', paid: true, offset: -3 },
    { id: 'P-1041', studentId: 'IM-0250', method: 'Pendiente', paid: false, offset: -6 },
    { id: 'P-1040', studentId: 'IM-0207', method: 'Efectivo', paid: true, offset: -8 },
    { id: 'P-1039', studentId: 'IM-0262', method: 'Efectivo', paid: true, offset: -9 }
  ];
  return rows.map((row) => {
    const seed = baseStudentSeed.find((item) => item.id === row.studentId);
    const date = addDays(TODAY, row.offset);
    return {
      id: row.id,
      studentId: row.studentId,
      student: seed?.name || row.studentId,
      month: monthLabel(TODAY),
      period: monthKey(TODAY),
      amount: (planByName(seed?.plan) || DEFAULT_PLAN).price,
      method: row.method,
      date: row.paid ? shortDate(date) : `${row.offset < 0 ? 'Venció' : 'Vence'} ${shortDate(date)}`,
      // El estado guardado solo distingue pagado / pendiente, igual que lo que
      // acepta sanitizePayment; la mora se deduce de la fecha de vencimiento.
      status: row.paid ? 'Pagado' : 'Pendiente',
      paidAt: row.paid ? dayKey(date) : null,
      dueDate: row.paid ? null : dayKey(date),
      reference: ''
    };
  });
}

const MUSIC_MOODS = [
  { id: 'sed', emoji: '🍺', label: 'Me da sed' },
  { id: 'duela', emoji: '💔', label: 'Subile, que duela' },
  { id: 'perdio', emoji: '💅', label: 'Que vea lo que se perdió' },
  { id: 'fuego', emoji: '🔥', label: 'En todo' },
  { id: 'piso', emoji: '💃', label: 'Pal piso' },
  { id: 'velocidad', emoji: '⚡', label: 'Por lucirme' },
  { id: 'algo-asi', emoji: '🤔', label: 'Algo así dice...' },
  { id: 'prohibidos', emoji: '🕺', label: "Pa' sacar los prohibidos" },
  { id: 'chilera', emoji: '😎', label: 'Ta chilera' },
  { id: 'oila', emoji: '🎧', label: 'Oila' },
  { id: 'chille', emoji: '😭', label: 'Que chille!' }
];

function findMusicMood(moodId) {
  return MUSIC_MOODS.find((m) => m.id === moodId) || MUSIC_MOODS[0];
}

function createBaseMusicSuggestions() {
  return [
    {
      id: 'sug-1',
      studentId: 'IM-0241',
      studentName: 'Valeria Rosales',
      classId: 'bachata-inter',
      className: 'Bachata Intermedio',
      teacherName: 'Alex Aquino',
      song: 'Dile al Amor',
      artist: 'Aventura',
      moodId: 'duela',
      moodEmoji: '💔',
      moodLabel: 'Subile, que duela',
      status: 'accepted',
      liked: true,
      createdAt: dayKey(previousDateFor(3))
    },
    {
      id: 'sug-2',
      studentId: 'IM-0241',
      studentName: 'Valeria Rosales',
      classId: 'bachata-inter',
      className: 'Bachata Intermedio',
      teacherName: 'Alex Aquino',
      song: 'Propuesta Indecente',
      artist: 'Romeo Santos',
      moodId: 'sed',
      moodEmoji: '🍺',
      moodLabel: 'Me da sed',
      status: 'pending',
      liked: false,
      createdAt: dayKey(TODAY)
    },
    {
      id: 'sug-3',
      studentId: 'IM-0218',
      studentName: 'Carlos Gómez',
      classId: 'bachata-inter',
      className: 'Bachata Intermedio',
      teacherName: 'Alex Aquino',
      song: 'Sobredosis',
      artist: 'Romeo Santos ft. Ozuna',
      moodId: 'fuego',
      moodEmoji: '🔥',
      moodLabel: 'En todo',
      status: 'accepted',
      liked: true,
      createdAt: dayKey(previousDateFor(3))
    },
    {
      id: 'sug-4',
      studentId: 'IM-0241',
      studentName: 'Valeria Rosales',
      classId: 'latino',
      className: 'Baile Latino',
      teacherName: 'Alex Aquino',
      song: 'Esa que tiene trompetas',
      artist: 'No me sé el nombre',
      moodId: 'algo-asi',
      moodEmoji: '🤔',
      moodLabel: 'Algo así dice...',
      status: 'pending',
      liked: true,
      createdAt: dayKey(TODAY)
    }
  ];
}

function formatDayKeyReadable(key) {
  if (!key) return '';
  const date = parseDayKey(key);
  return `${WEEKDAY_SHORT[date.getDay()]} ${date.getDate()} de ${monthName(date)}`;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return `${d.getDate()} ${monthName(d).slice(0, 3)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return String(isoStr);
  }
}

function createBaseSinglePasses() {
  return [
    {
      id: 'PASS-8F2K9M',
      code: '8F2K9M',
      type: 'trial',
      isVisitor: true,
      studentId: null,
      studentName: 'Mariana Morales',
      contact: '5555-4421',
      classId: 'bachata-inter',
      className: 'Bachata Intermedio',
      teacher: 'Alex Aquino',
      date: dayKey(TODAY),
      time: '6:00 PM',
      validUntil: `${dayKey(TODAY)}T23:59:59`,
      amount: 60,
      paymentStatus: 'paid',
      paymentMethod: 'Efectivo',
      paidAt: dayKey(TODAY),
      paymentReference: 'REC-0812',
      status: 'available',
      cancelReason: null,
      cancelledAt: null,
      cancelledBy: null,
      attendedAt: null,
      attendedBy: null,
      attendedPendingAuth: false,
      pendingAuthNote: null,
      createdAt: dayKey(TODAY)
    },
    {
      id: 'PASS-4N7Q2P',
      code: '4N7Q2P',
      type: 'private',
      isVisitor: false,
      studentId: 'IM-0218',
      studentName: 'Luis Méndez',
      contact: '5555-0188',
      classId: 'salsa-particular',
      className: 'Técnica de Giros Salsa (Particular)',
      teacher: 'Luis Ramírez',
      date: dayKey(TODAY),
      time: '5:00 PM',
      validUntil: `${dayKey(TODAY)}T23:59:59`,
      amount: 150,
      paymentStatus: 'pending',
      paymentMethod: null,
      paidAt: null,
      paymentReference: '',
      status: 'available',
      cancelReason: null,
      cancelledAt: null,
      cancelledBy: null,
      attendedAt: null,
      attendedBy: null,
      attendedPendingAuth: false,
      pendingAuthNote: null,
      createdAt: dayKey(TODAY)
    },
    {
      id: 'PASS-3T8V5X',
      code: '3T8V5X',
      type: 'trial',
      isVisitor: true,
      studentId: null,
      studentName: 'Esteban Cordón',
      contact: '5555-9012',
      classId: 'kpop-teens',
      className: 'K-Pop Teens',
      teacher: 'Majo Borrayo',
      date: dayKey(previousDateFor(2)),
      time: '5:00 PM',
      validUntil: `${dayKey(previousDateFor(2))}T23:59:59`,
      amount: 60,
      paymentStatus: 'paid',
      paymentMethod: 'Transferencia',
      paidAt: dayKey(previousDateFor(2)),
      paymentReference: 'TRANS-9941',
      status: 'used',
      cancelReason: null,
      cancelledAt: null,
      cancelledBy: null,
      attendedAt: `${dayKey(previousDateFor(2))}T17:05:00`,
      attendedBy: 'Administración (MB)',
      attendedPendingAuth: false,
      pendingAuthNote: null,
      createdAt: dayKey(previousDateFor(2))
    },
    {
      id: 'PASS-6W9X2Y',
      code: '6W9X2Y',
      type: 'trial',
      isVisitor: true,
      studentId: null,
      studentName: 'Carlos Dávila',
      contact: '5555-7788',
      classId: 'salsa-inter',
      className: 'Salsa Intermedio',
      teacher: 'Luis Ramírez',
      date: dayKey(TODAY),
      time: '7:00 PM',
      validUntil: `${dayKey(TODAY)}T23:59:59`,
      amount: 60,
      paymentStatus: 'paid',
      paymentMethod: 'Tarjeta',
      paidAt: dayKey(TODAY),
      paymentReference: 'POS-1192',
      status: 'cancelled',
      cancelReason: 'Alumno notificó cancelación por viaje laboral',
      cancelledAt: `${dayKey(TODAY)}T10:30:00`,
      cancelledBy: 'Administración (MB)',
      attendedAt: null,
      attendedBy: null,
      attendedPendingAuth: false,
      pendingAuthNote: null,
      createdAt: dayKey(TODAY)
    },
    {
      id: 'PASS-5H8J1K',
      code: '5H8J1K',
      type: 'trial',
      isVisitor: true,
      studentId: null,
      studentName: 'Andrea Salazar',
      contact: '5555-3344',
      classId: 'latino-kids',
      className: 'Ritmos Latinos Kids',
      teacher: 'Sofía Castillo',
      date: dayKey(previousDateFor(3)),
      time: '4:00 PM',
      validUntil: `${dayKey(previousDateFor(3))}T23:59:59`,
      amount: 60,
      paymentStatus: 'pending',
      paymentMethod: null,
      paidAt: null,
      paymentReference: '',
      status: 'available',
      cancelReason: null,
      cancelledAt: null,
      cancelledBy: null,
      attendedAt: null,
      attendedBy: null,
      attendedPendingAuth: false,
      pendingAuthNote: null,
      createdAt: dayKey(previousDateFor(3))
    },
    {
      id: 'PASS-4R9T2M',
      code: '4R9T2M',
      type: 'private',
      isVisitor: false,
      studentId: 'IM-0241',
      studentName: 'Valeria Ruiz',
      contact: '5555-0144',
      classId: 'bachata-particular',
      className: 'Bachata Sensual Estilo Femenino',
      teacher: 'Sofía Castillo',
      date: dayKey(addDays(TODAY, 1)),
      time: '6:30 PM',
      validUntil: `${dayKey(addDays(TODAY, 1))}T23:59:59`,
      amount: 180,
      paymentStatus: 'paid',
      paymentMethod: 'Transferencia',
      paidAt: dayKey(TODAY),
      paymentReference: 'TR-5521',
      status: 'available',
      cancelReason: null,
      cancelledAt: null,
      cancelledBy: null,
      attendedAt: null,
      attendedBy: null,
      attendedPendingAuth: false,
      pendingAuthNote: null,
      createdAt: dayKey(TODAY)
    }
  ];
}

function sanitizeSinglePass(raw) {
  if (!isPlainObject(raw)) return null;
  const id = cleanText(raw.id, 40);
  const code = cleanText(raw.code, 20) || (id ? id.replace(/^PASS-/, '') : null);
  if (!id || !code) return null;
  const type = raw.type === 'private' ? 'private' : 'trial';
  const isVisitor = Boolean(raw.isVisitor);
  const studentId = raw.studentId ? cleanText(raw.studentId, 24) : null;
  const studentName = cleanText(raw.studentName, 80);
  if (!studentName) return null;
  const contact = cleanText(raw.contact, 80);
  const classId = cleanText(raw.classId, 40) || 'sesion-particular';
  const className = cleanText(raw.className, 80) || (type === 'trial' ? 'Clase de prueba' : 'Clase particular');
  const teacher = cleanText(raw.teacher, 80) || 'Profesor asignado';
  const date = isValidDayKey(raw.date) ? raw.date : dayKey(TODAY);
  const time = cleanText(raw.time, 30) || '6:00 PM';
  const validUntil = raw.validUntil ? cleanText(raw.validUntil, 35) : `${date}T23:59:59`;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const paymentStatus = raw.paymentStatus === 'paid' ? 'paid' : 'pending';
  const paymentMethod = raw.paymentMethod ? cleanText(raw.paymentMethod, 40) : null;
  const paidAt = isValidDayKey(raw.paidAt) ? raw.paidAt : null;
  const paymentReference = cleanText(raw.paymentReference, 80);
  const status = ['used', 'cancelled'].includes(raw.status) ? raw.status : 'available';
  const cancelReason = raw.cancelReason ? cleanText(raw.cancelReason, 200) : null;
  const cancelledAt = raw.cancelledAt ? cleanText(raw.cancelledAt, 40) : null;
  const cancelledBy = raw.cancelledBy ? cleanText(raw.cancelledBy, 60) : null;
  const attendedAt = raw.attendedAt ? cleanText(raw.attendedAt, 40) : null;
  const attendedBy = raw.attendedBy ? cleanText(raw.attendedBy, 60) : null;
  const attendedPendingAuth = Boolean(raw.attendedPendingAuth);
  const pendingAuthNote = raw.pendingAuthNote ? cleanText(raw.pendingAuthNote, 200) : null;
  const createdAt = isValidDayKey(raw.createdAt) ? raw.createdAt : dayKey(TODAY);

  return {
    id,
    code,
    type,
    isVisitor,
    studentId,
    studentName,
    contact,
    classId,
    className,
    teacher,
    date,
    time,
    validUntil,
    amount,
    paymentStatus,
    paymentMethod,
    paidAt,
    paymentReference,
    status,
    cancelReason,
    cancelledAt,
    cancelledBy,
    attendedAt,
    attendedBy,
    attendedPendingAuth,
    pendingAuthNote,
    createdAt
  };
}

function passById(id) {
  if (!id) return null;
  return (state?.singlePasses || []).find((p) => p.id === id) || null;
}

function passByCode(code) {
  if (!code) return null;
  const clean = String(code).trim().toUpperCase().replace(/^INM-PASS-/, '').replace(/^PASS-/, '');
  return (state?.singlePasses || []).find((p) =>
    p.code.toUpperCase() === clean ||
    p.id.toUpperCase() === String(code).trim().toUpperCase() ||
    p.id.toUpperCase() === `PASS-${clean}` ||
    `INM-PASS-${p.code.toUpperCase()}` === String(code).trim().toUpperCase()
  ) || null;
}

function passStatus(pass) {
  if (!pass) return 'expired';
  if (pass.status === 'cancelled') return 'cancelled';
  if (pass.status === 'used') return 'used';
  const validUntilStr = pass.validUntil || `${pass.date}T23:59:59`;
  const validDate = new Date(validUntilStr);
  const now = new Date();
  if (Number.isNaN(validDate.getTime()) || now > validDate) return 'expired';
  return 'available';
}

function passStatusLabel(status) {
  switch (status) {
    case 'available': return 'Disponible';
    case 'used': return 'Utilizado';
    case 'cancelled': return 'Cancelado';
    case 'expired': return 'Vencido';
    default: return status;
  }
}

function passStatusPillClass(status) {
  switch (status) {
    case 'available': return 'status-pill is-available';
    case 'used': return 'status-pill is-used';
    case 'cancelled': return 'status-pill is-cancelled';
    case 'expired': return 'status-pill is-expired';
    default: return 'status-pill';
  }
}

function passPaymentStatusLabel(paymentStatus) {
  return paymentStatus === 'paid' ? 'Pagado' : 'Pendiente';
}

function passPaymentPillClass(paymentStatus) {
  return paymentStatus === 'paid' ? 'status-pill is-paid' : 'status-pill is-due';
}

function passTypeLabel(type) {
  return type === 'trial' ? 'Clase de prueba' : 'Clase particular';
}

function generatePassCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if ((state?.singlePasses || []).some((p) => p.code === code)) {
    return generatePassCode();
  }
  return code;
}

function passQrMarkup(pass) {
  return `<div class="pass-qr-frame"><strong>Validación por código</strong>
    <p class="pass-qr-caption">QR escaneable pendiente. Presentá el código corto al personal.</p></div>`;
}

// Estas operaciones todavía no tienen persistencia compartida en Supabase.
function allowPassAction(adminOnly = false) {
  TODAY = new Date();
  if (isSupabaseConnected) {
    showToast('Función disponible en la demo', 'Los pases todavía no se sincronizan. No se registró ninguna operación.');
    return false;
  }
  if (!(adminOnly ? activeRole === 'admin' : ['admin', 'teacher'].includes(activeRole))) {
    showToast('Acceso restringido', 'Tu rol no puede realizar esta operación.');
    return false;
  }
  return true;
}

function canUsePass(pass, pending = false) {
  if (!pass || passStatus(pass) !== 'available' || pass.date !== dayKey(new Date()) ||
      pass.paymentStatus !== (pending ? 'pending' : 'paid')) {
    showToast('Pase no disponible', 'Revisá la fecha, el pago y el estado actual del pase.');
    return false;
  }
  return true;
}

// El estado inicial se arma en cada llamada: construido una sola vez al cargar,
// una pestaña abierta desde el mes pasado reiniciaba la demo con fechas viejas.
function createDefaultState() {
  return {
    role: null,
    students: createBaseStudents(),
    payments: createBasePayments(),
    // La bitacora es la fuente de la lista diaria y de la consulta de cada alumno.
    attendanceLog: [
      { studentId: 'IM-0241', classId: 'bachata-inter', at: dayKey(previousDateFor(3)) },
      { studentId: 'IM-0218', classId: 'bachata-inter', at: dayKey(previousDateFor(3)) },
      { studentId: 'IM-0194', classId: 'bachata-inter', at: dayKey(previousDateFor(3)) },
      { studentId: 'IM-0241', classId: 'kpop-teens', at: dayKey(previousDateFor(4)) },
      { studentId: 'IM-0262', classId: 'latino-kids', at: dayKey(previousDateFor(6)) }
    ],
    musicSuggestions: createBaseMusicSuggestions(),
    singlePasses: createBaseSinglePasses()
  };
}

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
const PAYMENT_METHODS = ['Transferencia', 'Efectivo', 'Tarjeta'];
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
  // El plan se conserva tal como vino sin forzar DEFAULT_PLAN
  const plan = raw.plan !== undefined && raw.plan !== null ? cleanText(raw.plan, 80) : null;
  return {
    id,
    profileId: cleanText(raw.profileId, 40) || undefined,
    cardId: cleanText(raw.cardId, 40) || undefined,
    userId: cleanText(raw.userId, 40) || undefined,
    name,
    initials: cleanText(raw.initials, 4) || initials(name),
    memberships: Array.isArray(raw.memberships) ? raw.memberships : [],
    plan,
    phone: cleanText(raw.phone, 24) || 'Sin registrar',
    status: cleanText(raw.status, 20) || 'Pendiente',
    level: cleanText(raw.level, 40) || 'Sin nivel',
    classIds: Array.isArray(raw.classIds) ? [...new Set(raw.classIds.filter((value) => knownClassIds.includes(value)))] : [],
    guardianId: cleanText(raw.guardianId, 40) || (guardians.some((item) => item.id === raw.guardianId) ? raw.guardianId : undefined),
    rawGuardianUuid: cleanText(raw.rawGuardianUuid, 40) || undefined,
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
    id: cleanText(payment.id, 40) || `P-${payment.period}-${studentId}`,
    membershipId: cleanText(payment.membershipId, 40) || undefined,
    remoteId: cleanText(payment.remoteId, 40) || undefined,
    studentId,
    studentUuid: cleanText(payment.studentUuid, 40) || undefined,
    student: cleanText(payment.student, 80) || studentId,
    month: cleanText(payment.month, 40) || monthLabel(parseDayKey(`${payment.period}-01`)),
    period: payment.period,
    amount,
    method: PAYMENT_METHODS.includes(payment.method)
      ? payment.method
      : (payment.method === 'POS' ? 'Tarjeta' : (payment.method === 'Depósito' ? 'Transferencia' : (isPaid ? 'Efectivo' : 'Pendiente'))),
    date: cleanText(payment.date, 60),
    paidAt: isPaid ? paidAt : null,
    dueDate: isPaid ? null : (isValidDayKey(payment.dueDate) ? payment.dueDate : null),
    status: isPaid ? 'Pagado' : 'Pendiente',
    reference: cleanText(payment.reference, 120)
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

function sanitizeMusicSuggestion(raw) {
  if (!isPlainObject(raw)) return null;
  const id = cleanText(raw.id, 24);
  const song = cleanText(raw.song, 80);
  const artist = cleanText(raw.artist, 80);
  const classId = cleanText(raw.classId, 40);
  if (!id || (!song && !artist) || !classId) return null;

  const mood = findMusicMood(raw.moodId);
  return {
    id,
    studentId: cleanText(raw.studentId, 24) || DEMO_STUDENT_ID,
    studentName: cleanText(raw.studentName, 60) || 'Alumno',
    classId,
    className: cleanText(raw.className, 60) || findClass(classId)?.name || 'Clase',
    teacherName: cleanText(raw.teacherName, 60) || findClass(classId)?.teacher || TEACHER_NAME,
    song,
    artist,
    moodId: mood.id,
    moodEmoji: mood.emoji,
    moodLabel: mood.label,
    note: cleanText(raw.note, 160),
    status: raw.status === 'accepted' ? 'accepted' : 'pending',
    liked: Boolean(raw.liked),
    createdAt: isValidDayKey(raw.createdAt) ? raw.createdAt : dayKey(TODAY)
  };
}

function sanitizeState(saved, isConnected = isSupabaseConnected) {
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
  // Sin alumnos la app no tiene nada que mostrar en demo: se vuelve al padrón base.
  // En modo conectado, una respuesta remota vacía se respeta como tal sin inventar alumnos demo.
  const usableStudents = isConnected ? students : (students.length ? students : createBaseStudents());
  if (!isConnected && !students.length && rawStudents.length) dropped.students = rawStudents.length;
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

  // Dos registros con el mismo id hacian que el comprobante abriera el pago
  // equivocado y que una liquidacion reescribiera los dos a la vez.
  const usedIds = new Set();
  payments.forEach((payment) => {
    if (!usedIds.has(payment.id)) {
      usedIds.add(payment.id);
      return;
    }
    let suffix = 2;
    while (usedIds.has(`${payment.id}-${suffix}`)) suffix += 1;
    payment.id = `${payment.id}-${suffix}`;
    usedIds.add(payment.id);
  });

  const rawSuggestions = Array.isArray(saved.musicSuggestions) ? saved.musicSuggestions : [];
  const musicSuggestions = [];
  const seenSugIds = new Set();
  rawSuggestions.forEach((raw) => {
    const sug = sanitizeMusicSuggestion(raw);
    if (!sug || seenSugIds.has(sug.id)) return;
    seenSugIds.add(sug.id);
    musicSuggestions.push(sug);
  });
  const usableMusicSuggestions = isConnected ? musicSuggestions : (musicSuggestions.length ? musicSuggestions : createBaseMusicSuggestions());

  const rawPasses = Array.isArray(saved.singlePasses) ? saved.singlePasses : [];
  const singlePasses = [];
  const seenPassIds = new Set();
  rawPasses.forEach((raw) => {
    const pass = sanitizeSinglePass(raw);
    if (!pass || seenPassIds.has(pass.id)) return;
    seenPassIds.add(pass.id);
    singlePasses.push(pass);
  });
  const usableSinglePasses = isConnected || Array.isArray(saved.singlePasses) ? singlePasses : createBaseSinglePasses();

  const total = dropped.students + dropped.payments + dropped.attendance;
  if (total) recoveryReport = { total, ...dropped };

  return {
    // Un rol desconocido no rompe el arranque: se cae a la pantalla de acceso.
    role: Object.keys(roleConfig).includes(saved.role) ? saved.role : null,
    students: usableStudents,
    payments,
    attendanceLog,
    musicSuggestions: usableMusicSuggestions,
    singlePasses: usableSinglePasses
  };
}

function loadState() {
  const key = getStorageKey();
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(key));
  } catch {
    // Almacenamiento bloqueado o JSON corrupto: arrancamos con estado limpio.
    return isSupabaseConnected ? createEmptyConnectedState() : createDefaultState();
  }
  if (!isPlainObject(saved) || ![2, STATE_VERSION].includes(saved.version)) {
    return isSupabaseConnected ? createEmptyConnectedState() : createDefaultState();
  }
  try {
    return sanitizeState(saved, isSupabaseConnected);
  } catch {
    recoveryReport = { total: 0, students: 0, payments: 0, attendance: 0, fatal: true };
    return isSupabaseConnected ? createEmptyConnectedState() : createDefaultState();
  }
}

let state = loadState();
let activeRole = state.role || 'student';
let activeRoute = 'inicio';
let activeClassId = classData[0].id;
let lastFocusedElement = null;
let activeChildId = null;
let selectedFrequency = 2;
let selectedScheduleClassIds = new Set(['level1-mon', 'level1-wed']);

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
  toastRegion: document.querySelector('#toastRegion'),
  demoBadge: document.querySelector('.demo-badge')
};

function persistState(nextState) {
  try {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify({ ...nextState, version: STATE_VERSION }));
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
    <a class="nav-item ${activeRoute === route ? 'is-active' : ''}" href="#/${escapeHtml(route)}" ${activeRoute === route ? 'aria-current="page"' : ''} data-route="${escapeHtml(route)}">
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
  if (isSupabaseConnected) {
    elements.roleSwitcher.disabled = true;
    elements.roleSwitcher.setAttribute('aria-disabled', 'true');
    elements.roleSwitcher.title = 'Sesión autenticada en Supabase (rol asignado por perfil)';
  } else {
    elements.roleSwitcher.disabled = false;
    elements.roleSwitcher.removeAttribute('aria-disabled');
    elements.roleSwitcher.title = 'Cambiar rol en modo demostración';
  }
  elements.kicker.textContent = config.label;
  const userInitials = (isSupabaseConnected && authenticatedProfile)
    ? (initials(`${authenticatedProfile.first_name || ''} ${authenticatedProfile.last_name || ''}`) || config.initials)
    : config.initials;
  elements.initials.textContent = userInitials;
  elements.date.textContent = longDate(TODAY);
  if (elements.demoBadge) {
    elements.demoBadge.style.cursor = 'pointer';
    if (isSupabaseConnected) {
      elements.demoBadge.innerHTML = `<i class="is-connected" aria-hidden="true"></i> Supabase conectado (${roleConfig[activeRole]?.label || activeRole})`;
    } else if (supabaseSyncError) {
      elements.demoBadge.innerHTML = '<i class="is-offline" aria-hidden="true"></i> Demo local (offline)';
    } else {
      elements.demoBadge.innerHTML = '<i aria-hidden="true"></i> Modo demostración';
    }
  }
}

function enterDemo(role, route = 'inicio') {
  if (!roleConfig[role]) return;
  activeRole = role;
  activeRoute = route;
  persistOrWarn({ ...state, role });
  elements.access.classList.add('is-hidden');
  elements.app.classList.remove('is-hidden');
  history.replaceState(null, '', `#/${route}`);
  renderAndFocus();
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
  elements.menuButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
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
  const errorBanner = (isSupabaseConnected && supabaseSyncError) ? `
    <div class="empty-state" style="margin-bottom:24px;border:1px solid var(--red);text-align:left;">
      <strong style="color:var(--red)">Error de sincronización con Supabase</strong>
      <p class="payment-meta" style="margin:8px 0">${escapeHtml(supabaseSyncError)}</p>
      <button class="button button--red button--small" type="button" id="retrySupabaseSync">Reintentar conexión</button>
    </div>
  ` : '';
  elements.content.innerHTML = `<div class="page-enter">${errorBanner}${renderer()}</div>`;
  document.querySelector('#retrySupabaseSync')?.addEventListener('click', async () => {
    const btn = document.querySelector('#retrySupabaseSync');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Reintentando...';
    }
    await syncWithSupabase();
  });
  setMenuOpen(false);
  window.scrollTo({ top: 0, behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
}

// Cerrar un dialogo devuelve el foco al boton que lo abrio, pero el render
// posterior reemplaza ese boton y el foco cae al body. Estos flujos dejan el
// foco en el contenido principal, que es donde sigue la lectura.
function renderAndFocus() {
  renderApp();
  elements.content.focus({ preventScroll: true });
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
    const isToday = daysBetween(date) === 0;
    const dateKeyStr = dayKey(date);
    return `<button class="day-pill is-clickable ${isToday ? 'is-today' : ''}" type="button" data-calendar-jump="${escapeHtml(dateKeyStr)}" aria-label="Ver clases del ${escapeHtml(longDate(date))}: ${total ? `${total} clase${total === 1 ? '' : 's'}` : 'sin clases'}">
      <span>${escapeHtml(WEEKDAY_SHORT[date.getDay()])}</span><strong>${escapeHtml(date.getDate())}</strong><small>${escapeHtml(note)}</small>
    </button>`;
  }).join('')}</div>`;
}

function classCards(classes = scheduledClasses().slice(0, 3), empty = null) {
  if (!classes.length) {
    return `<div class="empty-state"><strong>${escapeHtml(empty?.title || 'Sin clases')}</strong>${escapeHtml(empty?.detail || 'No hay clases programadas en esta demostración.')}</div>`;
  }
  return `<div class="cards-grid">${classes.map((item, index) => {
    const contextDateKey = item.date ? dayKey(item.date) : '';
    const dateLabelStr = item.fullDateLabel || (item.date ? longDate(item.date) : item.dateLabel);
    return `
    <article class="class-card ${index === 0 ? 'is-featured' : ''}">
      <span class="class-card-index">0${index + 1}</span>
      <div class="class-card-top">
        <span class="tag ${index === 0 ? 'tag--dark' : ''}">${escapeHtml(item.day)} · ${escapeHtml(item.time)}</span>
        ${index === 0 ? '<span class="status-dot">Inscripta</span>' : ''}
      </div>
      <h3>${escapeHtml(item.name)}</h3>
      <p class="class-card-date">${escapeHtml(dateLabelStr)}</p>
      <p>${escapeHtml(item.teacher)} · ${escapeHtml(item.room)}</p>
      <div class="class-card-foot">
        <span>${escapeHtml(item.level)}</span>
        <div class="class-card-actions">
          <button class="button button--small button--light" type="button" data-class-detail="${escapeHtml(item.id)}" data-context-date="${escapeHtml(contextDateKey)}" aria-label="Ver detalles de ${escapeHtml(item.name)}">Ver detalles</button>
          <button class="button button--small button--light" type="button" data-open-music-modal="${escapeHtml(item.id)}" aria-label="Sugerir rola para ${escapeHtml(item.name)}">Rola 🎶</button>
        </div>
      </div>
    </article>
  `;
  }).join('')}</div>`;
}

function scheduleList(classes = scheduledClasses()) {
  if (!classes.length) return `<div class="schedule-empty"><span class="eyebrow">Un espacio para practicar</span><h2>No hay clases con este filtro.</h2><p>Probá otro nivel o consultá la agenda completa.</p><button class="button button--light" type="button" data-class-filter="all">Ver todas las clases</button></div>`;
  return `<div class="schedule-list">${classes.map((item) => `
    <div class="schedule-row">
      <div class="schedule-time">${escapeHtml(item.time)}<small>${escapeHtml(item.day)} · ${escapeHtml(item.dateLabel)}</small></div>
      <div class="schedule-name"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.level)} · ${escapeHtml(item.room)}</small></div>
      <div class="schedule-teacher">${escapeHtml(item.teacher)}<small>Maestro</small></div>
      <span class="capacity">${escapeHtml(capacityText(item))} cupos</span>
      <button class="button button--light button--small" type="button" data-class-detail="${escapeHtml(item.id)}" aria-label="Ver clase ${escapeHtml(item.name)}, ${escapeHtml(item.day)} ${escapeHtml(item.time)}">Ver clase</button>
    </div>
  `).join('')}</div>`;
}

let currentSelectedMoodId = 'sed';
let musicTeacherFilter = 'all';

function nextMusicSuggestionId() {
  const nums = (state?.musicSuggestions || [])
    .map((s) => Number(String(s.id).replace(/\D/g, '')))
    .filter(Number.isFinite);
  const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
  return `sug-${nextNum}`;
}

function studentMusicSection() {
  const student = currentStudent();
  if (isSupabaseConnected && !student) {
    return `
      <section class="section music-section">
        <div class="section-head">
          <div>
            <span class="eyebrow">La Rockola In Motion</span>
            <h2>Pedí tu rola para la clase</h2>
            <p>Elegí una de tus clases y sugerile una canción a tu maestro.</p>
          </div>
        </div>
        <div class="empty-state">
          <strong>Sin ficha de alumno</strong>
          Tu usuario no tiene una ficha de estudiante vinculada para sugerir canciones.
        </div>
      </section>
    `;
  }
  const suggestions = student ? (state.musicSuggestions || []).filter((s) => s.studentId === student.id) : [];
  const enrolledClasses = student ? classesForStudent(student.id) : [];

  return `
    <section class="section music-section">
      <div class="section-head">
        <div>
          <span class="eyebrow">La Rockola In Motion</span>
          <h2>Pedí tu rola para la clase</h2>
          <p>Elegí una de tus clases y sugerile una canción a tu maestro.</p>
        </div>
      </div>

      <div class="music-class-picker">
        <p class="music-picker-label">1. Elegí tu clase para sugerir:</p>
        <div class="music-picker-grid">
          ${enrolledClasses.map((c) => `
            <button type="button" class="music-class-btn" data-open-music-modal="${escapeHtml(c.id)}">
              <span class="music-class-btn-icon" aria-hidden="true">🎵</span>
              <span class="music-class-btn-info">
                <strong>${escapeHtml(c.name)}</strong>
                <small>${escapeHtml(c.teacher)} · ${escapeHtml(c.time)}</small>
              </span>
              <span class="music-class-btn-action" aria-hidden="true">Sugerir rola ↗</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="music-suggestions-list-block">
        <div class="music-subhead">
          <h3>Tus rolas sugeridas</h3>
          <span class="music-count-badge">${suggestions.length} rola${suggestions.length === 1 ? '' : 's'}</span>
        </div>

        ${suggestions.length === 0 ? `
          <div class="empty-state">
            <strong>Sin rolas sugeridas todavía</strong>
            <p>Elegí una de tus clases arriba para sugerir tu primera canción.</p>
          </div>
        ` : `
          <div class="music-cards-grid">
            ${suggestions.map((item) => `
              <article class="music-card ${item.status === 'accepted' ? 'is-accepted' : ''}">
                <div class="music-card-header">
                  <span class="mood-badge mood-badge--${escapeHtml(item.moodId)}">
                    <span class="mood-emoji" aria-hidden="true">${escapeHtml(item.moodEmoji)}</span>
                    <span>${escapeHtml(item.moodLabel)}</span>
                  </span>
                  <span class="music-status-pill ${item.status === 'accepted' ? 'is-accepted' : 'is-pending'}">
                    ${item.status === 'accepted' ? '🎧 En playlist' : '⏳ Enviada'}
                  </span>
                </div>
                <div class="music-card-body">
                  <h3 class="music-song-title">${escapeHtml(item.song || 'Cualquier rola')}</h3>
                  <p class="music-song-artist">${escapeHtml(item.artist || 'Artista sin especificar')}</p>
                  <div class="music-class-meta">
                    <span>${escapeHtml(item.className)}</span> · <small>Profe ${escapeHtml(item.teacherName)}</small>
                  </div>
                </div>
                <div class="music-card-footer">
                  ${item.liked ? '<span class="music-badge-liked" title="Al maestro le encantó tu sugerencia">❤️ Al profe le gustó</span>' : '<span class="music-pending-label">Esperando al profe</span>'}
                </div>
              </article>
            `).join('')}
          </div>
        `}
      </div>
    </section>
  `;
}

function teacherMusicSection() {
  const teacher = currentTeacher();
  const allSuggestions = state.musicSuggestions || [];
  const teacherClassIds = teacherClasses().map((c) => c.id);
  const forTeacher = teacher
    ? allSuggestions.filter((s) => (s.teacherName && s.teacherName === teacher.name) || teacherClassIds.includes(s.classId))
    : [];

  const filtered = musicTeacherFilter === 'pending'
    ? forTeacher.filter((s) => s.status === 'pending')
    : musicTeacherFilter === 'accepted'
      ? forTeacher.filter((s) => s.status === 'accepted')
      : forTeacher;

  const pendingCount = forTeacher.filter((s) => s.status === 'pending').length;

  return `
    <section class="section music-section">
      <div class="section-head">
        <div>
          <h2>Sugerido por los alumnos</h2>
        </div>
        <div class="filter-group" role="group" aria-label="Filtrar rolas de alumnos">
          <button type="button" class="filter-chip ${musicTeacherFilter === 'all' ? 'is-active' : ''}" data-teacher-music-filter="all">
            Todas (${forTeacher.length})
          </button>
          <button type="button" class="filter-chip ${musicTeacherFilter === 'pending' ? 'is-active' : ''}" data-teacher-music-filter="pending">
            Pendientes (${pendingCount})
          </button>
          <button type="button" class="filter-chip ${musicTeacherFilter === 'accepted' ? 'is-active' : ''}" data-teacher-music-filter="accepted">
            En playlist (${forTeacher.length - pendingCount})
          </button>
        </div>
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state">
          <strong>Sin rolas en esta lista</strong>
          <p>No hay canciones con el filtro seleccionado.</p>
        </div>
      ` : `
        <div class="music-cards-grid music-cards-grid--teacher">
          ${filtered.map((item) => `
            <article class="music-card ${item.status === 'accepted' ? 'is-accepted' : ''}">
              <div class="music-card-header">
                <div class="music-student-info">
                  <span class="avatar-mini" aria-hidden="true">${escapeHtml(initials(item.studentName))}</span>
                  <div>
                    <strong>${escapeHtml(item.studentName)}</strong>
                    <small>${escapeHtml(item.className)}</small>
                  </div>
                </div>
                <span class="mood-badge mood-badge--${escapeHtml(item.moodId)}">
                  <span class="mood-emoji" aria-hidden="true">${escapeHtml(item.moodEmoji)}</span>
                  <span>${escapeHtml(item.moodLabel)}</span>
                </span>
              </div>

              <div class="music-card-body">
                <h3 class="music-song-title">${escapeHtml(item.song || 'Cualquier rola')}</h3>
                <p class="music-song-artist">${escapeHtml(item.artist || 'Artista sin especificar')}</p>
              </div>

              <div class="music-card-footer music-card-footer--teacher">
                <button 
                  type="button" 
                  class="button button--small ${item.status === 'accepted' ? 'button--light is-accepted-btn' : 'button--red'}" 
                  data-toggle-music-status="${escapeHtml(item.id)}"
                  title="${item.status === 'accepted' ? 'Quitar de la playlist' : 'Aprobar para la clase'}"
                >
                  ${item.status === 'accepted' ? '✓ En playlist' : '🎧 Sumar a playlist'}
                </button>

                <button 
                  type="button" 
                  class="icon-action-btn ${item.liked ? 'is-liked' : ''}" 
                  data-toggle-music-like="${escapeHtml(item.id)}"
                  aria-label="${item.liked ? 'Quitar like' : 'Dar me gusta'}"
                  title="${item.liked ? 'Te gustó' : 'Dar me gusta'}"
                >
                  <span aria-hidden="true">${item.liked ? '❤️' : '🤍'}</span>
                </button>
              </div>
            </article>
          `).join('')}
        </div>
      `}
    </section>
  `;
}

function openMusicSuggestionModal(preselectedClassId = null) {
  const student = currentStudent();
  if (!student) {
    showToast('Acción no disponible', 'No tienes un carné o perfil de alumno vinculado.');
    return;
  }
  const studentClasses = classesForStudent(student.id);
  const options = studentClasses.length ? studentClasses : classData;
  const defaultClassId = preselectedClassId || options[0]?.id || 'bachata-inter';
  const targetClass = findClass(defaultClassId) || options[0];
  const randomMood = MUSIC_MOODS[Math.floor(Math.random() * MUSIC_MOODS.length)] || MUSIC_MOODS[0];
  currentSelectedMoodId = randomMood.id;

  openModal({
    title: 'Sugerir rola',
    eyebrow: `${targetClass.name} · ${targetClass.teacher}`,
    body: `
      <form id="musicSuggestionForm" class="music-suggestion-form">
        <label class="field">
          <span>Clase</span>
          <select name="classId" id="musicClassId" required>
            ${options.map((item) => `
              <option value="${escapeHtml(item.id)}" ${item.id === defaultClassId ? 'selected' : ''}>
                ${escapeHtml(item.name)} · ${escapeHtml(item.teacher)}
              </option>
            `).join('')}
          </select>
        </label>

        <div class="split-fields">
          <label class="field">
            <span>Canción</span>
            <input type="text" name="song" id="musicSongInput" placeholder="Nombre o tarareo" />
          </label>
          <label class="field">
            <span>Artista</span>
            <input type="text" name="artist" id="musicArtistInput" placeholder="Artista o grupo" />
          </label>
        </div>

        <div class="field">
          <div class="mood-header-row">
            <span>Elegí la etiqueta</span>
            <button type="button" class="mood-random-btn" data-randomize-mood title="Cambiar etiqueta al azar">🎲 Otra al azar</button>
          </div>
          <div class="music-mood-grid" role="radiogroup" aria-label="Elegir etiqueta">
            ${MUSIC_MOODS.map((m) => `
              <button 
                type="button" 
                class="mood-chip ${m.id === currentSelectedMoodId ? 'is-selected' : ''}" 
                data-select-mood="${escapeHtml(m.id)}"
                role="radio"
                aria-checked="${m.id === currentSelectedMoodId ? 'true' : 'false'}"
              >
                <span class="mood-chip-emoji">${escapeHtml(m.emoji)}</span>
                <span class="mood-chip-title">${escapeHtml(m.label)}</span>
              </button>
            `).join('')}
          </div>
          <input type="hidden" name="moodId" id="selectedMoodIdInput" value="${escapeHtml(currentSelectedMoodId)}" />
        </div>

        <div class="form-actions">
          <button class="button button--light" type="button" data-close-modal>Cancelar</button>
          <button class="button button--red" type="submit">Enviar sugerencia 🎶</button>
        </div>
      </form>
    `
  });
}

function handleMusicSuggestionSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const classId = formData.get('classId');
  const song = (formData.get('song') || '').trim();
  const artist = (formData.get('artist') || '').trim();
  const moodId = formData.get('moodId') || currentSelectedMoodId || 'sed';

  if (!song && !artist) {
    showToast('Faltan datos', 'Ingresá al menos la canción o el artista.');
    return;
  }

  const student = currentStudent();
  if (!student) {
    showToast('Acción no disponible', 'No tienes una ficha de alumno vinculada para enviar sugerencias.');
    return;
  }

  const mood = findMusicMood(moodId);
  const targetClass = findClass(classId) || scheduledClasses()[0];

  const newSuggestion = {
    id: nextMusicSuggestionId(),
    studentId: student.id,
    studentName: student.name || 'Alumno',
    classId: targetClass.id,
    className: targetClass.name,
    teacherName: targetClass.teacher,
    song,
    artist,
    moodId: mood.id,
    moodEmoji: mood.emoji,
    moodLabel: mood.label,
    status: 'pending',
    liked: false,
  };

  const nextSuggestions = [newSuggestion, ...(state.musicSuggestions || [])];
  persistOrWarn({ ...state, musicSuggestions: nextSuggestions });

  closeModal();
  renderAndFocus();
  const displayTitle = song || (artist ? `rola de ${artist}` : 'tu rola');
  showToast('¡Rola enviada! 🎶', `Le sugeriste "${displayTitle}" al profe ${targetClass.teacher} con la etiqueta "${mood.emoji} ${mood.label}".`);
}

function renderStudentHome() {
  const student = currentStudent();
  if (isSupabaseConnected && !student) {
    return `
      <section class="student-hero">
        <div class="student-hero-copy">
          <div>
            <p class="eyebrow">${escapeHtml(shortDayLabel(TODAY))}</p>
            <h1 class="hero-title">Hola.<br/><span>Sin alumno vinculado.</span></h1>
          </div>
        </div>
      </section>
      <div class="empty-state">
        <strong>Ficha de alumno no vinculada</strong>
        Tu usuario autenticado (${escapeHtml(authenticatedUser?.email || '')}) no tiene un perfil de estudiante o carné asignado en la academia. Contactá a administración.
      </div>
    `;
  }
  const studentId = student?.id || DEMO_STUDENT_ID;
  const plan = planForStudent(studentId);
  const firstName = (student?.name || 'Valeria').split(' ')[0];
  const attended = attendedThisMonth(studentId);
  const allowance = monthlyAllowanceFor(studentId);
  const checkedIn = state.attendanceLog.some((entry) => entry.studentId === studentId && entry.at === dayKey(TODAY));
  // Sin cupo no hay resta posible: el plan ilimitado se cuenta, no se descuenta.
  // Un plan fuera del catalogo tampoco se descuenta, pero por otra razon: no
  // sabemos cual es su cupo y no se inventa uno.
  const allowanceUnknown = allowance === undefined;
  const remaining = allowance === null || allowanceUnknown ? null : Math.max(0, allowance - attended);
  const payment = monthlyPaymentFor(studentId);
  const paid = payment?.status === 'Pagado';
  const own = upcomingClasses(classesForStudent(studentId));
  const next = own[0];
  const [hour, meridiem] = next?.time.split(' ') || [];
  const allowanceLine = allowanceUnknown
    ? 'Cupo mensual por confirmar'
    : allowance === null
      ? 'Asistencia sin límite este mes'
      : `${remaining} de ${allowance} disponibles este mes`;
  const attendanceNote = allowanceUnknown
    ? `Llevás ${attended} clase${attended === 1 ? '' : 's'} este mes. El plan guardado no está en el catálogo de la demo, así que su cupo está por confirmar.`
    : allowance === null
    ? `Llevás ${attended} clase${attended === 1 ? '' : 's'} este mes. Tu plan no descuenta clases.`
    : attended > allowance
      ? `Ya superaste las ${allowance} clases del plan. Consultá las condiciones en recepción.`
      : remaining === 0
        ? `Usaste las ${allowance} clases del plan este mes.`
        : `${remaining} clase${remaining === 1 ? '' : 's'} disponible${remaining === 1 ? '' : 's'} este mes.`;
  return `
    <section class="student-hero">
      <div class="student-hero-copy">
        <div>
          <p class="eyebrow">${escapeHtml(shortDayLabel(TODAY))}</p>
          <h1 class="hero-title">Hola, ${escapeHtml(firstName)}.<br/><span>¿Bailamos?</span></h1>
        </div>
        <div class="hero-foot">
          <button class="button button--red" type="button" data-go="carnet">Mostrar mi carné <span aria-hidden="true">→</span></button>
          <p>${checkedIn ? 'Tu asistencia de hoy ya quedó registrada en esta demo.' : 'Mostrá tu carné en recepción al llegar a la academia.'}</p>
        </div>
      </div>
      <aside class="next-class ${next ? 'is-clickable' : 'is-empty'}" ${next ? `data-class-detail="${escapeHtml(next.id)}" data-context-date="${escapeHtml(dayKey(next.date))}" role="button" tabindex="0" aria-label="Ver detalles de la próxima clase: ${escapeHtml(next.name)}, ${escapeHtml(next.fullDateLabel)} a las ${escapeHtml(next.time)}"` : ''}>
        <div class="next-class-label">
          <span>Próxima clase</span>
          <span>${next?.isOngoing ? 'En curso' : '01'}</span>
        </div>
        ${next ? `
          <time>
            <strong>${escapeHtml(hour)}</strong>
            <span>${escapeHtml(meridiem)} · ${escapeHtml(next.day)}</span>
          </time>
          <div class="next-class-info">
            <h2>${escapeHtml(next.name)}</h2>
            <p class="next-class-date">📅 ${escapeHtml(next.fullDateLabel)}</p>
            <p>${escapeHtml(next.teacher)} · ${escapeHtml(next.room)}</p>
            <div class="next-class-btn-wrap">
              <span class="next-class-cta">Ver detalles de la clase <span aria-hidden="true">→</span></span>
            </div>
          </div>
        ` : `
          <div class="next-class-empty-box">
            <p class="next-class-empty-title">Sin próximas clases programadas</p>
            <p class="next-class-empty-text">No tenés clases asignadas para los próximos días. Consultá el calendario para ver los horarios de la academia.</p>
            <button class="button button--small button--light" type="button" data-go="clases">Ver calendario de clases →</button>
          </div>
        `}
      </aside>
    </section>

    <div class="journey-actions" role="group" aria-label="Explorá la academia">
      <button type="button" data-go="planes"><span class="journey-icon">${icon('money')}</span><span><strong>Encontrá tu plan</strong><small>Compará opciones a tu ritmo</small></span><span aria-hidden="true">↗</span></button>
      <a href="../index.html"><span class="journey-icon">▷</span><span><strong>Videos para practicar</strong><small>Explorá los recaps y movimientos</small></span><span aria-hidden="true">↗</span></a>
    </div>
    <section class="section">
      <div class="section-head"><div><h2>Esta semana</h2><p>Tu agenda de clases del ${escapeHtml(weekRange())}.</p></div><button class="text-button" type="button" data-go="clases">Ver calendario →</button></div>
      ${weekStrip(classesForStudent(studentId))}
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Tus próximas clases</h2><p>${escapeHtml(plan.planName)} · ${escapeHtml(allowanceLine)}</p></div></div>
      ${classCards(own, { title: 'Sin clases asignadas', detail: 'Todavía no tenés inscripciones en esta demostración. Consultá el calendario para ver los horarios.' })}
    </section>

    <section class="section split-grid">
      <article class="surface-card">
        <p class="eyebrow">Mensualidad · ${escapeHtml(monthName(TODAY))}</p>
        <div class="payment-status">
          <div><p class="payment-amount">Q ${escapeHtml(payment ? formatAmount(payment.amount) : '—')}</p><p class="payment-meta">${escapeHtml(paymentStatus(payment))} · ${escapeHtml(paymentDateText(payment))}<br/>${escapeHtml(plan.planName)} · ${escapeHtml(priceText(plan.price))}${plan.needsReview ? '' : ' al mes'}</p></div>
          <button class="button ${paid ? 'button--light' : ''}" type="button" data-student-payment>${paid ? 'Ver comprobante' : 'Ver detalle'}</button>
        </div>
      </article>
      <article class="surface-card">
        <p class="eyebrow">Asistencia del mes</p>
        ${allowance === null || allowanceUnknown
          ? `<h2>${attended} clase${attended === 1 ? '' : 's'} este mes</h2>`
          : `<h2>${attended} de ${allowance} clases</h2><progress class="attendance-progress" value="${Math.min(attended, allowance)}" max="${allowance}" aria-label="Clases asistidas este mes">${attended} de ${allowance}</progress>`}
        <p class="payment-meta">${escapeHtml(attendanceNote)}</p>
      </article>
    </section>

    ${studentMusicSection()}
  `;
}

// ---------------------------------------------------------------------------
// Motor de recomendación de pases y parqueo (SelectorPlanes)
// ---------------------------------------------------------------------------
function parkingForScheduleSelection(classes) {
  const uniqueDays = [...new Set(classes.map((item) => item.day))];
  return uniqueDays.reduce((total, day) => {
    const dayInfo = SCHEDULE_DAYS.find((candidate) => candidate.id === day);
    return total + (dayInfo?.type === 'weekend' ? 20 : 15);
  }, 0);
}

function summarizePassParts(parts) {
  const counts = parts.reduce((summary, part) => {
    summary.set(part, (summary.get(part) || 0) + 1);
    return summary;
  }, new Map());

  return [...counts.entries()]
    .map(([name, count]) => (count > 1 ? `${name} x${count}` : name))
    .join(' + ');
}

function compareRecommendations(a, b) {
  if (a.total !== b.total) return a.total - b.total;
  if (a.monthly !== b.monthly) return a.monthly - b.monthly;
  return a.title.localeCompare(b.title, 'es');
}

function buildScheduleRecommendations(classes) {
  if (!classes.length) return [];

  const full = {
    id: 'full',
    title: PASS_PLANS.full.name,
    monthly: PASS_PLANS.full.price,
    parking: 0,
    total: PASS_PLANS.full.price,
    note: 'Acceso ilimitado a todas las clases y horarios. La simulación asume que cubre hasta 3 horas de parqueo por visita; queda por confirmar con la academia.'
  };

  const weekdayClasses = classes.filter((item) => item.category === 'weekday');
  const teenClasses = classes.filter((item) => item.category === 'teen');
  const weekendClasses = classes.filter((item) => item.category === 'weekend');
  const regularParking = parkingForScheduleSelection(classes);
  const options = [];

  const weekdayOptions = buildWeekdayOptions(weekdayClasses);
  const weekendOption = buildWeekendOption(weekendClasses);
  const teensOption = buildTeensOption(teenClasses);

  if (weekdayOptions.length || weekendOption || teensOption) {
    const requiredBlocks = [
      weekdayOptions.length ? weekdayOptions : [{ parts: [], monthly: 0, note: '' }],
      weekendOption ? [weekendOption] : [{ parts: [], monthly: 0, note: '' }],
      teensOption ? [teensOption] : [{ parts: [], monthly: 0, note: '' }]
    ];

    for (const weekday of requiredBlocks[0]) {
      for (const weekend of requiredBlocks[1]) {
        for (const teens of requiredBlocks[2]) {
          const parts = [...weekday.parts, ...weekend.parts, ...teens.parts];
          if (!parts.length) continue;

          const monthly = weekday.monthly + weekend.monthly + teens.monthly;
          options.push({
            id: parts.join('-'),
            title: summarizePassParts(parts),
            monthly,
            parking: regularParking,
            total: monthly + regularParking,
            note: [weekday.note, weekend.note, teens.note].filter(Boolean).join(' ')
          });
        }
      }
    }
  }

  return dedupeRecommendations([...options, full]).sort(compareRecommendations);
}

function buildWeekdayOptions(weekdayClasses) {
  if (!weekdayClasses.length) return [];

  const tracks = [...new Set(weekdayClasses.map((item) => item.track))];
  const dancerOption = {
    parts: tracks.map(() => PASS_PLANS.dancer.name),
    monthly: tracks.length * PASS_PLANS.dancer.price,
    note:
      tracks.length === 1
        ? `Dancer Pass para ${SCHEDULE_TRACKS[tracks[0]] || tracks[0]}.`
        : `Dancer Pass por cada track seleccionado (${tracks.length}).`
  };

  return [
    dancerOption,
    {
      parts: [PASS_PLANS.night.name],
      monthly: PASS_PLANS.night.price,
      note: 'Night Pass cubre las clases seleccionadas de lunes a jueves.'
    }
  ];
}

function buildWeekendOption(weekendClasses) {
  if (!weekendClasses.length) return null;

  const weekendDays = [...new Set(weekendClasses.map((item) => item.day))];
  return {
    parts: weekendDays.map(() => PASS_PLANS.weekend.name),
    monthly: weekendDays.length * PASS_PLANS.weekend.price,
    note: `Weekend Pass aplicado a ${weekendDays.length} día${weekendDays.length > 1 ? 's' : ''} de fin de semana.`
  };
}

function buildTeensOption(teenClasses) {
  if (!teenClasses.length) return null;

  return {
    parts: [PASS_PLANS.teens.name],
    monthly: PASS_PLANS.teens.price,
    note: 'Teens In Motion cubre las clases Teens del sábado.'
  };
}

function dedupeRecommendations(recommendations) {
  const byKey = new Map();

  for (const recommendation of recommendations) {
    const key = `${recommendation.title}|${recommendation.monthly}|${recommendation.parking}`;
    const current = byKey.get(key);
    if (!current || recommendation.total < current.total) {
      byKey.set(key, recommendation);
    }
  }

  return [...byKey.values()];
}

function renderSchedulePosterGrid() {
  const timeColumn = `
    <article class="schedule-poster-col schedule-time-col">
      <div class="schedule-col-header">Hora</div>
      <div class="schedule-slots-list">
        ${SCHEDULE_TIME_SLOTS.map((slot) => `<div class="schedule-cell is-time">${escapeHtml(slot.label)}</div>`).join('')}
      </div>
    </article>
  `;

  const dayColumns = SCHEDULE_DAYS.map((day) => {
    const cells = SCHEDULE_TIME_SLOTS.map((slot) => {
      const item = SCHEDULE_CLASSES.find((c) => c.day === day.id && c.slot === slot.id);
      if (!item) {
        return '<div class="schedule-cell"></div>';
      }
      const isSelected = selectedScheduleClassIds.has(item.id);
      return `
        <div class="schedule-cell has-class">
          <button type="button" class="schedule-class-card ${isSelected ? 'is-selected' : ''}" data-toggle-schedule-class="${escapeHtml(item.id)}" aria-pressed="${isSelected}" aria-label="${escapeHtml(item.name)}, ${escapeHtml(day.label)} ${escapeHtml(item.time)}">
            <span class="schedule-track-dot" style="background-color: ${escapeHtml(item.color)};" aria-hidden="true"></span>
            <span class="schedule-class-body">
              <strong class="schedule-class-title">${escapeHtml(item.name)}</strong>
              <span class="schedule-class-time">${escapeHtml(item.time)}</span>
            </span>
          </button>
        </div>
      `;
    }).join('');

    return `
      <article class="schedule-poster-col">
        <div class="schedule-col-header ${day.type === 'weekend' ? 'is-weekend' : ''}">${escapeHtml(day.label)}</div>
        <div class="schedule-slots-list">
          ${cells}
        </div>
      </article>
    `;
  }).join('');

  return timeColumn + dayColumns;
}

function renderScheduleSelectionSummary() {
  const classes = SCHEDULE_CLASSES.filter((item) => selectedScheduleClassIds.has(item.id));
  if (!classes.length) {
    return `
      <div class="selection-empty">
        <strong>0 clases seleccionadas</strong>
        <p>Hacé clic en una o más casillas del calendario para comparar planes.</p>
      </div>
    `;
  }
  const days = [...new Set(classes.map((item) => SCHEDULE_DAYS.find((d) => d.id === item.day)?.label || item.day))];
  return `
    <div class="selection-info">
      <div class="selection-count-tag">${classes.length} clase${classes.length > 1 ? 's' : ''}</div>
      <p class="selection-days">${days.length} día${days.length > 1 ? 's' : ''} de visita: <strong>${escapeHtml(days.join(', '))}</strong></p>
      <ul class="selection-class-list">
        ${classes.map((c) => `<li>${escapeHtml(SCHEDULE_DAYS.find((d) => d.id === c.day)?.label || c.day)} · ${escapeHtml(c.time)} · ${escapeHtml(c.name)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderScheduleRecommendations() {
  const classes = SCHEDULE_CLASSES.filter((item) => selectedScheduleClassIds.has(item.id));
  const recommendations = buildScheduleRecommendations(classes);

  if (!recommendations.length) {
    return `
      <div class="schedule-empty-rec">
        <p><strong>Las sugerencias aparecerán aquí</strong> al marcar las clases que querés tomar.</p>
      </div>
    `;
  }

  const cards = recommendations.map((rec, index) => {
    const isBest = index === 0;
    const student = currentStudent();
    const currentPlan = (activeRole === 'student' && student) ? planForStudent(student.id) : null;
    const isCurrentPlan = currentPlan && (currentPlan.planName.toLowerCase() === rec.title.toLowerCase() || currentPlan.name.toLowerCase() === rec.title.toLowerCase());
    return `
      <article class="rec-card ${isBest ? 'is-best' : ''}">
        <div class="rec-header">
          <h3 class="rec-title">${escapeHtml(rec.title)}</h3>
          ${isBest ? '<span class="badge badge--best">✦ Recomendado</span>' : ''}
        </div>
        <div class="rec-prices">
          <div class="price-row">
            <span>Mensualidad</span>
            <strong>Q ${escapeHtml(formatAmount(rec.monthly))}</strong>
          </div>
          <div class="price-row">
            <span>Parqueo estimado</span>
            <strong>${rec.parking === 0 ? 'Incluido' : `Q ${escapeHtml(formatAmount(rec.parking))}`}</strong>
          </div>
          <div class="price-row total-row">
            <span>Total mensual estimado</span>
            <strong>Q ${escapeHtml(formatAmount(rec.total))}</strong>
          </div>
        </div>
        <p class="rec-note">${escapeHtml(rec.note)}</p>
        <p class="rec-subnote">Estimación demo; no incluye posibles cargos iniciales. Confirmá el precio final con la academia.</p>
        <div class="rec-actions">
          ${isCurrentPlan
            ? '<span class="tag tag--dark" style="margin-top:10px;width:100%;text-align:center;display:block;padding:8px 0;">Tu plan actual ✓</span>'
            : '<p class="rec-subnote">Comparación estimada. Para contratar este pase, confirmá condiciones y precios vigentes con la academia.</p>'
          }
        </div>
      </article>
    `;
  });
  return cards[0] + (cards.length > 1 ? `<details class="plan-alternatives"><summary>Comparar otras opciones (${cards.length - 1})</summary>${cards.slice(1).join('')}</details>` : '');

}

function updateScheduleViews() {
  if (elements.content) {
    elements.content.querySelectorAll('[data-toggle-schedule-class]').forEach((card) => {
      const id = card.dataset.toggleScheduleClass;
      const isSelected = selectedScheduleClassIds.has(id);
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-pressed', String(isSelected));
    });

    const summaryEl = elements.content.querySelector('#scheduleSelectionSummary');
    if (summaryEl) summaryEl.innerHTML = renderScheduleSelectionSummary();

    const recEl = elements.content.querySelector('#scheduleRecommendations');
    if (recEl) recEl.innerHTML = renderScheduleRecommendations();
  }
}

function renderPlans() {
  return `
    <header class="plan-hero">
      <div>
        <p class="eyebrow">Explorá tu próximo paso · Demo</p>
        <h1>¿Querés mejorar<br/><span>tu plan?</span></h1>
        <p>Elegí las clases que te gustaría tomar y encontrá una opción para tu ritmo.</p>
        <p class="plan-disclaimer">Estimación de demostración. Confirmá tarifas y condiciones con la academia; tu plan actual no cambia.</p>
      </div>
    </header>

    <section class="schedule-comparator-section" aria-labelledby="scheduleTitle">
      <div class="schedule-comparator-layout">
        <div class="schedule-poster-card">
          <div class="schedule-poster-header">
            <div>
              <h2 id="scheduleTitle">Horarios de clase</h2>
              <p>Tocá las clases que te interesan para comparar.</p>
            </div>
            <div class="schedule-actions">
              <button type="button" class="button button--light button--small" data-schedule-action="select-all">Seleccionar todo</button>
              <button type="button" class="button button--light button--small" data-schedule-action="clear-selection">Limpiar</button>
            </div>
          </div>

          <div class="schedule-poster-shell">
            <div class="schedule-poster-grid" id="schedulePosterGrid" aria-live="polite">
              ${renderSchedulePosterGrid()}
            </div>
          </div>

        </div>

        <aside class="schedule-summary-card" aria-labelledby="summaryTitle">
          <h2 id="summaryTitle">Tu opción sugerida</h2>
          <div id="scheduleSelectionSummary" class="schedule-selection-summary">
            ${renderScheduleSelectionSummary()}
          </div>
          <div id="scheduleRecommendations" class="schedule-recommendations">
            ${renderScheduleRecommendations()}
          </div>
        </aside>
      </div>
    </section>

    <section class="plan-faq" aria-label="Preguntas sobre los planes">
      <h2>¿Tenés dudas?</h2>
      <details>
        <summary>¿Cómo se calcula el pase recomendado?</summary>
        <p>La demo evalúa las combinaciones de pases que cubrirían tus clases seleccionadas y le suma un parqueo estimado por día de visita, para sugerir la de menor costo total. Tanto las reglas de combinación (Dancer Pass por disciplina, Night Pass de lunes a jueves, Weekend Pass por día de fin de semana, Teens) como el parqueo son supuestos de la simulación y no están confirmados con la academia.</p>
      </details>
      <details>
        <summary>¿Qué incluye el plan Full In Motion?</summary>
        <p>En la simulación, Full In Motion (Q 750/mes) representa pase libre a todas las clases sin restricción de horario, con hasta 3 horas de parqueo por visita. Es un supuesto de la demo: confirmá el alcance real y el precio vigente con la academia.</p>
      </details>
      <details>
        <summary>¿Puedo cambiar mi plan desde aquí?</summary>
        <p>No. Este comparador es solo de consulta: no modifica tu membresía, tus inscripciones ni tus pagos. Para un cambio real, consultá disponibilidad, condiciones y precios vigentes con la academia.</p>
      </details>
    </section>
  `;
}


function openPlanDetail(id) {
  const plan = membershipPlans.find((item) => item.id === id);
  if (!plan) return;
  openModal({ title: `Plan ${plan.name}`, eyebrow: 'Conocé tu opción · Demo', body: `<p class="plan-price">Q ${escapeHtml(formatAmount(plan.price))}<span>/ mes</span></p><p>${escapeHtml(plan.description)}</p><ul class="plan-detail-list"><li>${escapeHtml(planRhythmText(plan))}, como orientación.</li><li>${escapeHtml(planAllowanceText(plan))}.</li><li>${escapeHtml(planUnitText(plan))}.</li><li>La inscripción y otros cargos deben confirmarse con recepción.</li></ul><p class="plan-disclaimer">Esta comparación no modifica tu membresía ni registra pagos. Los importes son ficticios.</p><button class="button" type="button" data-close-modal>Seguir comparando</button>` });
}

let studentCalendarDate = startOfDay(TODAY);
let studentCalendarFilter = 'all';

function getClassesForDate(date, filter = 'all') {
  const targetWeekday = date.getDay();
  const student = currentStudent();
  const studentClassIds = student?.classIds || [];

  let list = scheduledClasses().filter((item) => item.weekday === targetWeekday);

  if (filter === 'mine') {
    list = list.filter((item) => studentClassIds.includes(item.id));
  } else if (filter === 'initial') {
    list = list.filter((item) => item.level.toLowerCase().includes('inicial'));
  } else if (filter === 'intermediate') {
    list = list.filter((item) => item.level.toLowerCase().includes('intermedio'));
  } else if (filter === 'advanced') {
    list = list.filter((item) => item.level.toLowerCase().includes('avanzado'));
  }

  return list.sort((a, b) => timeValue(a.time) - timeValue(b.time));
}

function nextDayWithClasses(fromDate, filter = 'all') {
  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = addDays(fromDate, offset);
    const classes = getClassesForDate(candidate, filter);
    if (classes.length > 0) return candidate;
  }
  return null;
}

function studentCalendarMarkup() {
  const student = currentStudent();
  const studentClassIds = student?.classIds || [];
  const isToday = daysBetween(studentCalendarDate) === 0;

  // Lunes de la semana que contiene a studentCalendarDate
  const monday = addDays(studentCalendarDate, -((startOfDay(studentCalendarDate).getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const dayClasses = getClassesForDate(studentCalendarDate, studentCalendarFilter);
  const nextAvailableDay = nextDayWithClasses(studentCalendarDate, studentCalendarFilter);

  const weekStripHtml = weekDays.map((d) => {
    const dIsToday = daysBetween(d) === 0;
    const dIsSelected = dayKey(d) === dayKey(studentCalendarDate);
    const dClasses = getClassesForDate(d, studentCalendarFilter);
    const count = dClasses.length;
    const hasEnrolled = dClasses.some((c) => studentClassIds.includes(c.id));

    let pillClass = 'calendar-day-pill is-clickable';
    if (dIsToday) pillClass += ' is-today';
    if (dIsSelected) pillClass += ' is-selected';
    if (hasEnrolled) pillClass += ' has-enrolled';

    return `
      <button class="${pillClass}" type="button" data-calendar-select="${escapeHtml(dayKey(d))}" aria-pressed="${dIsSelected}" aria-label="${escapeHtml(longDate(d))}: ${count} clase${count === 1 ? '' : 's'}">
        <span class="calendar-pill-day">${escapeHtml(WEEKDAY_SHORT[d.getDay()])}</span>
        <strong class="calendar-pill-num">${escapeHtml(d.getDate())}</strong>
        <span class="calendar-pill-meta">${count ? `${count} ${count === 1 ? 'clase' : 'clases'}` : '—'}</span>
      </button>
    `;
  }).join('');

  let agendaContentHtml = '';
  if (dayClasses.length > 0) {
    agendaContentHtml = `
      <div class="calendar-agenda-list">
        ${dayClasses.map((item) => {
          const isEnrolled = studentClassIds.includes(item.id);

          let statusTag = '';
          if (isToday) {
            const startsAt = new Date(studentCalendarDate);
            startsAt.setMinutes(timeValue(item.time));
            const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
            if (TODAY > endsAt) {
              statusTag = '<span class="tag tag--ended">Finalizada</span>';
            } else if (TODAY >= startsAt && TODAY <= endsAt) {
              statusTag = '<span class="tag tag--red">En curso</span>';
            } else {
              statusTag = '<span class="tag tag--dark">Hoy</span>';
            }
          }

          return `
            <article class="calendar-agenda-card ${isEnrolled ? 'is-enrolled' : ''}">
              <div class="calendar-agenda-time-col">
                <span class="calendar-agenda-time">${escapeHtml(item.time)}</span>
                ${statusTag}
              </div>
              <div class="calendar-agenda-main">
                <div class="calendar-agenda-top">
                  <h3 class="calendar-agenda-title">${escapeHtml(item.name)}</h3>
                  ${isEnrolled ? '<span class="tag tag--red">Inscrito</span>' : ''}
                </div>
                <p class="calendar-agenda-meta">
                  <span class="agenda-meta-item">${escapeHtml(item.level)}</span> · 
                  <span class="agenda-meta-item">Salón: ${escapeHtml(item.room)}</span> · 
                  <span class="agenda-meta-item">Profesor: ${escapeHtml(item.teacher)}</span>
                </p>
                <div class="calendar-agenda-foot">
                  <span class="capacity">${escapeHtml(capacityText(item))} cupos</span>
                  <div class="calendar-agenda-actions">
                    <button class="button button--small ${isEnrolled ? 'button--red' : 'button--light'}" type="button" data-class-detail="${escapeHtml(item.id)}" data-context-date="${escapeHtml(dayKey(studentCalendarDate))}" aria-label="Ver detalles de ${escapeHtml(item.name)}">Ver detalles</button>
                    <button class="button button--small button--light" type="button" data-open-music-modal="${escapeHtml(item.id)}" aria-label="Sugerir rola para ${escapeHtml(item.name)}">Rola 🎶</button>
                  </div>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  } else {
    let emptyDescription = 'No hay clases programadas para este día.';
    if (studentCalendarFilter === 'mine') {
      emptyDescription = 'No tenés clases inscritas para este día.';
    } else if (studentCalendarFilter !== 'all') {
      emptyDescription = 'No hay clases de este nivel para la fecha seleccionada.';
    }

    agendaContentHtml = `
      <div class="calendar-empty-card surface-card">
        <p class="calendar-empty-icon" aria-hidden="true">📅</p>
        <h3>Día sin clases programadas</h3>
        <p class="calendar-empty-desc">${escapeHtml(emptyDescription)}</p>
        <div class="calendar-empty-actions">
          ${nextAvailableDay ? `<button class="button button--red button--small" type="button" data-calendar-select="${escapeHtml(dayKey(nextAvailableDay))}">Próximo día con actividad (${escapeHtml(shortDayLabel(nextAvailableDay))}) →</button>` : ''}
          ${!isToday ? `<button class="button button--light button--small" type="button" data-calendar-today>Volver a Hoy</button>` : ''}
          ${studentCalendarFilter !== 'all' ? `<button class="button button--light button--small" type="button" data-calendar-filter="all">Ver todas las clases</button>` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="calendar-nav-bar">
      <button class="calendar-nav-arrow" type="button" data-calendar-nav="-1" aria-label="Día anterior">
        <span aria-hidden="true">←</span>
      </button>
      <div class="calendar-nav-center">
        <h2 class="calendar-nav-heading">${escapeHtml(longDate(studentCalendarDate))}</h2>
        <div class="calendar-nav-sub">
          ${isToday ? '<span class="calendar-nav-badge-today">Hoy</span>' : `<button class="calendar-nav-btn-today" type="button" data-calendar-today>Volver a Hoy</button>`}
        </div>
      </div>
      <button class="calendar-nav-arrow" type="button" data-calendar-nav="1" aria-label="Día siguiente">
        <span aria-hidden="true">→</span>
      </button>
    </div>

    <div class="calendar-week-strip" role="group" aria-label="Días de la semana">
      ${weekStripHtml}
    </div>

    <div class="filter-row" role="group" aria-label="Filtrar clases">
      <button class="filter-chip ${studentCalendarFilter === 'all' ? 'is-active' : ''}" type="button" aria-pressed="${studentCalendarFilter === 'all'}" data-calendar-filter="all">Todas</button>
      <button class="filter-chip ${studentCalendarFilter === 'mine' ? 'is-active' : ''}" type="button" aria-pressed="${studentCalendarFilter === 'mine'}" data-calendar-filter="mine">Mis clases</button>
      <button class="filter-chip ${studentCalendarFilter === 'initial' ? 'is-active' : ''}" type="button" aria-pressed="${studentCalendarFilter === 'initial'}" data-calendar-filter="initial">Inicial</button>
      <button class="filter-chip ${studentCalendarFilter === 'intermediate' ? 'is-active' : ''}" type="button" aria-pressed="${studentCalendarFilter === 'intermediate'}" data-calendar-filter="intermediate">Intermedio</button>
      <button class="filter-chip ${studentCalendarFilter === 'advanced' ? 'is-active' : ''}" type="button" aria-pressed="${studentCalendarFilter === 'advanced'}" data-calendar-filter="advanced">Avanzado</button>
    </div>

    <div class="calendar-agenda-container" aria-live="polite">
      ${agendaContentHtml}
    </div>
  `;
}

function updateStudentCalendarUI() {
  const container = elements.content.querySelector('#studentScheduleContainer');
  if (container) {
    container.innerHTML = studentCalendarMarkup();
  } else {
    renderApp();
  }
}

function renderStudentClasses() {
  return `
    <header class="page-heading">
      <div>
        <p class="eyebrow">Agenda y horarios</p>
        <h1>Tu calendario<br/>de clases.</h1>
        <p>Consultá tus clases y horarios disponibles. Abrí los detalles de cualquier sesión para ver salón, profesor y cupos.</p>
      </div>
      <button class="button" type="button" data-go="carnet">Mostrar mi carné</button>
    </header>
    <div id="studentScheduleContainer">
      ${studentCalendarMarkup()}
    </div>
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

function qrMarkup(seed = DEMO_STUDENT_ID) {
  return `<svg viewBox="0 0 21 21" aria-label="Código QR de demostración ${escapeHtml(seed)}" role="img" shape-rendering="crispEdges">
    <rect width="21" height="21" fill="#fff"/>
    ${qrPattern(seed).flatMap((row, y) => row.map((cell, x) => cell ? `<rect x="${x}" y="${y}" width="1" height="1" fill="#0b0b0c"/>` : '')).join('')}
  </svg>`;
}

// El carne es identificacion permanente: numero de carne, nombre, nivel y plan
// inscrito. No caduca y no refleja el estado de la mensualidad -un carne que
// dice "Por confirmar" por un pago pendiente insinua un bloqueo de asistencia
// que la academia no aplica-. El estado del mes se muestra aparte.
//
// Se muestra estatico, de una sola cara. El giro se retiro porque su reverso
// publicaba normas de estudio, temporada y un telefono que la academia nunca
// aprobo, y porque escondia detras de una interaccion lo unico que hay que ver.
// El QR vive en su propio panel, al lado: se lee sin girar nada.
function memberCardMarkup(student) {
  return `
    <article class="member-card">
      <div class="member-card-header">
        <img class="member-logo" src="./assets/inmotion-logo.svg" alt="In Motion Dance Academy" />
        <span class="member-validity-badge">Permanente</span>
      </div>
      <div class="member-card-body">
        <div class="member-card-identity">
          <p class="member-card-label">Carné de alumno</p>
          <h2 class="member-name">${escapeHtml(student.name)}</h2>
          <div class="member-meta">
            <div class="member-id-tag">
              <span class="member-id-label">N.º</span>
              <strong class="member-id-number">${escapeHtml(student.id)}</strong>
            </div>
            ${student.level ? `<span class="member-level">${escapeHtml(student.level)}</span>` : ''}
          </div>
        </div>
        <div class="member-qr-block">
          <div class="member-qr-frame">
            ${qrMarkup(student.id)}
          </div>
          <span class="member-qr-note">QR de demostración</span>
        </div>
      </div>
    </article>`;
}

// Bloque separado del carne: periodo, importe y estado de la mensualidad.
// Es informativo; no condiciona el carne ni la asistencia.
function membershipStatusMarkup(student) {
  const plan = planForStudent(student.id);
  const payment = monthlyPaymentFor(student.id);
  const status = paymentStatus(payment);
  const paid = payment?.status === 'Pagado';
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <h2>Mensualidad</h2>
          <p>Período ${escapeHtml(currentPeriodLabel())}. Se consulta aparte del carné: el carné no vence.</p>
        </div>
        <span class="status-pill ${paid ? 'is-paid' : 'is-due'}">${escapeHtml(status)}</span>
      </div>
      <article class="surface-card">
        <p class="eyebrow">${escapeHtml(currentPeriodLabel())}</p>
        <p class="payment-amount">${escapeHtml(payment ? `Q ${formatAmount(payment.amount)}` : priceText(plan.price))}</p>
        <p class="payment-meta">${escapeHtml(status)} · ${escapeHtml(paymentDateText(payment))}<br/>${escapeHtml(plan.planName)}${planReviewTag(plan)} · ${escapeHtml(priceText(plan.price))}${plan.needsReview ? '' : ' al mes'}${payment ? '' : ' · cuota del plan, sin registro para este mes'}</p>
        ${plan.needsReview ? '<p class="payment-meta">El plan guardado no figura en el catálogo de la demo. Se conserva tal cual y no se le asigna una cuota: corregilo desde administración antes de registrar un pago.</p>' : ''}
      </article>
    </section>`;
}

function renderStudentCard() {
  const student = currentStudent();
  if (!student) {
    return `
    <header class="page-heading"><div><p class="eyebrow">Identificación digital</p><h1>Tu carnet.<br/>Siempre listo.</h1></div></header>
    <div class="empty-state"><strong>${isSupabaseConnected ? 'Sin carné vinculado' : 'Sin alumno en la demo'}</strong>${isSupabaseConnected ? 'Tu usuario conectado no tiene un carné o ficha de estudiante asociada en el sistema.' : 'Reiniciá la demostración para recuperar el padrón inicial.'}</div>`;
  }
  return `
    <header class="page-heading"><div><p class="eyebrow">Identificación digital</p><h1>Tu carnet.<br/>Siempre listo.</h1><p>Tu número de carné es permanente y no caduca. Presentá tu credencial en recepción al llegar a clase.</p></div></header>
    <div class="member-card-wrap">
      ${memberCardMarkup(student)}
      <aside class="surface-card member-info-card">
        <div>
          <p class="eyebrow">Uso del carné</p>
          <h2>Acceso a la academia</h2>
          <p class="payment-meta">Tu credencial digital es permanente e intransferible. Mostrala en recepción desde tu teléfono o impresa al llegar a tu clase; la asistencia se registra en el dispositivo de la academia.</p>
        </div>
        <div class="member-info-badges">
          <div class="info-badge">
            <span class="info-badge-label">Tipo de credencial</span>
            <strong>Permanente · Digital e impresa</strong>
          </div>
          <div class="info-badge">
            <span class="info-badge-label">Identificación en puerta</span>
            <strong>${escapeHtml(student.id)} · Válida todo el ciclo</strong>
          </div>
        </div>
      </aside>
    </div>
    ${membershipStatusMarkup(student)}
  `;
}


function teacherCards() {
  const teacher = currentTeacher();
  const own = teacherClasses().slice(0, 4);
  if (!own.length) {
    const teacherName = teacher?.name || 'El maestro';
    return `<div class="empty-state"><strong>Sin clases asignadas</strong>${escapeHtml(teacherName)} no tiene clases en la agenda asignada.</div>`;
  }
  return `<div class="teacher-day-grid">${own.map((item, index) => `
    <article class="teacher-class">
      <div class="teacher-class-time">${escapeHtml(item.time).replace(' ', '<br/>')}</div>
      <div><span class="tag ${index === 0 ? 'tag--red' : ''}">${escapeHtml(item.day)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.room)} · ${escapeHtml(capacityText(item))} cupos</p></div>
      <button class="button button--small ${index === 0 ? 'button--red' : 'button--light'}" type="button" data-take-attendance="${escapeHtml(item.id)}" aria-label="${index === 0 ? 'Pasar asistencia' : 'Abrir clase'} de ${escapeHtml(item.name)}, ${escapeHtml(item.day)} ${escapeHtml(item.time)}">${index === 0 ? 'Pasar asistencia' : 'Abrir clase'}</button>
    </article>
  `).join('')}</div>`;
}

function renderTeacherHome() {
  const teacher = currentTeacher();
  if (isSupabaseConnected && !teacher) {
    return `
      <section class="teacher-hero">
        <p class="eyebrow">${escapeHtml(shortDayLabel(TODAY))}</p>
        <h1>Hola,<br/><span>Sin perfil docente.</span></h1>
      </section>
      <div class="empty-state">
        <strong>Perfil docente no vinculado</strong>
        Tu usuario autenticado no tiene un perfil de maestro activo en el sistema.
      </div>
    `;
  }
  const own = teacherClasses();
  const today = own.filter((item) => item.day === 'Hoy');
  const next = upcomingClasses(own)[0];
  const count = today.length;
  const firstName = teacher?.firstName || 'Alex';
  return `
    <section class="teacher-hero">
      <p class="eyebrow">${escapeHtml(shortDayLabel(TODAY))} · ${count ? `${count} clase${count === 1 ? '' : 's'} programada${count === 1 ? '' : 's'}` : 'sin clases hoy'}</p>
      <h1>${escapeHtml(greeting())},<br/><span>${escapeHtml(firstName)}.</span></h1>
      <div class="teacher-hero-foot">
        <div class="filter-row" style="margin-bottom:8px">
          ${next ? `<button class="button button--red" type="button" data-take-attendance="${escapeHtml((today[0] || next).id)}">${count ? 'Abrir asistencia de hoy' : 'Abrir próxima clase'}</button>` : ''}
          <button class="button button--light" type="button" data-open-validate-pass>Validar pase individual</button>
        </div>
        <p>${next ? `Tu siguiente clase es ${escapeHtml(next.day.toLowerCase())} a las ${escapeHtml(next.time)}<br/>en el ${escapeHtml(next.room)}.` : 'No tenés clases asignadas.'}</p>
      </div>
    </section>
    <section class="section"><div class="section-head"><div><h2>Tu agenda</h2><p>Próximas clases asignadas.</p></div><button class="text-button" type="button" data-go="agenda">Ver semana →</button></div>${teacherCards()}</section>
    ${teacherMusicSection()}
  `;
}

function renderTeacherAgenda() {
  const teacher = currentTeacher();
  if (isSupabaseConnected && !teacher) {
    return `
      <header class="page-heading"><div><p class="eyebrow">Agenda docente</p><h1>Sin clases<br/>asignadas.</h1></div></header>
      <div class="empty-state"><strong>Sin perfil docente</strong>No tenés un perfil docente vinculado en el sistema.</div>
    `;
  }
  const teacherName = teacher?.name || 'Alex Aquino';
  const own = teacherClasses();
  const ownIds = new Set(own.map((c) => c.id));
  const otherClasses = scheduledClasses().filter((c) => !ownIds.has(c.id));

  return `
    <header class="page-heading">
      <div>
        <p class="eyebrow">Agenda docente</p>
        <h1>Una semana<br/>en movimiento.</h1>
        <p>Clases asignadas a ${escapeHtml(teacherName)} y programación de la academia.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--light" type="button" data-open-validate-pass>Validar pase</button>
      </div>
    </header>
    ${weekStrip(scheduledClasses())}
    <section class="section">
      <div class="section-head">
        <div>
          <h2>Tus clases asignadas</h2>
          <p>Próximas clases a tu cargo.</p>
        </div>
      </div>
      ${teacherCards()}
    </section>
    ${otherClasses.length ? `
      <section class="section">
        <div class="section-head">
          <div>
            <h2>Próximas clases de los otros días</h2>
            <p>Otras clases programadas en la academia con otros maestros.</p>
          </div>
        </div>
        <div class="teacher-day-grid">
          ${otherClasses.map((item) => `
            <article class="teacher-class">
              <div class="teacher-class-time">${escapeHtml(item.time).replace(' ', '<br/>')}</div>
              <div>
                <span class="tag">${escapeHtml(item.day)}</span>
                <h3>${escapeHtml(item.name)}</h3>
                <p>${escapeHtml(item.teacher)} · ${escapeHtml(item.room)} · ${escapeHtml(capacityText(item))} cupos</p>
              </div>
              <button class="button button--small button--light" type="button" data-take-attendance="${escapeHtml(item.id)}" aria-label="Abrir clase de ${escapeHtml(item.name)}, ${escapeHtml(item.day)} ${escapeHtml(item.time)}">Abrir clase</button>
            </article>
          `).join('')}
        </div>
      </section>
    ` : ''}
    ${teacherMusicSection()}
  `;
}

// Antes la lista era un padron fijo de seis nombres: no incluia a los alumnos
// dados de alta en la demo, mostraba alumnos de otras clases y guardar la sesion
// borraba las marcas de quien no aparecia en ella.
function rosterMarkup(classId = activeClassId, date = TODAY) {
  const students = rosterFor(classId);
  if (!students.length) {
    return '<div class="empty-state"><strong>Sin alumnos inscritos</strong>Esta clase no tiene inscripciones en los datos demo, así que no hay lista que pasar.</div>';
  }
  const selected = attendanceFor(classId, date);
  const editable = true;
  return `<div class="attendance-roster">${students.map((student) => {
    const present = selected.includes(student.id);
    return `
    <label class="student-check">
      <input type="checkbox" name="attendance" value="${escapeHtml(student.id)}" ${present ? 'checked' : ''} ${editable ? '' : 'disabled'} />
      <span class="avatar" aria-hidden="true">${escapeHtml(student.initials || initials(student.name))}</span>
      <span><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.id)} · ${escapeHtml(planForStudent(student.id).name)}</small></span>
      <span>${present ? 'Presente' : 'Sin registro'}</span>
    </label>
  `;
  }).join('')}</div>`;
}

function renderTeacherAttendance() {
  const item = findClass(activeClassId) || scheduledClasses()[0];
  const live = item.day === 'Hoy';
  const enrolled = rosterFor(item.id);
  const enrolledIds = enrolled.map((entry) => entry.id);
  const historyOnly = attendanceFor(item.id, item.date).filter((id) => !enrolledIds.includes(id));
  const canSubmit = enrolled.length > 0;
  const student = currentStudent();
  return `
    <header class="page-heading">
      <div>
        <p class="eyebrow">Control de asistencia</p>
        <h1>¿Quién vino<br/>a bailar?</h1>
        <p>Marcá la lista y guardá esta sesión localmente.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--red" type="button" data-open-validate-pass>Validar pase</button>
      </div>
    </header>
    <section class="split-grid">
      <article class="surface-card">
        <div class="section-head"><div><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.day)} · ${escapeHtml(item.time)} · ${escapeHtml(item.room)}</p></div><span class="tag ${live ? 'tag--red' : ''}">${live ? 'Programada para hoy' : `Programada · ${escapeHtml(item.day)}`}</span></div>
        <form id="attendanceForm" data-class-id="${escapeHtml(item.id)}" data-session-date="${escapeHtml(dayKey(item.date))}">
          <div class="roster-actions-bar">
            <p class="payment-meta" style="margin:0">${enrolled.length} alumno${enrolled.length === 1 ? '' : 's'} inscrito${enrolled.length === 1 ? '' : 's'} en esta clase.</p>
            <div class="roster-quick-actions">
              <button type="button" class="button button--light button--small" data-attendance-action="check-all" ${canSubmit ? '' : 'disabled'}>Marcar todos</button>
              <button type="button" class="button button--light button--small" data-attendance-action="clear-all" ${canSubmit ? '' : 'disabled'}>Desmarcar</button>
            </div>
          </div>
          ${rosterMarkup(item.id, item.date)}
          ${historyOnly.length ? `<p class="modal-note">${historyOnly.length} alumno${historyOnly.length === 1 ? '' : 's'} con asistencia registrada en esta sesión ya no está${historyOnly.length === 1 ? '' : 'n'} inscrito${historyOnly.length === 1 ? '' : 's'} en la clase: ${escapeHtml(historyOnly.map((id) => studentById(id)?.name || id).join(', '))}. Su registro se conserva y no se modifica desde esta lista.</p>` : ''}
          <div class="form-actions"><button class="button button--red" type="submit" ${canSubmit ? '' : 'disabled'}>Guardar asistencia</button></div>
        </form>
      </article>
      <aside class="surface-card">
        <p class="eyebrow">Validación de pases</p>
        <h2>Pases y carné</h2>
        <p class="payment-meta">Validá asistencia de alumnos con pase de prueba o particular mediante código corto.</p>
        <button class="button button--red" style="width:100%;margin-top:16px" type="button" data-open-validate-pass>Validar pase individual</button>
        
        <hr style="margin:24px 0;border:none;border-top:1px solid rgba(255,255,255,0.08)" />
        <p class="eyebrow">Lectura QR de alumno</p>
        <p class="payment-meta">Simula la lectura del carnet ${student ? `de ${escapeHtml(student.name)}` : ''}.</p>
        <div class="qr-code" style="max-width:220px;margin-top:16px">${student ? qrMarkup(student.id) : '<p class="payment-meta">Sin carné</p>'}</div>
        <button class="button button--light" style="width:100%;margin-top:16px" type="button" data-open-scan ${student ? '' : 'disabled'}>Simular escaneo</button>
      </aside>
    </section>
  `;
}

function pendingPayments() {
  return state.payments.filter((item) => item.status !== 'Pagado');
}

function adminPaymentRows(payments = state.payments, empty = null) {
  if (!payments.length) {
    return `<tr><td colspan="6"><div class="empty-state"><strong>${escapeHtml(empty?.title || 'No hay registros')}</strong>${escapeHtml(empty?.detail || 'Probá con otro filtro.')}</div></td></tr>`;
  }
  return payments.map((item) => `
    <tr data-payment-row="${escapeHtml(item.id)}">
      <td><div class="person-cell"><span class="avatar" aria-hidden="true">${escapeHtml(initials(item.student))}</span><span><strong>${escapeHtml(item.student)}</strong><small>${escapeHtml(item.studentId)}</small></span></div></td>
      <td>${escapeHtml(item.month)}</td>
      <td><strong>Q ${escapeHtml(formatAmount(item.amount))}</strong></td>
      <td>${escapeHtml(item.method)}</td>
      <td><span class="status-pill ${item.status === 'Pagado' ? 'is-paid' : (paymentStatus(item) === 'En mora' ? 'is-mora' : 'is-due')}">${escapeHtml(paymentStatus(item))}</span></td>
      <td>${item.status === 'Pagado'
        ? `<button class="table-action" type="button" data-receipt="${escapeHtml(item.id)}" aria-label="Comprobante de ${escapeHtml(item.student)}, ${escapeHtml(item.month)}">Comprobante</button>`
        : `<button class="table-action" type="button" data-register-for="${escapeHtml(item.studentId)}" data-payment-period="${escapeHtml(item.period)}" aria-label="Registrar pago de ${escapeHtml(item.student)}, ${escapeHtml(item.month)}">Registrar</button>`}</td>
    </tr>
  `).join('');
}

function studentRows(students = state.students) {
  if (!students.length) return '<tr><td colspan="5"><div class="empty-state"><strong>Sin coincidencias</strong>Revisá el nombre o número de carnet.</div></td></tr>';
  return students.map((student) => {
    const status = studentPaymentStatus(student.id);
    const pillClass = (status === 'Al día' || status === 'Pagado')
      ? 'is-paid'
      : (status === 'En mora')
      ? 'is-mora'
      : (status === 'Pendiente')
      ? 'is-due'
      : 'is-undefined';
    return `
    <tr>
      <td><div class="person-cell"><span class="avatar" aria-hidden="true">${escapeHtml(initials(student.name))}</span><span><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.id)}</small></span></div></td>
      <td>${escapeHtml(planForStudent(student.id).planName)}${planReviewTag(planForStudent(student.id))}</td>
      <td>${escapeHtml(student.phone)}</td>
      <td><span class="status-pill ${pillClass}">${escapeHtml(status)}</span></td>
      <td><button class="table-action" type="button" data-student-detail="${escapeHtml(student.id)}" aria-label="Ver ficha de ${escapeHtml(student.name)}">Ver ficha</button></td>
    </tr>
  `;
  }).join('');
}

function renderAdminHome() {
  const due = pendingPayments();
  // Antes decia 50 alumnos y 6 maestros mientras la pantalla de al lado listaba
  // 7 registros: ahora las dos cifras salen de los mismos datos.
  const teachers = new Set(classData.map((item) => item.teacher)).size;
  return `
    <section class="admin-intro">
      <div><p class="eyebrow">Administración · ${escapeHtml(shortDayLabel(TODAY))}</p><h1>La academia,<br/>en orden.</h1></div>
      <div class="admin-intro-meta"><div><strong>${escapeHtml(state.students.length)}</strong><span>alumnos registrados</span></div><div><strong>${escapeHtml(teachers)}</strong><span>maestros en agenda</span></div></div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Acciones de hoy</h2><p>Operaciones frecuentes del equipo administrativo.</p></div></div>
      <div class="filter-row" role="group" aria-label="Acciones administrativas"><button class="button button--red" type="button" data-open-payment>+ Registrar pago</button><button class="button button--light" type="button" data-open-student>+ Nuevo alumno</button><button class="button button--light" type="button" data-go="asistencia">Revisar asistencia</button></div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Pagos por resolver</h2><p>${due.length === 1 ? '1 registro necesita' : `${due.length} registros necesitan`} seguimiento.</p></div><button class="text-button" type="button" data-go="pagos">Ver todos →</button></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Alumno</th><th scope="col">Mes</th><th scope="col">Monto</th><th scope="col">Método</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead><tbody>${adminPaymentRows(due, { title: 'Nada por resolver', detail: 'No hay mensualidades pendientes ni en mora en los datos demo.' })}</tbody></table></div>
    </section>
  `;
}

function renderAdminStudents() {
  return `
    <header class="page-heading">
      <div><p class="eyebrow">Base de alumnos</p><h1>Personas,<br/>no expedientes.</h1><p>Datos ficticios para validar la experiencia de gestión.</p></div>
      <div class="heading-actions">
        <button class="button button--light" type="button" data-admin-export="students">Exportar CSV ⤓</button>
        <button class="button button--red" type="button" data-open-student>+ Nuevo alumno</button>
      </div>
    </header>
    <div class="section-head"><label class="search-box"><span aria-hidden="true">⌕</span><span class="sr-only">Buscar alumno por nombre o carnet</span><input id="studentSearch" type="search" placeholder="Buscar por nombre o carnet" autocomplete="off" /></label><span class="tag">${escapeHtml(state.students.length)} registros demo</span></div>
    <p class="payment-meta" id="studentSearchStatus" role="status">${escapeHtml(state.students.length)} de ${escapeHtml(state.students.length)} alumnos.</p>
    <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Alumno</th><th scope="col">Plan</th><th scope="col">Teléfono</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead><tbody id="studentTableBody">${studentRows()}</tbody></table></div>
  `;
}

function renderAdminPayments() {
  const paid = state.payments.filter((item) => item.status === 'Pagado' && item.paidAt?.startsWith(monthKey(TODAY))).reduce((sum, item) => sum + item.amount, 0);
  const due = pendingPayments().reduce((sum, item) => sum + item.amount, 0);
  return `
    <header class="page-heading">
      <div><p class="eyebrow">Control de pagos</p><h1>Registrar.<br/>Conciliar. Listo.</h1><p>Solo registra cobros realizados fuera del sistema. No procesa tarjetas ni emite FEL.</p></div>
      <div class="heading-actions">
        <button class="button button--light" type="button" data-admin-export="payments">Exportar CSV ⤓</button>
        <button class="button button--red" type="button" data-open-payment>+ Registrar pago</button>
      </div>
    </header>
    <section class="split-grid" style="margin-bottom:28px">
      <article class="surface-card"><p class="eyebrow">Registrado en ${escapeHtml(monthName(TODAY))}</p><p class="payment-amount">Q ${escapeHtml(paid.toLocaleString('es-GT'))}</p><p class="payment-meta">Monto visible en esta demo local.</p></article>
      <article class="surface-card"><p class="eyebrow">Pendiente / mora</p><p class="payment-amount">Q ${escapeHtml(due.toLocaleString('es-GT'))}</p><p class="payment-meta">Requiere seguimiento administrativo.</p></article>
    </section>
    <div class="filter-row" id="paymentFilters" role="group" aria-label="Filtrar pagos por estado"><button class="filter-chip is-active" type="button" aria-pressed="true" data-payment-filter="all">Todos</button><button class="filter-chip" type="button" aria-pressed="false" data-payment-filter="Pagado">Pagados</button><button class="filter-chip" type="button" aria-pressed="false" data-payment-filter="Pendiente">Pendientes</button><button class="filter-chip" type="button" aria-pressed="false" data-payment-filter="En mora">En mora</button></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Alumno</th><th scope="col">Mes</th><th scope="col">Monto</th><th scope="col">Método</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead><tbody id="paymentTableBody">${adminPaymentRows()}</tbody></table></div>
  `;
}

function renderAdminAttendance() {
  // El estado se leia del indice de la fila: la primera clase de la lista salia
  // siempre marcada como pendiente, fuera o no la de hoy.
  const sessions = scheduledClasses().map((item) => {
    const enrolled = rosterFor(item.id).length;
    const marked = attendanceFor(item.id, item.date).length;
    return {
      when: `${item.day} · ${item.time}`,
      name: item.name,
      teacher: item.teacher,
      attendance: enrolled || marked
        ? `${marked} marcado${marked === 1 ? '' : 's'} · ${enrolled} inscrito${enrolled === 1 ? '' : 's'}`
        : 'Sin inscritos en la demo',
      live: item.day === 'Hoy'
    };
  });
  return `
    <header class="page-heading">
      <div>
        <p class="eyebrow">Registro de asistencia</p>
        <h1>Cada llegada<br/>cuenta.</h1>
        <p>Las ${classData.length} clases de la semana. Consulta operativa, sin gráficas ni analítica avanzada.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--red" type="button" data-open-validate-pass>Validar pase</button>
        <button class="button button--light" type="button" data-open-scan>Simular escáner QR</button>
      </div>
    </header>
    <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Fecha y hora</th><th scope="col">Clase</th><th scope="col">Maestro</th><th scope="col">Asistencia</th><th scope="col">Estado</th></tr></thead><tbody>${sessions.map((row) => `<tr>
      <td>${escapeHtml(row.when)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.teacher)}</td>
      <td>${escapeHtml(row.attendance)}</td>
      <td><span class="status-pill ${row.live ? 'is-due' : ''}">${row.live ? 'Programada para hoy' : 'Programada'}</span></td>
    </tr>`).join('')}</tbody></table></div>
    <p class="modal-note">La columna de asistencia cuenta las marcas registradas y las inscripciones vigentes de los datos demo; pueden no coincidir si un alumno fue retirado de la clase después de asistir. Los cupos del calendario son cifras de referencia de una academia de 50 alumnos y no se calculan con estas inscripciones.</p>
  `;
}

let passFilterDate = 'today';
let passFilterType = 'all';
let passFilterPayment = 'all';
let passFilterStatus = 'all';
let passSearchQuery = '';

function filteredPassesList() {
  const passes = state.singlePasses || [];
  return passes.filter((pass) => {
    if (passFilterDate === 'today') {
      if (pass.date !== dayKey(TODAY)) return false;
    } else if (passFilterDate !== 'all' && passFilterDate) {
      if (pass.date !== passFilterDate) return false;
    }
    if (passFilterType !== 'all' && pass.type !== passFilterType) return false;
    if (passFilterPayment !== 'all' && pass.paymentStatus !== passFilterPayment) return false;
    const status = passStatus(pass);
    if (passFilterStatus !== 'all' && status !== passFilterStatus) return false;
    if (passSearchQuery) {
      const q = passSearchQuery.toLowerCase().trim();
      const matchName = (pass.studentName || '').toLowerCase().includes(q);
      const matchCode = (pass.code || '').toLowerCase().includes(q);
      const matchId = (pass.id || '').toLowerCase().includes(q);
      const matchClass = (pass.className || '').toLowerCase().includes(q);
      const matchTeacher = (pass.teacher || '').toLowerCase().includes(q);
      const matchStudentId = (pass.studentId || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchId && !matchClass && !matchTeacher && !matchStudentId) return false;
    }
    return true;
  });
}

function adminPassRows(passes = filteredPassesList()) {
  if (!passes.length) {
    return `<tr><td colspan="9" style="text-align:center;padding:32px 16px"><div class="empty-state"><strong>Sin pases que coincidan</strong>Probá ajustando los filtros de fecha, tipo o estado, o emití un nuevo pase.</div></td></tr>`;
  }
  return passes.map((pass) => {
    const status = passStatus(pass);
    const isToday = pass.date === dayKey(TODAY);
    return `
      <tr data-pass-row="${escapeHtml(pass.id)}">
        <td><strong class="code-mono">${escapeHtml(pass.code)}</strong></td>
        <td>
          <div class="person-cell">
            <span class="avatar" aria-hidden="true">${escapeHtml(initials(pass.studentName))}</span>
            <div>
              <strong>${escapeHtml(pass.studentName)}</strong>
              <small class="payment-meta">${pass.isVisitor ? `Visitante · ${escapeHtml(pass.contact || 'Sin contacto')}` : `Alumno (${escapeHtml(pass.studentId)})`}</small>
            </div>
          </div>
        </td>
        <td><span class="status-pill ${pass.type === 'trial' ? 'is-trial' : 'is-private'}">${escapeHtml(passTypeLabel(pass.type))}</span></td>
        <td>
          <div><strong>${escapeHtml(pass.className)}</strong></div>
          <small class="payment-meta">${formatDayKeyReadable(pass.date)} · ${escapeHtml(pass.time)}</small>
        </td>
        <td>${escapeHtml(pass.teacher)}</td>
        <td><strong>Q ${escapeHtml(pass.amount)}</strong></td>
        <td>
          <span class="${passPaymentPillClass(pass.paymentStatus)}">${passPaymentStatusLabel(pass.paymentStatus)}</span>
          ${pass.paymentMethod ? `<br/><small class="payment-meta">${escapeHtml(pass.paymentMethod)}</small>` : ''}
        </td>
        <td>
          <span class="${passStatusPillClass(status)}">${passStatusLabel(status)}</span>
          ${status === 'used' && pass.attendedAt ? `<br/><small class="payment-meta">${formatDateTime(pass.attendedAt)}</small>` : ''}
          ${status === 'cancelled' && pass.cancelReason ? `<br/><small class="payment-meta" title="${escapeHtml(pass.cancelReason)}">Cancelado</small>` : ''}
        </td>
        <td>
          <div class="pass-actions-cell">
            <button class="button button--small button--light" type="button" data-view-pass="${escapeHtml(pass.id)}" aria-label="Ver pase ${escapeHtml(pass.code)}">Ver</button>
            ${pass.paymentStatus === 'pending' && pass.status !== 'cancelled' ? `<button class="button button--small button--red" type="button" data-collect-pass="${escapeHtml(pass.id)}" aria-label="Cobrar pase ${escapeHtml(pass.code)}">Cobrar</button>` : ''}
            ${status === 'available' && isToday ? `<button class="button button--small button--red" type="button" data-open-validate-pass="${escapeHtml(pass.code)}" aria-label="Validar asistencia de ${escapeHtml(pass.code)}">Validar</button>` : ''}
            ${status === 'available' ? `<button class="button button--small button--light" type="button" data-cancel-pass="${escapeHtml(pass.id)}" aria-label="Cancelar pase ${escapeHtml(pass.code)}">Anular</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function adminPassCardsMobile(passes = filteredPassesList()) {
  if (!passes.length) {
    return `<div class="empty-state"><strong>Sin pases que coincidan</strong>Probá cambiando los filtros o emití un nuevo pase.</div>`;
  }
  return passes.map((pass) => {
    const status = passStatus(pass);
    const isToday = pass.date === dayKey(TODAY);
    return `
      <article class="surface-card pass-mobile-card" data-pass-card="${escapeHtml(pass.id)}">
        <div class="pass-mobile-card-top">
          <div class="pass-mobile-card-id">
            <strong class="code-mono">${escapeHtml(pass.code)}</strong>
            <span class="status-pill ${pass.type === 'trial' ? 'is-trial' : 'is-private'}">${escapeHtml(passTypeLabel(pass.type))}</span>
          </div>
          <div class="pass-mobile-card-status">
            <span class="${passStatusPillClass(status)}">${passStatusLabel(status)}</span>
            <span class="${passPaymentPillClass(pass.paymentStatus)}">${passPaymentStatusLabel(pass.paymentStatus)}</span>
          </div>
        </div>

        <div class="pass-mobile-card-person">
          <strong>${escapeHtml(pass.studentName)}</strong>
          <small class="payment-meta">${pass.isVisitor ? `Visitante · ${escapeHtml(pass.contact || 'Sin tel')}` : `Alumno (${escapeHtml(pass.studentId)})`}</small>
        </div>

        <div class="pass-mobile-card-details">
          <div><span class="detail-label">Clase:</span> <strong>${escapeHtml(pass.className)}</strong></div>
          <div><span class="detail-label">Horario:</span> ${formatDayKeyReadable(pass.date)} · ${escapeHtml(pass.time)}</div>
          <div><span class="detail-label">Profesor:</span> ${escapeHtml(pass.teacher)}</div>
          <div><span class="detail-label">Importe:</span> <strong>Q ${escapeHtml(pass.amount)}</strong> ${pass.paymentMethod ? `(${escapeHtml(pass.paymentMethod)})` : ''}</div>
        </div>

        ${status === 'used' && pass.attendedAt ? `
        <div class="pass-mobile-card-usage">
          <small>Asistencia: ${formatDateTime(pass.attendedAt)} por ${escapeHtml(pass.attendedBy || 'Personal')}</small>
          ${pass.attendedPendingAuth ? `<br/><small style="color:var(--brand-red)">* Excepción: cobro pendiente (${escapeHtml(pass.pendingAuthNote || '')})</small>` : ''}
        </div>` : ''}

        ${status === 'cancelled' && pass.cancelReason ? `
        <div class="pass-mobile-card-usage" style="color:var(--brand-red)">
          <small>Cancelado: ${escapeHtml(pass.cancelReason)}</small>
        </div>` : ''}

        <div class="pass-mobile-card-actions">
          <button class="button button--small button--light" type="button" data-view-pass="${escapeHtml(pass.id)}">Ver pase</button>
          ${pass.paymentStatus === 'pending' && pass.status !== 'cancelled' ? `<button class="button button--small button--red" type="button" data-collect-pass="${escapeHtml(pass.id)}">Cobrar</button>` : ''}
          ${status === 'available' && isToday ? `<button class="button button--small button--red" type="button" data-open-validate-pass="${escapeHtml(pass.code)}">Validar</button>` : ''}
          ${status === 'available' ? `<button class="button button--small button--light" type="button" data-cancel-pass="${escapeHtml(pass.id)}">Anular</button>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function renderAdminPasses() {
  const allPasses = state.singlePasses || [];
  const todayPasses = allPasses.filter((p) => p.date === dayKey(TODAY));
  const pendingAmount = allPasses.filter((p) => p.paymentStatus === 'pending' && passStatus(p) !== 'cancelled').reduce((sum, p) => sum + p.amount, 0);
  const attendedCount = allPasses.filter((p) => p.status === 'used').length;
  const filtered = filteredPassesList();

  return `
    <header class="page-heading">
      <div>
        <p class="eyebrow">Control de pases · Pruebas y particulares</p>
        <h1>Pases individuales.<br/>Acceso ágil.</h1>
        <p>Emisión, cobro y validación de asistencia para clases de prueba (Q60) y sesiones particulares.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--red" type="button" data-open-create-pass>+ Crear pase</button>
        <button class="button button--light" type="button" data-open-validate-pass>Validar pase</button>
      </div>
    </header>

    <section class="split-grid" style="margin-bottom:24px">
      <article class="surface-card">
        <p class="eyebrow">Pases programados para hoy</p>
        <p class="payment-amount">${todayPasses.length}</p>
        <p class="payment-meta">${todayPasses.filter((p) => passStatus(p) === 'used').length} asistencias ya marcadas hoy.</p>
      </article>
      <article class="surface-card">
        <p class="eyebrow">Cobro pendiente en pases</p>
        <p class="payment-amount">Q ${escapeHtml(pendingAmount.toLocaleString('es-GT'))}</p>
        <p class="payment-meta">${allPasses.filter((p) => p.paymentStatus === 'pending' && passStatus(p) !== 'cancelled').length} pases pendientes de cobro.</p>
      </article>
      <article class="surface-card">
        <p class="eyebrow">Total asistencias con pase</p>
        <p class="payment-amount">${attendedCount}</p>
        <p class="payment-meta">Pases utilizados acumulados en la demo.</p>
      </article>
    </section>

    <section class="pass-filters-section surface-card" style="margin-bottom:24px">
      <div class="pass-filter-controls">
        <div class="pass-date-row">
          <label class="field-inline">
            <span>Fecha:</span>
            <input type="date" id="passDateInput" value="${passFilterDate === 'today' ? dayKey(TODAY) : (passFilterDate === 'all' ? '' : passFilterDate)}" />
          </label>
          <button type="button" class="filter-chip ${passFilterDate === 'today' ? 'is-active' : ''}" data-pass-date="today">Hoy</button>
          <button type="button" class="filter-chip ${passFilterDate === 'all' ? 'is-active' : ''}" data-pass-date="all">Todas las fechas</button>
        </div>

        <label class="search-box pass-search-box">
          <span aria-hidden="true">⌕</span>
          <span class="sr-only">Buscar pase</span>
          <input id="passSearchInput" type="search" placeholder="Buscar por nombre, alumno o código..." value="${escapeHtml(passSearchQuery)}" autocomplete="off" />
        </label>
      </div>

      <div class="filter-group-stack">
        <div class="filter-row" role="group" aria-label="Filtrar por tipo de pase">
          <span class="filter-group-label">Tipo:</span>
          <button class="filter-chip ${passFilterType === 'all' ? 'is-active' : ''}" type="button" data-pass-type="all">Todos</button>
          <button class="filter-chip ${passFilterType === 'trial' ? 'is-active' : ''}" type="button" data-pass-type="trial">Pruebas (Q60)</button>
          <button class="filter-chip ${passFilterType === 'private' ? 'is-active' : ''}" type="button" data-pass-type="private">Particulares</button>
        </div>

        <div class="filter-row" role="group" aria-label="Filtrar por pago">
          <span class="filter-group-label">Pago:</span>
          <button class="filter-chip ${passFilterPayment === 'all' ? 'is-active' : ''}" type="button" data-pass-pay="all">Todos</button>
          <button class="filter-chip ${passFilterPayment === 'paid' ? 'is-active' : ''}" type="button" data-pass-pay="paid">Pagados</button>
          <button class="filter-chip ${passFilterPayment === 'pending' ? 'is-active' : ''}" type="button" data-pass-pay="pending">Pendientes</button>
        </div>

        <div class="filter-row" role="group" aria-label="Filtrar por estado del pase">
          <span class="filter-group-label">Estado:</span>
          <button class="filter-chip ${passFilterStatus === 'all' ? 'is-active' : ''}" type="button" data-pass-status="all">Todos</button>
          <button class="filter-chip ${passFilterStatus === 'available' ? 'is-active' : ''}" type="button" data-pass-status="available">Disponibles</button>
          <button class="filter-chip ${passFilterStatus === 'used' ? 'is-active' : ''}" type="button" data-pass-status="used">Utilizados</button>
          <button class="filter-chip ${passFilterStatus === 'cancelled' ? 'is-active' : ''}" type="button" data-pass-status="cancelled">Cancelados</button>
          <button class="filter-chip ${passFilterStatus === 'expired' ? 'is-active' : ''}" type="button" data-pass-status="expired">Vencidos</button>
        </div>
      </div>
    </section>

    <div class="section-head" style="margin-top:20px">
      <div>
        <h2>Listado de pases</h2>
        <p id="passListCount">${filtered.length} pase${filtered.length === 1 ? '' : 's'} encontrado${filtered.length === 1 ? '' : 's'}.</p>
      </div>
    </div>

    <div class="table-wrap pass-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Persona</th>
            <th scope="col">Tipo</th>
            <th scope="col">Clase y horario</th>
            <th scope="col">Profesor</th>
            <th scope="col">Importe</th>
            <th scope="col">Pago</th>
            <th scope="col">Estado</th>
            <th scope="col">Acción</th>
          </tr>
        </thead>
        <tbody id="passTableBody">
          ${adminPassRows(filtered)}
        </tbody>
      </table>
    </div>

    <div class="pass-cards-mobile" id="passCardsMobile">
      ${adminPassCardsMobile(filtered)}
    </div>

    <p class="modal-note" style="margin-top:24px">Demostración local: los pases y sus asistencias se almacenan en este navegador y no consumen créditos de planes regulares.</p>
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
      <h3>${payment ? escapeHtml(`Q ${formatAmount(payment.amount)}`) : escapeHtml(priceText(planForStudent(child.id).price))} <span class="status-pill ${paid ? 'is-paid' : (paymentStatus(payment) === 'En mora' ? 'is-mora' : 'is-due')}">${escapeHtml(paymentStatus(payment))}</span></h3>
      <p class="payment-meta">${escapeHtml(planForStudent(child.id).planName)}${planReviewTag(planForStudent(child.id))}${payment ? '' : ' · cuota del plan, sin registro este mes'}</p>
      <div class="form-actions">
        <button class="button button--light button--small" type="button" data-child-payment="${escapeHtml(child.id)}" aria-label="Ver mensualidad de ${escapeHtml(child.name)}">Ver mensualidad</button>
        <button class="button button--small" type="button" data-child-carnet="${escapeHtml(child.id)}" aria-label="Ver carné de ${escapeHtml(child.name)}">Ver carné</button>
      </div>
    </article>
  `;
}

function consentCardMarkup(guardian) {
  const hasConsent = Boolean(guardian?.consentSignedAt);
  const signed = hasConsent ? parseDayKey(guardian.consentSignedAt) : null;
  const isDemo = Boolean(guardian?.isDemo);

  if (!hasConsent) {
    return `
      <article class="surface-card">
        <p class="eyebrow">Manejo de datos de menores</p>
        <h3>Sin constancia registrada</h3>
        <p class="payment-meta">${escapeHtml(guardian.name)}<br/>No se ha registrado una constancia de consentimiento para este tutor.</p>
        <p class="payment-meta" style="margin-top:16px">Como tutor accedés únicamente a la información de tus propios hijos.</p>
        <div class="form-actions"><button class="button button--light button--small" type="button" data-open-consent>Ver constancia</button></div>
      </article>
    `;
  }

  return `
    <article class="surface-card">
      <p class="eyebrow">Manejo de datos de menores${isDemo ? ' · Ejemplo demo' : ''}</p>
      <h3>Consentimiento firmado</h3>
      <p class="payment-meta">${escapeHtml(guardian.name)}<br/>Firmado el ${escapeHtml(shortDate(signed))} ${signed.getFullYear()}${isDemo ? ' (ejemplo demo)' : ''}</p>
      <p class="payment-meta" style="margin-top:16px">Como tutor accedés únicamente a la información de tus propios hijos.</p>
      <div class="form-actions"><button class="button button--light button--small" type="button" data-open-consent>Ver constancia</button></div>
    </article>
  `;
}

function renderGuardianHome() {
  const guardian = currentGuardian();
  if (isSupabaseConnected && !guardian) {
    return `
      <header class="page-heading">
        <div>
          <p class="eyebrow">${escapeHtml(shortDayLabel(TODAY))}</p>
          <h1>Hola,<br/><span>Sin perfil de tutor.</span></h1>
        </div>
      </header>
      <div class="empty-state">
        <strong>Perfil de tutor no vinculado</strong>
        Tu cuenta autenticada (${escapeHtml(authenticatedUser?.email || '')}) no tiene un perfil de tutor asociado en el sistema.
      </div>
    `;
  }
  const children = childrenOf(guardian);
  const firstName = guardian?.firstName || (guardian?.name ? guardian.name.split(' ')[0] : 'Tutor');
  return `
    <header class="page-heading">
      <div>
        <p class="eyebrow">${escapeHtml(shortDayLabel(TODAY))}</p>
        <h1>${escapeHtml(greeting())},<br/><span>${escapeHtml(firstName)}.</span></h1>
        <p>${children.length === 1 ? 'Seguimiento de tu hijo' : 'Seguimiento de tus hijos'} en la academia. Esta vista es de solo consulta.</p>
      </div>
      <button class="button" type="button" data-go="carnet">Ver carnés</button>
    </header>
    <section class="section">
      <div class="section-head"><div><h2>A tu cargo</h2><p>Próxima clase, última asistencia y mensualidad del mes.</p></div><span class="tag">${children.length} alumno${children.length === 1 ? '' : 's'}</span></div>
      <div class="cards-grid">
        ${children.length ? children.map(childCardMarkup).join('') : '<div class="empty-state"><strong>Sin alumnos a cargo</strong>No hay alumnos vinculados a tu cuenta de tutor en el sistema.</div>'}
        ${guardian ? consentCardMarkup(guardian) : ''}
      </div>
    </section>
  `;
}

function guardianCarnetMarkup() {
  const child = studentById(activeChildId);
  if (!child) return '<div class="empty-state"><strong>Sin alumnos a cargo</strong>No hay ningún alumno seleccionado o vinculado a este tutor.</div>';
  const next = nextClassForStudent(child.id);
  return `
    <div class="member-card-wrap">
      ${memberCardMarkup(child)}
      <aside class="surface-card member-info-card">
        <div>
          <p class="eyebrow">Recepción</p>
          <h2>${escapeHtml(child.name.split(' ')[0])} en la academia</h2>
          <p class="payment-meta">${next ? `Mostrá este carné al llegar a <strong>${escapeHtml(next.name)}</strong>, ${escapeHtml(next.day.toLowerCase())} a las ${escapeHtml(next.time)}.` : 'Mostrá este carné en recepción al llegar a la academia.'} El carné es permanente y no caduca con el ciclo de pago.</p>
        </div>
        <div class="member-info-badges">
          <div class="info-badge">
            <span class="info-badge-label">N.º de carné</span>
            <strong>${escapeHtml(child.id)}</strong>
          </div>
          <div class="info-badge">
            <span class="info-badge-label">Nivel asignado</span>
            <strong>${escapeHtml(child.level)}</strong>
          </div>
        </div>
      </aside>
    </div>
    ${membershipStatusMarkup(child)}
  `;
}

function updatePassViews() {
  const filtered = filteredPassesList();
  const tableBody = elements.content.querySelector('#passTableBody');
  if (tableBody) tableBody.innerHTML = adminPassRows(filtered);
  const cardsContainer = elements.content.querySelector('#passCardsMobile');
  if (cardsContainer) cardsContainer.innerHTML = adminPassCardsMobile(filtered);
  const countEl = elements.content.querySelector('#passListCount');
  if (countEl) countEl.textContent = `${filtered.length} pase${filtered.length === 1 ? '' : 's'} encontrado${filtered.length === 1 ? '' : 's'}.`;

  // Update active chips
  elements.content.querySelectorAll('[data-pass-date]').forEach((btn) => {
    const active = btn.dataset.passDate === passFilterDate;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  elements.content.querySelectorAll('[data-pass-type]').forEach((btn) => {
    const active = btn.dataset.passType === passFilterType;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  elements.content.querySelectorAll('[data-pass-pay]').forEach((btn) => {
    const active = btn.dataset.passPay === passFilterPayment;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  elements.content.querySelectorAll('[data-pass-status]').forEach((btn) => {
    const active = btn.dataset.passStatus === passFilterStatus;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function openCreatePassModal() {
  if (!allowPassAction(true)) return;
  openModal({
    title: 'Crear nuevo pase',
    eyebrow: 'Pruebas y particulares · Emisión',
    body: `
      <form id="createPassForm" class="form-stack">
        <fieldset class="form-group">
          <legend class="field-legend">¿Para quién es el pase?</legend>
          <div class="radio-row">
            <label class="radio-label">
              <input type="radio" name="personType" value="visitor" checked id="createPassPersonVisitor" />
              <span>Visitante nuevo</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="personType" value="student" id="createPassPersonStudent" />
              <span>Alumno registrado</span>
            </label>
          </div>

          <div id="visitorFields" class="form-subfields" style="margin-top:12px">
            <label class="field">
              <span>Nombre completo *</span>
              <input type="text" name="visitorName" id="createPassVisitorName" placeholder="Ej. Mariana Morales" required />
            </label>
            <label class="field">
              <span>Teléfono / Contacto *</span>
              <input type="tel" name="visitorContact" id="createPassVisitorContact" placeholder="Ej. 5555-4421" required />
            </label>
            <p class="modal-note">No se requiere contratar un plan ni inscribir al visitante en el padrón regular.</p>
          </div>

          <div id="studentFields" class="form-subfields is-hidden" style="margin-top:12px">
            <label class="field">
              <span>Seleccionar alumno *</span>
              <select name="studentId" id="createPassStudentSelect">
                ${state.students.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.id)}) · ${escapeHtml(s.plan)}</option>`).join('')}
              </select>
            </label>
            <p class="modal-note">Este pase no consume clases del plan regular ni modifica su saldo.</p>
          </div>
        </fieldset>

        <fieldset class="form-group">
          <legend class="field-legend">Tipo de clase</legend>
          <div class="radio-row">
            <label class="radio-label">
              <input type="radio" name="passType" value="trial" checked id="createPassTypeTrial" />
              <span>Clase de prueba (Q60)</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="passType" value="private" id="createPassTypePrivate" />
              <span>Clase particular</span>
            </label>
          </div>
        </fieldset>

        <label class="field">
          <span>Importe acordado (Q) *</span>
          <input type="number" name="amount" id="createPassAmount" value="60" min="0.01" step="0.01" readonly required />
          <span class="field-hint" id="createPassAmountHint">Precio fijado para clase de prueba: Q60.</span>
        </label>

        <fieldset class="form-group">
          <legend class="field-legend">Clase y programación</legend>
          <label class="field">
            <span>Clase o sesión *</span>
            <select name="classOption" id="createPassClassSelect">
              ${classData.map((c) => `<option value="${escapeHtml(c.id)}" data-teacher="${escapeHtml(c.teacher)}" data-time="${escapeHtml(c.time)}">${escapeHtml(c.name)} · ${escapeHtml(c.teacher)} (${WEEKDAY_SHORT[c.weekday]} ${escapeHtml(c.time)})</option>`).join('')}
              <option value="custom">Sesión particular personalizada...</option>
            </select>
          </label>

          <div id="customSessionFields" class="form-subfields is-hidden" style="margin-top:12px">
            <label class="field">
              <span>Nombre de la sesión / Disciplina *</span>
              <input type="text" name="customClassName" id="createPassCustomClassName" placeholder="Ej. Técnica de Giros Salsa" />
            </label>
          </div>

          <div class="split-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <label class="field">
              <span>Fecha de la clase *</span>
              <input type="date" name="passDate" id="createPassDate" value="${dayKey(TODAY)}" required />
            </label>
            <label class="field">
              <span>Horario *</span>
              <input type="text" name="passTime" id="createPassTime" value="6:00 PM" placeholder="Ej. 6:00 PM" required />
            </label>
          </div>

          <label class="field" style="margin-top:12px">
            <span>Profesor asignado *</span>
            <select name="passTeacher" id="createPassTeacher">
              ${[...new Set(classData.map(c => c.teacher).filter(Boolean))].map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}
            </select>
          </label>

          <p class="modal-note" id="createPassVigenciaNote" style="margin-top:8px">Vigencia: Válido hasta el final del día de la clase seleccionada (23:59 hrs).</p>
        </fieldset>

        <fieldset class="form-group">
          <legend class="field-legend">Estado del pago</legend>
          <div class="radio-row">
            <label class="radio-label">
              <input type="radio" name="paymentStatus" value="pending" checked id="createPassPayPending" />
              <span>Pendiente de pago</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="paymentStatus" value="paid" id="createPassPayPaid" />
              <span>Pagado ahora</span>
            </label>
          </div>

          <div id="paymentMethodFields" class="form-subfields is-hidden" style="margin-top:12px">
            <label class="field">
              <span>Método de pago *</span>
              <select name="paymentMethod" id="createPassPaymentMethod">
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta">Tarjeta</option>
              </select>
            </label>
            <label class="field">
              <span>Referencia / Comprobante</span>
              <input type="text" name="paymentReference" id="createPassPaymentRef" placeholder="Ej. REC-1234 o Boleta 567" />
            </label>
          </div>
        </fieldset>

        <div class="form-actions">
          <button class="button button--light" type="button" data-close-modal>Cancelar</button>
          <button class="button button--red" type="submit" id="createPassSubmitBtn">Emitir pase</button>
        </div>
      </form>
    `
  });
  updateCreatePassForm();
  const form = document.querySelector('#createPassForm');
  const selected = classData.find(c => c.id === form.elements.classOption.value);
  if (selected) form.elements.passDate.value = dayKey(addDays(new Date(), (selected.weekday - new Date().getDay() + 7) % 7));
  updateCreatePassForm();
}

function updateCreatePassForm() {
  const form = document.querySelector('#createPassForm');
  if (!form) return;

  const isVisitor = form.elements.personType?.value === 'visitor';
  const visitorFields = form.querySelector('#visitorFields');
  const studentFields = form.querySelector('#studentFields');
  const visitorName = form.querySelector('#createPassVisitorName');
  const visitorContact = form.querySelector('#createPassVisitorContact');

  if (visitorFields) visitorFields.classList.toggle('is-hidden', !isVisitor);
  if (studentFields) studentFields.classList.toggle('is-hidden', isVisitor);
  if (visitorName) visitorName.required = isVisitor;
  if (visitorContact) visitorContact.required = isVisitor;

  const isTrial = form.elements.passType?.value === 'trial';
  const amountInput = form.querySelector('#createPassAmount');
  const amountHint = form.querySelector('#createPassAmountHint');

  if (amountInput) {
    if (isTrial) {
      amountInput.value = '60';
      amountInput.readOnly = true;
      if (amountHint) amountHint.textContent = 'Precio fijado para clase de prueba: Q60.';
    } else {
      amountInput.readOnly = false;
      if (amountInput.dataset.previousType !== 'private') amountInput.value = '';
      // El importe particular lo ingresa administración, sin precio sugerido.
      if (amountHint) amountHint.textContent = 'Ingresá el importe acordado para la clase particular (mayor a Q0).';
    }
  }

  if (amountInput) amountInput.dataset.previousType = isTrial ? 'trial' : 'private';

  const isCustomClass = form.elements.classOption?.value === 'custom';
  const customFields = form.querySelector('#customSessionFields');
  const customInput = form.querySelector('#createPassCustomClassName');
  if (customFields) customFields.classList.toggle('is-hidden', !isCustomClass);
  if (customInput) customInput.required = isCustomClass;

  if (!isCustomClass) {
    const selectedOption = form.elements.classOption?.selectedOptions?.[0];
    if (selectedOption) {
      if (selectedOption.dataset.teacher && form.elements.passTeacher) {
        form.elements.passTeacher.value = selectedOption.dataset.teacher;
      }
      if (selectedOption.dataset.time && form.elements.passTime) {
        form.elements.passTime.value = selectedOption.dataset.time;
      }
    }
  }

  const isPaid = form.elements.paymentStatus?.value === 'paid';
  const paymentFields = form.querySelector('#paymentMethodFields');
  if (paymentFields) paymentFields.classList.toggle('is-hidden', !isPaid);

  const dateVal = form.elements.passDate?.value;
  const vigenciaNote = form.querySelector('#createPassVigenciaNote');
  if (vigenciaNote && dateVal) {
    vigenciaNote.textContent = `Vigencia: Válido hasta las 23:59 del ${formatDayKeyReadable(dateVal)}.`;
  }
}

function handleCreatePassSubmit(event) {
  event.preventDefault();
  if (!allowPassAction(true)) return;
  const form = event.target;
  const submitBtn = form.querySelector('#createPassSubmitBtn');
  if (submitBtn?.disabled) return;
  submitBtn.disabled = true;

  const isVisitor = form.elements.personType.value === 'visitor';
  let studentId = null;
  let studentName = '';
  let contact = '';

  if (isVisitor) {
    studentName = cleanText(form.elements.visitorName.value, 80);
    contact = cleanText(form.elements.visitorContact.value, 80);
    if (!studentName) {
      submitBtn.disabled = false;
      showToast('Datos incompletos', 'Ingresá el nombre completo del visitante.');
      return;
    }
    if (!contact) {
      submitBtn.disabled = false;
      showToast('Datos incompletos', 'Ingresá el teléfono o contacto del visitante.');
      return;
    }
  } else {
    studentId = form.elements.studentId.value;
    const student = studentById(studentId);
    if (!student) {
      submitBtn.disabled = false;
      showToast('Alumno inválido', 'Seleccioná un alumno válido.');
      return;
    }
    studentName = student.name;
    contact = student.phone || '';
  }

  const passType = form.elements.passType.value === 'private' ? 'private' : 'trial';
  const amount = passType === 'trial' ? 60 : Number(form.elements.amount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    submitBtn.disabled = false;
    showToast('Importe inválido', 'El importe de una clase particular debe ser mayor a cero.');
    return;
  }

  const classOption = form.elements.classOption.value;
  let classId = classOption;
  let className = '';
  let teacher = form.elements.passTeacher.value;
  const date = form.elements.passDate.value || dayKey(TODAY);
  const time = cleanText(form.elements.passTime.value, 30) || '6:00 PM';

  if (classOption === 'custom') {
    classId = `particular-${Date.now()}`;
    className = cleanText(form.elements.customClassName.value, 80) || 'Clase particular';
  } else {
    const regularClass = classData.find((c) => c.id === classOption);
    className = regularClass?.name || 'Clase regular';
  }

  const selectedClass = classData.find(c => c.id === classOption);
  const selectedDate = new Date(`${date}T12:00:00`);
  if (!isValidDayKey(date) || date < dayKey(new Date()) || !teacher ||
      (classOption === 'custom' && passType !== 'private') ||
      (classOption !== 'custom' && (!selectedClass || selectedDate.getDay() !== selectedClass.weekday))) {
    submitBtn.disabled = false;
    showToast('Revisá la programación', 'Elegí una fecha vigente que coincida con el día de la clase. Las sesiones personalizadas son para particulares.');
    return;
  }

  const validUntil = `${date}T23:59:59`;
  const paymentStatus = form.elements.paymentStatus.value === 'paid' ? 'paid' : 'pending';
  const paymentMethod = paymentStatus === 'paid' ? (form.elements.paymentMethod?.value || 'Efectivo') : null;
  const paymentReference = paymentStatus === 'paid' ? cleanText(form.elements.paymentReference?.value, 80) : '';

  const code = generatePassCode();
  const id = `PASS-${code}`;

  const newPass = {
    id,
    code,
    type: passType,
    isVisitor,
    studentId,
    studentName,
    contact,
    classId,
    className,
    teacher,
    date,
    time,
    validUntil,
    amount,
    paymentStatus,
    paymentMethod,
    paidAt: paymentStatus === 'paid' ? dayKey(TODAY) : null,
    paymentReference,
    status: 'available',
    cancelReason: null,
    cancelledAt: null,
    cancelledBy: null,
    attendedAt: null,
    attendedBy: null,
    attendedPendingAuth: false,
    pendingAuthNote: null,
    createdAt: dayKey(TODAY)
  };

  const nextState = structuredClone(state);
  if (!Array.isArray(nextState.singlePasses)) nextState.singlePasses = [];
  nextState.singlePasses.unshift(newPass);

  try {
    persistState(nextState);
    showToast('Pase emitido', `Pase ${code} creado para ${studentName}.`);
    openPassModal(newPass.id);
    if (activeRoute === 'pases') {
      updatePassViews();
    }
  } catch (error) {
    submitBtn.disabled = false;
    showToast('Error al guardar', error.message);
  }
}

function openPassModal(passId) {
  const pass = passById(passId);
  if (!pass) return;
  const status = passStatus(pass);

  openModal({
    title: `Pase de clase · ${pass.code}`,
    eyebrow: `${passTypeLabel(pass.type)} · Identificación digital`,
    body: `
      <div class="pass-ticket-print" id="passTicketPrint">
        <div class="pass-ticket-header">
          <div class="pass-ticket-brand">
            <img src="./assets/inmotion-logo.svg" alt="In Motion" style="height:24px" />
            <span class="status-pill ${pass.type === 'trial' ? 'is-trial' : 'is-private'}">${escapeHtml(passTypeLabel(pass.type))}</span>
          </div>
          <span class="${passStatusPillClass(status)}">${passStatusLabel(status)}</span>
        </div>

        <div class="pass-ticket-body">
          <div class="pass-qr-container">
            ${passQrMarkup(pass)}
            <div class="pass-code-display">
              <small>CÓDIGO CORTO</small>
              <strong class="code-mono">${escapeHtml(pass.code)}</strong>
            </div>
          </div>

          <div class="pass-details-list">
            <div class="pass-detail-item">
              <span class="detail-label">Persona:</span>
              <span class="detail-val"><strong>${escapeHtml(pass.studentName)}</strong></span>
              <small class="payment-meta">${pass.isVisitor ? `Visitante · Tel: ${escapeHtml(pass.contact)}` : `Alumno (${escapeHtml(pass.studentId)})`}</small>
            </div>

            <div class="pass-detail-item">
              <span class="detail-label">Clase / Sesión:</span>
              <span class="detail-val">${escapeHtml(pass.className)}</span>
            </div>

            <div class="pass-detail-grid">
              <div class="pass-detail-item">
                <span class="detail-label">Fecha:</span>
                <span class="detail-val">${formatDayKeyReadable(pass.date)}</span>
              </div>
              <div class="pass-detail-item">
                <span class="detail-label">Horario:</span>
                <span class="detail-val">${escapeHtml(pass.time)}</span>
              </div>
            </div>

            <div class="pass-detail-grid">
              <div class="pass-detail-item">
                <span class="detail-label">Profesor:</span>
                <span class="detail-val">${escapeHtml(pass.teacher)}</span>
              </div>
              <div class="pass-detail-item">
                <span class="detail-label">Importe:</span>
                <span class="detail-val"><strong>Q ${escapeHtml(pass.amount)}</strong></span>
              </div>
            </div>

            <div class="pass-detail-item">
              <span class="detail-label">Estado del pago:</span>
              <span class="${passPaymentPillClass(pass.paymentStatus)}">${passPaymentStatusLabel(pass.paymentStatus)} ${pass.paymentMethod ? `(${escapeHtml(pass.paymentMethod)})` : ''}</span>
            </div>

            <div class="pass-detail-item">
              <span class="detail-label">Vigencia:</span>
              <small class="payment-meta">Hasta las 23:59 del ${formatDayKeyReadable(pass.date)}</small>
            </div>

            ${status === 'used' && pass.attendedAt ? `
            <div class="pass-detail-item pass-usage-box">
              <span class="detail-label">Asistencia registrada:</span>
              <small>${formatDateTime(pass.attendedAt)} por ${escapeHtml(pass.attendedBy || 'Personal')}</small>
              ${pass.attendedPendingAuth ? `<br/><small style="color:var(--brand-red)">* Excepción: Autorizado con cobro pendiente (${escapeHtml(pass.pendingAuthNote || '')})</small>` : ''}
            </div>` : ''}

            ${status === 'cancelled' && pass.cancelReason ? `
            <div class="pass-detail-item pass-cancel-box">
              <span class="detail-label" style="color:var(--brand-red)">Pase cancelado:</span>
              <small>${escapeHtml(pass.cancelReason)} (${formatDateTime(pass.cancelledAt)})</small>
            </div>` : ''}
          </div>
        </div>

        <p class="modal-note pass-demo-notice">Demostración local: los datos residen en este navegador. Para operar entre dispositivos se requiere backend centralizado.</p>

        <div class="modal-actions-bar">
          <button class="button button--light" type="button" data-print-pass>Imprimir / Guardar pase ⤓</button>
          ${status === 'available' && pass.date === dayKey(TODAY) ? `<button class="button button--red" type="button" data-modal-validate="${escapeHtml(pass.code)}">Validar asistencia</button>` : ''}
          ${pass.paymentStatus === 'pending' && status !== 'cancelled' && activeRole === 'admin' ? `<button class="button button--light" type="button" data-modal-open-collect="${escapeHtml(pass.id)}">Registrar cobro</button>` : ''}
          <button class="button button--light" type="button" data-close-modal>Cerrar</button>
        </div>
      </div>
    `
  });
}

function openValidatePassModal(initialCode = null) {
  if (!allowPassAction()) return;
  const query = initialCode ? String(initialCode).trim() : '';
  const foundPass = query ? passByCode(query) : null;

  if (query && !foundPass) {
    openModal({
      title: 'Validar pase individual',
      eyebrow: 'Control de acceso · Búsqueda',
      body: `
        <div class="banner banner--danger" style="margin-bottom:20px">
          <strong>Código no encontrado o mal formado</strong>
          <p>No se encontró ningún pase con el código “${escapeHtml(query)}”. Verificá que el código corto de 6 caracteres o identificador esté bien escrito.</p>
        </div>
        <form id="validatePassSearchForm" class="form-stack">
          <label class="field">
            <span>Código del pase (6 caracteres o ID completo)</span>
            <input type="text" name="passCode" id="validatePassInput" placeholder="Ej. 8F2K9M o INM-PASS-8F2K9M" value="${escapeHtml(query)}" autofocus required />
          </label>
          <div class="form-actions">
            <button class="button button--light" type="button" data-close-modal>Cerrar</button>
            <button class="button button--red" type="submit">Buscar pase</button>
          </div>
        </form>
      `
    });
    return;
  }

  if (foundPass) {
    openModal({
      title: `Validar pase · ${foundPass.code}`,
      eyebrow: 'Control de acceso · Confirmación',
      body: renderValidationPassCard(foundPass)
    });
    return;
  }

  const todayPasses = (state.singlePasses || []).filter((p) => p.date === dayKey(TODAY));
  openModal({
    title: 'Validar pase individual',
    eyebrow: 'Control de acceso · Recepción y maestros',
    body: `
      <div class="camera-status-banner surface-card" style="margin-bottom:20px">
        <p class="eyebrow" style="color:var(--brand-red)">Lector de cámara</p>
        <p class="payment-meta" style="margin:4px 0 0 0">
          <strong>Escaneo por cámara pendiente:</strong> En este prototipo (sin dependencias añadidas) no hay lector de cámara en vivo. Validá ingresando el código del pase o seleccionando un pase programado para hoy.
        </p>
      </div>

      <form id="validatePassSearchForm" class="form-stack" style="margin-bottom:24px">
        <label class="field">
          <span>Código corto o identificador de pase</span>
          <input type="text" name="passCode" id="validatePassInput" placeholder="Ej. 8F2K9M o INM-PASS-8F2K9M" autocomplete="off" autofocus required />
        </label>
        <div class="form-actions">
          <button class="button button--light" type="button" data-close-modal>Cancelar</button>
          <button class="button button--red" type="submit">Buscar y validar</button>
        </div>
      </form>

      ${todayPasses.length ? `
      <div class="section-head" style="margin-top:16px">
        <div>
          <h3>Pases programados para hoy</h3>
          <p>Tocá un pase para abrir su validación directa.</p>
        </div>
        <span class="tag">${todayPasses.length}</span>
      </div>
      <div class="quick-pass-list">
        ${todayPasses.map((p) => {
          const s = passStatus(p);
          return `
            <button type="button" class="quick-pass-card" data-open-validate-pass="${escapeHtml(p.code)}">
              <div class="quick-pass-card-left">
                <strong class="code-mono">${escapeHtml(p.code)}</strong>
                <span><strong>${escapeHtml(p.studentName)}</strong> · ${escapeHtml(p.className)}</span>
                <small class="payment-meta">${escapeHtml(p.time)} · Prof. ${escapeHtml(p.teacher)}</small>
              </div>
              <div class="quick-pass-card-right">
                <span class="${passStatusPillClass(s)}">${passStatusLabel(s)}</span>
                <span class="${passPaymentPillClass(p.paymentStatus)}">${passPaymentStatusLabel(p.paymentStatus)} (Q${p.amount})</span>
              </div>
            </button>
          `;
        }).join('')}
      </div>
      ` : '<p class="modal-note">No hay pases programados para hoy en la demo. Ingresá el código para buscar en otras fechas.</p>'}
    `
  });
}

function renderValidationPassCard(pass) {
  const status = passStatus(pass);
  const isToday = pass.date === dayKey(TODAY);
  const isFuture = pass.date > dayKey(TODAY);

  return `
    <div class="validation-card-wrap">
      <div class="surface-card validation-summary-card">
        <div class="validation-header-row">
          <div>
            <span class="status-pill ${pass.type === 'trial' ? 'is-trial' : 'is-private'}">${escapeHtml(passTypeLabel(pass.type))}</span>
            <h3 style="margin-top:8px">${escapeHtml(pass.studentName)}</h3>
            <p class="payment-meta">${pass.isVisitor ? `Visitante · Tel: ${escapeHtml(pass.contact)}` : `Alumno regular (${escapeHtml(pass.studentId)})`}</p>
          </div>
          <div style="text-align:right">
            <span class="code-mono" style="font-size:1.1rem">${escapeHtml(pass.code)}</span>
            <div style="margin-top:8px">
              <span class="${passStatusPillClass(status)}">${passStatusLabel(status)}</span>
            </div>
            <div style="margin-top:4px">
              <span class="${passPaymentPillClass(pass.paymentStatus)}">${passPaymentStatusLabel(pass.paymentStatus)}</span>
            </div>
          </div>
        </div>

        <hr style="margin:16px 0;border:none;border-top:1px solid rgba(255,255,255,0.08)" />

        <div class="validation-info-grid">
          <div><span class="detail-label">Clase:</span> <strong>${escapeHtml(pass.className)}</strong></div>
          <div><span class="detail-label">Fecha:</span> ${formatDayKeyReadable(pass.date)}</div>
          <div><span class="detail-label">Horario:</span> ${escapeHtml(pass.time)}</div>
          <div><span class="detail-label">Profesor:</span> ${escapeHtml(pass.teacher)}</div>
          <div><span class="detail-label">Importe:</span> <strong>Q ${escapeHtml(pass.amount)}</strong></div>
          <div><span class="detail-label">Vigencia:</span> Hasta 23:59 del día de clase</div>
        </div>
      </div>

      ${status === 'cancelled' ? `
      <div class="banner banner--danger" style="margin-top:20px">
        <strong>🚫 Pase cancelado</strong>
        <p>Este pase fue cancelado el ${formatDateTime(pass.cancelledAt)} por ${escapeHtml(pass.cancelledBy || 'Administración')}.<br/>Motivo: “${escapeHtml(pass.cancelReason || 'Sin motivo')}”. No permite registrar asistencia.</p>
      </div>
      <div class="form-actions" style="margin-top:16px">
        <button class="button button--light" type="button" data-retry-validate>Buscar otro pase</button>
      </div>
      ` : ''}

      ${status === 'used' ? `
      <div class="banner banner--info" style="margin-top:20px">
        <strong>✓ Asistencia ya registrada</strong>
        <p>Este pase ya fue utilizado el ${formatDateTime(pass.attendedAt)} por ${escapeHtml(pass.attendedBy || 'Personal')}.
        ${pass.attendedPendingAuth ? `<br/><em>* Ingreso autorizado con cobro pendiente: ${escapeHtml(pass.pendingAuthNote || '')}</em>` : ''}
        <br/>No se duplican registros de asistencia.</p>
      </div>
      <div class="form-actions" style="margin-top:16px">
        <button class="button button--light" type="button" data-retry-validate>Buscar otro pase</button>
      </div>
      ` : ''}

      ${status === 'expired' ? `
      <div class="banner banner--danger" style="margin-top:20px">
        <strong>⏱ Pase vencido</strong>
        <p>La vigencia de este pase finalizó (${formatDayKeyReadable(pass.date)} a las 23:59). No permite registrar asistencia.</p>
      </div>
      <div class="form-actions" style="margin-top:16px">
        <button class="button button--light" type="button" data-retry-validate>Buscar otro pase</button>
      </div>
      ` : ''}

      ${status === 'available' && isFuture ? `
      <div class="banner banner--warning" style="margin-top:20px">
        <strong>📅 Fecha anterior a la clase</strong>
        <p>Este pase corresponde a la clase programada para el <strong>${formatDayKeyReadable(pass.date)}</strong>. Todavía no corresponde utilizarlo.</p>
      </div>
      <div class="form-actions" style="margin-top:16px">
        <button class="button button--light" type="button" data-retry-validate>Buscar otro pase</button>
      </div>
      ` : ''}

      ${status === 'available' && !isFuture && pass.paymentStatus === 'paid' ? `
      <div class="banner banner--success" style="margin-top:20px">
        <strong>✓ Pase disponible y pagado (Q ${pass.amount})</strong>
        <p>El pase está al día y listo para registrar la llegada del alumno.</p>
      </div>
      <form id="confirmPassAttendanceForm" style="margin-top:16px">
        <input type="hidden" name="passId" value="${escapeHtml(pass.id)}" />
        <div class="form-actions">
          <button class="button button--light" type="button" data-retry-validate>Buscar otro</button>
          <button class="button button--red" type="submit" id="confirmAttendanceBtn">Confirmar asistencia</button>
        </div>
      </form>
      ` : ''}

      ${status === 'available' && !isFuture && pass.paymentStatus === 'pending' ? `
      <div class="banner banner--warning" style="margin-top:20px">
        <strong>⚠️ Cobro pendiente: Q ${pass.amount}</strong>
        <p>Este pase no ha sido liquidado en el sistema.</p>
      </div>

      ${activeRole === 'teacher' ? `
      <p class="modal-note" style="color:var(--brand-red);margin-top:12px">
        Como maestro podés ver el cobro pendiente, pero no podés registrar cobros ni autorizar excepciones. Por favor indicá al alumno pasar por recepción o administración.
      </p>
      <div class="form-actions" style="margin-top:16px">
        <button class="button button--light" type="button" data-retry-validate>Buscar otro pase</button>
      </div>
      ` : `
      <div class="pending-admin-actions" style="margin-top:16px">
        <div class="filter-row" style="margin-bottom:16px">
          <button class="button button--red" type="button" data-modal-open-collect="${escapeHtml(pass.id)}">Registrar cobro de Q ${pass.amount} primero</button>
          <button class="button button--light" type="button" data-retry-validate>Volver</button>
        </div>

        <details class="exception-details surface-card" style="margin-top:16px;padding:16px">
          <summary class="exception-summary" style="cursor:pointer;font-weight:600">Autorizar entrada con pago pendiente (Excepción)</summary>
          <form id="authPendingAttendanceForm" style="margin-top:16px">
            <input type="hidden" name="passId" value="${escapeHtml(pass.id)}" />
            <p class="payment-meta">Podés permitir el acceso excepcional. El pase se marcará como utilizado pero el cobro permanecerá pendiente.</p>
            <label class="field" style="margin-top:12px">
              <span>Nota de autorización / Motivo *</span>
              <input type="text" name="pendingNote" placeholder="Ej. Autorizado por administración: pagará al salir" required />
            </label>
            <label class="student-check" style="margin:12px 0;display:flex;align-items:center;gap:8px">
              <input type="checkbox" name="confirmPendingAuth" required />
              <span>Confirmo autorizar la asistencia manteniendo el cobro como pendiente</span>
            </label>
            <div class="form-actions">
              <button class="button button--red" type="submit" id="authPendingSubmitBtn">Autorizar asistencia excepcional</button>
            </div>
          </form>
        </details>
      </div>
      `}
      ` : ''}
    </div>
  `;
}

function handleValidatePassSearchSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const input = form.querySelector('#validatePassInput');
  const code = input ? input.value.trim() : '';
  if (!code) return;
  openValidatePassModal(code);
}

function handleConfirmPassAttendanceSubmit(event) {
  event.preventDefault();
  if (!allowPassAction(false)) return;
  const form = event.target;
  const submitBtn = form.querySelector('#confirmAttendanceBtn');
  if (submitBtn?.disabled) return;
  submitBtn.disabled = true;

  const passId = form.elements.passId.value;
  const pass = passById(passId);
  if (!canUsePass(pass)) return;
  if (!pass) {
    showToast('Pase no encontrado', 'El pase no existe o fue eliminado.');
    return;
  }

  const status = passStatus(pass);
  if (status === 'cancelled') {
    showToast('Pase cancelado', 'Este pase fue cancelado y no puede utilizarse.');
    return;
  }
  if (status === 'used') {
    showToast('Asistencia ya registrada', 'Este pase ya fue utilizado anteriormente.');
    return;
  }
  if (status === 'expired') {
    showToast('Pase vencido', 'La vigencia del pase ha finalizado.');
    return;
  }
  if (pass.date > dayKey(TODAY)) {
    showToast('Fecha no corresponde', `La clase es el ${formatDayKeyReadable(pass.date)}. No se puede registrar antes.`);
    return;
  }

  const nextState = structuredClone(state);
  const targetPass = nextState.singlePasses.find((p) => p.id === passId);
  if (!targetPass) return;

  targetPass.status = 'used';
  targetPass.attendedAt = new Date().toISOString();
  targetPass.attendedBy = roleConfig[activeRole]?.label || activeRole;

  try {
    persistState(nextState);
    showToast('Asistencia registrada', `Asistencia confirmada para ${pass.studentName} (${pass.className}).`);
    openValidatePassModal(pass.code);
    if (activeRoute === 'pases') updatePassViews();
    if (activeRoute === 'asistencia') renderApp();
  } catch (err) {
    submitBtn.disabled = false;
    showToast('Error al guardar', err.message);
  }
}

function handleAuthPendingAttendanceSubmit(event) {
  event.preventDefault();
  if (!allowPassAction(true)) return;
  const form = event.target;
  const submitBtn = form.querySelector('#authPendingSubmitBtn');
  if (submitBtn?.disabled) return;
  submitBtn.disabled = true;

  const passId = form.elements.passId.value;
  const note = cleanText(form.elements.pendingNote.value, 200);
  const confirmed = form.elements.confirmPendingAuth.checked;

  if (!note || !confirmed) {
    submitBtn.disabled = false;
    showToast('Confirmación requerida', 'Debes ingresar una nota de autorización y marcar la casilla de confirmación.');
    return;
  }

  const pass = passById(passId);
  if (!canUsePass(pass, true)) return;
  if (!pass) return;

  const nextState = structuredClone(state);
  const targetPass = nextState.singlePasses.find((p) => p.id === passId);
  if (!targetPass) return;

  targetPass.status = 'used';
  targetPass.attendedAt = new Date().toISOString();
  targetPass.attendedBy = 'Administración (MB)';
  targetPass.attendedPendingAuth = true;
  targetPass.pendingAuthNote = note;

  try {
    persistState(nextState);
    showToast('Entrada autorizada', `Asistencia excepcional autorizada con cobro pendiente (Q ${pass.amount}).`);
    openValidatePassModal(pass.code);
    if (activeRoute === 'pases') updatePassViews();
    if (activeRoute === 'asistencia') renderApp();
  } catch (err) {
    submitBtn.disabled = false;
    showToast('Error al guardar', err.message);
  }
}

function openCollectPassPaymentModal(passId) {
  if (!allowPassAction(true)) return;
  const pass = passById(passId);
  if (!pass) return;

  openModal({
    title: 'Registrar cobro de pase',
    eyebrow: 'Administración · Registro de cobro',
    body: `
      <form id="collectPassPaymentForm" class="form-stack">
        <input type="hidden" name="passId" value="${escapeHtml(pass.id)}" />
        <div class="surface-card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong>${escapeHtml(pass.studentName)}</strong>
              <p class="payment-meta">${escapeHtml(pass.className)} (${formatDayKeyReadable(pass.date)})</p>
            </div>
            <strong class="code-mono">${escapeHtml(pass.code)}</strong>
          </div>
          <p class="payment-amount" style="margin-top:12px">Q ${escapeHtml(pass.amount)}</p>
        </div>

        <label class="field">
          <span>Método de pago *</span>
          <select name="method" required>
            ${PAYMENT_METHODS.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
          </select>
        </label>

        <label class="field">
          <span>Referencia o número de comprobante</span>
          <input type="text" name="reference" placeholder="Ej. Boleta 4892, Voucher POS o Efectivo en mano" />
        </label>

        <p class="modal-note">El registro actualiza el estado de pago del pase. No modifica saldos de planes ni emite factura FEL.</p>

        <div class="form-actions">
          <button class="button button--light" type="button" data-close-modal>Cancelar</button>
          <button class="button button--red" type="submit" id="collectPassSubmitBtn">Confirmar cobro</button>
        </div>
      </form>
    `
  });
}

function handleCollectPassPaymentSubmit(event) {
  event.preventDefault();
  if (!allowPassAction(true)) return;
  const form = event.target;
  const submitBtn = form.querySelector('#collectPassSubmitBtn');
  if (submitBtn?.disabled) return;
  submitBtn.disabled = true;

  const passId = form.elements.passId.value;
  const method = form.elements.method.value;
  const reference = cleanText(form.elements.reference.value, 80);

  const pass = passById(passId);
  if (!pass || pass.paymentStatus === 'paid' || pass.status === 'cancelled') { showToast('Cobro no disponible', 'El pase ya fue pagado, fue cancelado o no existe.'); return; }
  if (!pass) {
    showToast('Pase no encontrado', 'El pase no existe.');
    return;
  }

  const nextState = structuredClone(state);
  const targetPass = nextState.singlePasses.find((p) => p.id === passId);
  if (!targetPass) return;

  targetPass.paymentStatus = 'paid';
  targetPass.paymentMethod = method;
  targetPass.paidAt = dayKey(TODAY);
  targetPass.paymentReference = reference;

  try {
    persistState(nextState);
    showToast('Cobro registrado', `Se registró el pago de Q ${pass.amount} (${method}) para ${pass.studentName}.`);
    openValidatePassModal(pass.code);
    if (activeRoute === 'pases') updatePassViews();
  } catch (err) {
    submitBtn.disabled = false;
    showToast('Error al registrar cobro', err.message);
  }
}

function openCancelPassModal(passId) {
  if (!allowPassAction(true)) return;
  const pass = passById(passId);
  if (!pass) return;

  openModal({
    title: 'Cancelar pase individual',
    eyebrow: 'Administración · Anulación',
    body: `
      <form id="cancelPassForm" class="form-stack">
        <input type="hidden" name="passId" value="${escapeHtml(pass.id)}" />
        <div class="surface-card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong>${escapeHtml(pass.studentName)}</strong>
              <p class="payment-meta">${escapeHtml(pass.className)} · ${formatDayKeyReadable(pass.date)}</p>
            </div>
            <strong class="code-mono">${escapeHtml(pass.code)}</strong>
          </div>
        </div>

        <div class="banner banner--warning" style="margin-bottom:16px">
          <strong>Advertencia de anulación</strong>
          <p>Esta acción cancelará el pase y no permitirá registrar asistencia con él. El registro permanecerá en el historial administrativo sin borrar datos ni generar devoluciones automáticas.</p>
        </div>

        <label class="field">
          <span>Motivo de cancelación *</span>
          <textarea name="cancelReason" rows="3" placeholder="Ej. El alumno canceló con anticipación por viaje..." required></textarea>
        </label>

        <div class="form-actions">
          <button class="button button--light" type="button" data-close-modal>Volver</button>
          <button class="button button--red" type="submit" id="cancelPassSubmitBtn">Confirmar cancelación</button>
        </div>
      </form>
    `
  });
}

function handleCancelPassSubmit(event) {
  event.preventDefault();
  if (!allowPassAction(true)) return;
  const form = event.target;
  const submitBtn = form.querySelector('#cancelPassSubmitBtn');
  if (submitBtn?.disabled) return;
  submitBtn.disabled = true;

  const passId = form.elements.passId.value;
  const reason = cleanText(form.elements.cancelReason.value, 200);
  if (!reason) {
    submitBtn.disabled = false;
    showToast('Motivo requerido', 'Ingresá el motivo de la cancelación.');
    return;
  }

  const pass = passById(passId);
  if (!pass || passStatus(pass) !== 'available') { showToast('No se puede cancelar', 'Solo se pueden cancelar pases disponibles.'); return; }
  if (!pass) return;

  const nextState = structuredClone(state);
  const targetPass = nextState.singlePasses.find((p) => p.id === passId);
  if (!targetPass) return;

  targetPass.status = 'cancelled';
  targetPass.cancelReason = reason;
  targetPass.cancelledAt = new Date().toISOString();
  targetPass.cancelledBy = 'Administración';

  try {
    persistState(nextState);
    showToast('Pase cancelado', `Pase ${pass.code} ha sido anulado con motivo: ${reason}.`);
    closeModal();
    if (activeRoute === 'pases') updatePassViews();
  } catch (err) {
    submitBtn.disabled = false;
    showToast('Error al cancelar', err.message);
  }
}

function renderGuardianCard() {
  const guardian = currentGuardian();
  if (isSupabaseConnected && !guardian) {
    return `
      <header class="page-heading"><div><p class="eyebrow">Identificación digital</p><h1>El carné<br/>de tus hijos.</h1></div></header>
      <div class="empty-state"><strong>Sin perfil de tutor</strong>No tenés un perfil de tutor vinculado.</div>
    `;
  }
  const children = childrenOf(guardian);
  if (!children.some((child) => child.id === activeChildId)) activeChildId = children[0]?.id || null;
  return `
    <header class="page-heading"><div><p class="eyebrow">Identificación digital</p><h1>El carné<br/>de tus hijos.</h1><p>El carné es permanente y no caduca. Se muestra en recepción para registrar la llegada; el estado de la mensualidad se consulta aparte. El tutor no marca la asistencia.</p></div></header>
    ${children.length > 0 ? `
      <div class="filter-row" role="group" aria-label="Elegir alumno">
        ${children.map((child) => `<button class="filter-chip ${child.id === activeChildId ? 'is-active' : ''}" type="button" aria-pressed="${child.id === activeChildId}" data-child-select="${escapeHtml(child.id)}">${escapeHtml(child.name)}</button>`).join('')}
      </div>
      <div id="guardianCarnet">${guardianCarnetMarkup()}</div>
    ` : '<div class="empty-state"><strong>Sin alumnos a cargo</strong>No hay carnés disponibles porque no tenés alumnos asociados.</div>'}
  `;
}

const renderers = {
  'student:inicio': renderStudentHome,
  'student:clases': renderStudentClasses,
  'student:planes': renderPlans,
  'guardian:planes': renderPlans,
  'student:carnet': renderStudentCard,
  'teacher:inicio': renderTeacherHome,
  'teacher:agenda': renderTeacherAgenda,
  'teacher:asistencia': renderTeacherAttendance,
  'admin:inicio': renderAdminHome,
  'admin:alumnos': renderAdminStudents,
  'admin:pagos': renderAdminPayments,
  'admin:asistencia': renderAdminAttendance,
  'admin:pases': renderAdminPasses,
  'guardian:inicio': renderGuardianHome,
  'guardian:carnet': renderGuardianCard
};

function initials(name) {
  return String(name).split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
}

// El fondo del dialogo es un <button> con tabindex="-1": entraba en la lista y
// quedaba como primer elemento del ciclo, asi que Shift+Tab desde el primer
// control real no daba la vuelta y el foco se escapaba de la ventana.
function modalFocusables() {
  return [...elements.modalLayer.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((node) => !node.hasAttribute('inert') && node.tabIndex >= 0 && node.getClientRects().length > 0);
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

function syncModalWithVisualViewport() {
  if (!elements.modalLayer || elements.modalLayer.classList.contains('is-hidden')) return;
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const maxH = Math.max(220, Math.floor(vv.height - 16));
    elements.modal.style.setProperty('--modal-max-height', `${maxH}px`);
  }
}

function openModal({ title, eyebrow = 'Acción demo', body }) {
  if (elements.modalLayer.classList.contains('is-hidden')) lastFocusedElement = document.activeElement;
  elements.modalTitle.textContent = title;
  elements.modalEyebrow.textContent = eyebrow;
  elements.modalBody.innerHTML = body;
  elements.modalLayer.classList.remove('is-hidden');
  elements.modalLayer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  syncModalWithVisualViewport();

  const isTouchMobile = window.matchMedia('(max-width: 768px)').matches || ('ontouchstart' in window);
  if (isTouchMobile) {
    elements.modal?.focus?.({ preventScroll: true });
  } else {
    const firstInBody = elements.modalBody.querySelector(FOCUSABLE_SELECTOR);
    (firstInBody || elements.modalLayer.querySelector('.icon-button[data-close-modal]') || elements.modal)?.focus?.({ preventScroll: true });
  }
  setBackgroundInert(true);
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
  elements.modal.style.removeProperty('--modal-max-height');
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
  const student = currentStudent();
  if (!student) return [];
  const teacher = currentTeacher();
  return classesForStudent(student.id).filter((item) =>
    (activeRole !== 'teacher' || (teacher && item.id === activeClassId && ((item.teacherId && item.teacherId === teacher.id) || item.teacher === teacher.name))));
}

function openScanModal() {
  TODAY = new Date();
  const student = currentStudent();
  if (!student) {
    showToast('Acción no disponible', 'No hay un alumno seleccionado o vinculado para escanear.');
    return;
  }
  const classes = scanClasses();
  const activeClass = findClass(activeClassId) || scheduledClasses()[0];
  const sessionDate = activeClass?.date ? dayKey(activeClass.date) : dayKey(TODAY);
  openModal({
    title: 'Escanear carnet',
    eyebrow: 'Asistencia QR · Simulación',
    body: `
      <div class="scan-stage"><span class="scan-line"></span><p class="scan-copy">Alineá el código dentro del recuadro</p></div>
      <p class="modal-note">${isSupabaseConnected ? 'Modo conectado' : 'Demo local'}: no se activa la cámara. El botón simula la lectura del carnet ${escapeHtml(student.id)}.</p>
      ${classes.length ? `<label class="field"><span>Clase · ${escapeHtml(student.name)}</span><select id="scanClass">${classes.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === activeClassId ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(item.time)} (${escapeHtml(item.day)})</option>`).join('')}</select></label>
      <div class="form-actions"><button class="button button--red" type="button" id="simulateScan" data-session-date="${escapeHtml(sessionDate)}">Simular lectura</button></div>`
        : `<p class="modal-note">${escapeHtml(student.name.split(' ')[0])} no tiene una clase asignada en esta sesión. No se registrará ninguna asistencia.</p>`}
    `
  });
}

function openPaymentModal(studentId = null, period = monthKey(TODAY)) {
  const defaultStudent = studentId ? studentById(studentId) : (currentStudent() || state.students[0]);
  if (!defaultStudent) {
    showToast('Sin alumnos', 'No hay alumnos registrados para procesar pagos.');
    return;
  }
  const student = defaultStudent;
  const periods = [...new Set([monthKey(TODAY), monthKey(nextMonthDate()), period, ...pendingPayments().map((item) => item.period)])].sort();
  openModal({
    title: 'Registrar pago',
    eyebrow: 'Administración · Registro interno',
    body: `
      <form id="paymentForm">
        <div class="form-grid">
          <label class="field field--wide"><span>Alumno</span><select name="studentId" required>${state.students.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === student.id ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(item.id)}</option>`).join('')}</select></label>
          <label class="field"><span>Monto (Q) · liquidación completa</span><input name="amount" type="number" min="0.01" step="0.01" required readonly /></label>
          <label class="field"><span>Método</span><select name="method" required>${PAYMENT_METHODS.map((value) => `<option>${escapeHtml(value)}</option>`).join('')}</select></label>
          <label class="field"><span>Mes aplicado</span><select name="period">${periods.map((value) => `<option value="${escapeHtml(value)}" ${value === period ? 'selected' : ''}>${escapeHtml(monthLabel(parseDayKey(`${value}-01`)))}</option>`).join('')}</select></label>
          <label class="field"><span>Referencia</span><input name="reference" placeholder="Ej. voucher 1842" /></label>
        </div>
        <p class="modal-note">Este registro no realiza ningún cobro, no procesa tarjetas y no genera factura FEL. El importe sale de la deuda del mes o, si no hay ninguna registrada, de la cuota del plan del alumno.</p>
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
  const period = form.elements.period.value;
  const required = requiredPaymentFor(studentId, period);
  const existing = required.existing;
  const paid = existing?.status === 'Pagado';
  form.elements.amount.value = required.amount === null ? '' : required.amount;
  // El importe es derivado en los dos casos: queda visible pero no editable,
  // porque un valor distinto solo puede ser un abono o un descuento y la demo
  // no los admite. registerPayment igual lo revalida.
  form.elements.amount.readOnly = true;
  form.querySelector('[type="submit"]').disabled = paid || required.amount === null;
  document.querySelector('#paymentFormMessage').textContent = paid
    ? 'Este mes ya está pagado. El registro existente se conserva y no se puede reemplazar desde este formulario.'
    : required.amount === null
    ? (required.source === 'sin_cuota'
        ? `No existe una cuota registrada para el período ${period}. No se puede registrar el pago sin información suficiente de la cuota correspondiente.`
        : `El plan guardado de este alumno (${required.plan.planName}) no figura en el catálogo de la demo. No se le asigna una cuota: corregí el plan del alumno antes de registrar el pago.`)
    : existing
      ? `Se registrará la liquidación completa de la mensualidad del período ${period}: Q ${formatAmount(required.amount)}.`
      : `Cuota correspondiente al período ${period}: Q ${formatAmount(required.amount)}. No cancela deudas de otros meses.`;
}

function openNewStudentModal() {
  openModal({
    title: 'Nuevo alumno',
    eyebrow: 'Administración · Datos demo',
    body: `
      <form id="studentForm">
        <div class="form-grid">
          <label class="field field--wide"><span>Nombre completo</span><input name="name" required placeholder="Nombre y apellido" /></label>
          <label class="field"><span>Plan</span><select name="plan">${membershipPlans.map((item) => `<option ${item.id === DEFAULT_PLAN.id ? 'selected' : ''}>${escapeHtml(item.planName)}</option>`).join('')}</select></label>
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

function openClassDetail(classId, contextDate = null) {
  const item = findClass(classId);
  if (!item) return;
  const student = currentStudent();
  const isEnrolled = student ? (student.classIds || []).includes(item.id) : false;
  const rosterCount = rosterFor(item.id).length;

  let targetDate = null;
  if (contextDate) {
    targetDate = typeof contextDate === 'string' ? parseDayKey(contextDate) : new Date(contextDate);
  } else if (item.date) {
    targetDate = new Date(item.date);
  } else {
    targetDate = nextDateFor(item.weekday);
  }

  const dateFormatted = longDate(targetDate);
  const dayName = dayLabel(targetDate);
  const eyebrowText = `${dayName} · ${dateFormatted} · ${item.time}`;

  openModal({
    title: item.name,
    eyebrow: eyebrowText,
    body: `
      <div class="surface-card" style="padding:20px;margin-bottom:16px">
        <p class="eyebrow">Detalle de clase</p>
        <h3>${escapeHtml(item.level)}</h3>
        <p class="payment-meta">
          <strong>Horario:</strong> ${escapeHtml(item.time)} (${escapeHtml(dateFormatted)})<br/>
          <strong>Profesor:</strong> ${escapeHtml(item.teacher)}<br/>
          <strong>Salón:</strong> ${escapeHtml(item.room)}<br/>
          <strong>Cupos:</strong> ${escapeHtml(capacityText(item))} ocupados · ${escapeHtml(rosterCount)} alumno${rosterCount === 1 ? '' : 's'} inscrito${rosterCount === 1 ? '' : 's'} en la demo
        </p>
        ${isEnrolled ? '<p style="margin-top:12px"><span class="tag tag--red">Estás inscrito en esta clase</span></p>' : '<p style="margin-top:12px"><span class="tag tag--dark">Clase disponible en catálogo</span></p>'}
      </div>
      <p class="modal-note">Esta pantalla es de consulta. La inscripción a una clase la administra la academia; el prototipo no habilita reservas por sesión.</p>
      <div class="form-actions">
        ${activeRole === 'student' ? `<button class="button button--red" type="button" data-open-music-modal="${escapeHtml(item.id)}">Pedir rola para esta clase 🎶</button>` : ''}
        <button class="button button--light" type="button" data-close-modal>Cerrar</button>
      </div>
    `
  });
}


function openStudentPayment() {
  const student = currentStudent();
  if (!student) {
    showToast('Sin alumno', 'No hay una ficha de alumno vinculada.');
    return;
  }
  const payment = monthlyPaymentFor(student.id);
  const plan = planForStudent(student.id);
  const paid = payment?.status === 'Pagado';
  openModal({
    title: paid ? 'Comprobante interno' : payment ? 'Mensualidad pendiente' : 'Mensualidad sin registro',
    eyebrow: monthLabel(TODAY),
    body: `
      <article class="surface-card"><p class="eyebrow">${escapeHtml(paymentStatus(payment))}</p><p class="payment-amount">Q ${escapeHtml(payment ? formatAmount(payment.amount) : '—')}</p><p class="payment-meta">${paid ? `${escapeHtml(payment.method)} · ` : ''}${escapeHtml(paymentDateText(payment))}<br/>${escapeHtml(plan.planName)}${planReviewTag(plan)} · ${escapeHtml(priceText(plan.price))}${plan.needsReview ? '' : ' al mes'}</p></article>
      <p class="modal-note" style="margin-top:16px">La academia cobra por sus medios habituales. La app solo refleja el registro interno; no hay pasarela ni pago con tarjeta.</p>
    `
  });
}

function openConsentModal() {
  const guardian = currentGuardian();
  if (!guardian) {
    showToast('Sin tutor', 'No hay un tutor vinculado para consultar consentimiento.');
    return;
  }
  const hasConsent = Boolean(guardian.consentSignedAt);
  const signed = hasConsent ? parseDayKey(guardian.consentSignedAt) : null;
  const isDemo = Boolean(guardian.isDemo);

  if (!hasConsent) {
    openModal({
      title: 'Constancia de consentimiento',
      eyebrow: 'Menores de edad',
      body: `
        <article class="surface-card">
          <p class="eyebrow">Estado de consentimiento</p>
          <h3>Sin constancia registrada</h3>
          <p class="payment-meta">No existe evidencia de consentimiento firmada para ${escapeHtml(guardian.name)} en los registros de la academia.</p>
          <p class="payment-meta" style="margin-top:12px">Como tutor accedés únicamente a la información de tus propios hijos.</p>
        </article>
        <p class="modal-note" style="margin-top:16px">El consentimiento se firma con la academia fuera del sistema. Una vez firmado y validado físicamente, la administración registra la constancia en la ficha del tutor.</p>
        <div class="form-actions"><button class="button button--red" type="button" data-close-modal>Entendido</button></div>
      `
    });
    return;
  }

  openModal({
    title: 'Constancia de consentimiento',
    eyebrow: isDemo ? 'Menores de edad · Ejemplo demo' : 'Menores de edad',
    body: `
      <article class="surface-card">
        <p class="eyebrow">Firmado el ${escapeHtml(shortDate(signed))} ${signed.getFullYear()}${isDemo ? ' (demostración)' : ''}</p>
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
        <p class="payment-amount">Q ${payment ? escapeHtml(formatAmount(payment.amount)) : '—'}</p>
        <p class="payment-meta">${paid ? `${escapeHtml(payment.method)} · ` : ''}${escapeHtml(paymentDateText(payment))}<br/>${escapeHtml(planForStudent(child.id).planName)}${planReviewTag(planForStudent(child.id))} · ${escapeHtml(priceText(planForStudent(child.id).price))}${planForStudent(child.id).needsReview ? '' : ' al mes'}</p>
      </article>
      <p class="modal-note" style="margin-top:16px">La academia cobra por sus medios habituales. La app solo refleja el registro interno; no hay pasarela ni pago con tarjeta.</p>
    `
  });
}

// El comprobante separa el mes al que se aplica el pago de la fecha en que se
// registro: antes mostraba un texto libre que no distinguia una cosa de la otra.
function openReceipt(paymentId) {
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) return;
  const recordedAt = payment.paidAt ? `${shortDate(parseDayKey(payment.paidAt))} ${parseDayKey(payment.paidAt).getFullYear()}` : payment.date || 'Sin fecha registrada';
  openModal({
    title: 'Comprobante interno',
    eyebrow: `Registro ${payment.id}`,
    body: `
      <article class="surface-card"><p class="eyebrow">Pago registrado</p><p class="payment-amount">Q ${escapeHtml(formatAmount(payment.amount))}</p><h3>${escapeHtml(payment.student)}</h3><p class="payment-meta">Mes aplicado · ${escapeHtml(payment.month)}<br/>Registrado el · ${escapeHtml(recordedAt)}<br/>Método · ${escapeHtml(payment.method)}${payment.reference ? `<br/>Referencia · ${escapeHtml(payment.reference)}` : ''}</p></article>
      <p class="modal-note" style="margin-top:16px">Documento de demostración. No es factura FEL ni comprobante tributario.</p>
    `
  });
}

function openStudentDetail(studentId) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student) return;
  const enrolled = classesForStudent(student.id);
  openModal({
    title: student.name,
    eyebrow: `Ficha ${student.id}`,
    body: `
      <article class="surface-card"><div class="person-cell"><span class="avatar" style="width:54px;height:54px" aria-hidden="true">${escapeHtml(initials(student.name))}</span><span><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(planForStudent(student.id).planName)}</small></span></div><p class="payment-meta" style="margin-top:22px">Teléfono · ${escapeHtml(student.phone || 'Sin registrar')}<br/>Estado de pago · ${escapeHtml(studentPaymentStatus(student.id))}</p></article>
      <article class="surface-card" style="margin-top:16px">
        <p class="eyebrow">Clases inscritas</p>
        ${enrolled.length
          ? `<p class="payment-meta">${enrolled.map((item) => `${escapeHtml(item.name)} · ${escapeHtml(WEEKDAY_SHORT[item.weekday])} ${escapeHtml(item.time)}`).join('<br/>')}</p>`
          : '<p class="payment-meta">Sin clases asignadas. Mientras no tenga inscripciones no aparece en el calendario del alumno ni en ninguna lista de asistencia.</p>'}
        <div class="form-actions"><button class="button button--red button--small" type="button" data-student-classes="${escapeHtml(student.id)}" aria-label="Gestionar clases de ${escapeHtml(student.name)}">Gestionar clases</button></div>
      </article>
      <p class="modal-note" style="margin-top:16px">Ficha demo sin información sensible real.</p>
    `
  });
}

// ---------------------------------------------------------------------------
// Inscripcion en clases. Asigna y retira clases de la semana, nada mas: no es
// reserva por sesion ni lista de espera, no toca pagos y no borra asistencias
// ya registradas. Persiste en classIds con el mismo almacenamiento existente.
// ---------------------------------------------------------------------------
function openStudentClassesModal(studentId) {
  const student = studentById(studentId);
  if (!student) return;
  const selected = student.classIds || [];
  openModal({
    title: `Clases de ${student.name}`,
    eyebrow: `Inscripciones · ${student.id}`,
    body: `
      <form id="enrollmentForm" data-student-id="${escapeHtml(student.id)}">
        <p class="modal-note">Marcá las clases en las que queda inscrito. Se guarda en este navegador, no reserva sesiones ni crea lista de espera y no modifica pagos.</p>
        <div class="attendance-roster" role="group" aria-label="Clases de la semana">
          ${scheduledClasses().map((item) => {
            const isOn = selected.includes(item.id);
            return `
          <label class="student-check">
            <input type="checkbox" name="classIds" value="${escapeHtml(item.id)}" ${isOn ? 'checked' : ''} />
            <span class="avatar" aria-hidden="true">${escapeHtml(WEEKDAY_SHORT[item.weekday])}</span>
            <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(WEEKDAY_SHORT[item.weekday])} ${escapeHtml(item.time)} · ${escapeHtml(item.room)} · ${escapeHtml(item.level)}</small></span>
            <span>${isOn ? 'Inscrito' : 'Sin inscribir'}</span>
          </label>`;
          }).join('')}
        </div>
        <p class="modal-note">Los cupos que muestra el calendario son cifras de referencia de la demo (una academia de 50 alumnos): no se calculan con estas inscripciones y no representan disponibilidad real.</p>
        <p class="payment-meta" id="enrollmentFormMessage" role="status"></p>
        <div class="form-actions"><button class="button button--light" type="button" data-close-modal>Cancelar</button><button class="button button--red" type="submit">Guardar inscripciones</button></div>
      </form>
    `
  });
}

async function handleEnrollmentSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const message = document.querySelector('#enrollmentFormMessage');
  const submitBtn = form.querySelector('button[type="submit"]');
  const student = studentById(form.dataset.studentId);
  if (!student) {
    if (message) message.textContent = 'El alumno ya no existe en esta demo. Cerrá y volvé a abrir la ficha.';
    return;
  }
  const knownClassIds = classData.map((item) => item.id);
  const classIds = [...new Set([...form.querySelectorAll('input[name="classIds"]:checked')]
    .map((input) => input.value)
    .filter((value) => knownClassIds.includes(value)))];
  const before = student.classIds || [];
  const added = classIds.filter((id) => !before.includes(id)).length;
  const removed = before.filter((id) => !classIds.includes(id)).length;

  if (isSupabaseConnected) {
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';
      }
      await syncRemoteEnrollments({ studentCardId: student.id, classIds });
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar inscripciones';
      }
      if (message) message.textContent = `Error al sincronizar inscripciones: ${err.message}`;
      return;
    }
  }

  try {
    // attendanceLog no se toca: retirar una inscripcion no borra las sesiones
    // ya registradas de ese alumno.
    persistState({
      ...state,
      students: state.students.map((item) => (item.id === student.id ? { ...item, classIds } : item))
    });
  } catch (error) {
    if (message) message.textContent = error.message;
    return;
  }
  closeModal();
  const detail = added || removed
    ? `${student.name} · ${added} asignada${added === 1 ? '' : 's'}, ${removed} retirada${removed === 1 ? '' : 's'}`
    : `${student.name} · sin cambios`;
  showToast('Inscripciones guardadas', detail);
  renderAndFocus();
}

function openProfile() {
  if (isSupabaseConnected && authenticatedProfile) {
    const roleLabels = { student: 'Alumno', teacher: 'Maestro', admin: 'Administración', guardian: 'Tutor' };
    const fullName = `${authenticatedProfile.first_name || ''} ${authenticatedProfile.last_name || ''}`.trim() || authenticatedUser?.email || 'Usuario';
    const roleTitle = roleLabels[authenticatedProfile.role] || activeRole;
    let meta = `Cuenta: ${authenticatedUser?.email || ''}`;
    if (activeRole === 'student') {
      const student = currentStudent();
      meta = student ? `Carné: ${student.id} · Plan: ${student.plan}` : 'Ficha de alumno sin vincular';
    } else if (activeRole === 'teacher') {
      const classes = teacherClasses();
      meta = `${classes.length} clase${classes.length === 1 ? '' : 's'} asignada${classes.length === 1 ? '' : 's'}`;
    } else if (activeRole === 'guardian') {
      const kids = childrenOf(currentGuardian()).map((c) => c.name);
      meta = kids.length ? `${kids.join(' y ')} a su cargo` : 'Sin alumnos a cargo';
    }
    openModal({
      title: fullName,
      eyebrow: roleConfig[activeRole]?.label || activeRole,
      body: `
        <article class="surface-card">
          <div class="person-cell">
            <span class="avatar" style="width:58px;height:58px">${escapeHtml(initials(fullName) || roleConfig[activeRole]?.initials)}</span>
            <span><strong>${escapeHtml(fullName)}</strong><small>${escapeHtml(roleTitle)}</small></span>
          </div>
          <p class="payment-meta" style="margin-top:22px">${escapeHtml(meta)}</p>
        </article>
        <p class="modal-note" style="margin-top:16px">Sesión autenticada en Supabase con políticas de seguridad RLS activas.</p>
        <div class="form-actions" style="margin-top:16px">
          <button class="button button--red" type="button" id="profileSignOut">Cerrar sesión remota</button>
        </div>
      `
    });
    document.querySelector('#profileSignOut')?.addEventListener('click', async () => {
      closeModal();
      await handleSignOut();
    });
    return;
  }

  const student = studentById(DEMO_STUDENT_ID);
  const guardian = currentGuardian();
  const children = childrenOf(guardian).map((child) => child.name);
  const profiles = {
    student: [student?.name || 'Alumno demo', `Alumno · ${planForStudent(DEMO_STUDENT_ID).planName}`, student?.id || DEMO_STUDENT_ID],
    teacher: [TEACHER_NAME, 'Maestro', `${teacherClasses().length} clase${teacherClasses().length === 1 ? '' : 's'} asignada${teacherClasses().length === 1 ? '' : 's'}`],
    admin: ['Majo Borrayo', 'Administración', 'Acceso de demostración'],
    guardian: [guardian?.name || 'Tutor demo', 'Tutor', children.length ? `${children.join(' y ')} a su cargo` : 'Sin alumnos a cargo']
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

async function simulateScan() {
  TODAY = new Date();
  const student = currentStudent();
  const target = scanClasses().find((item) => item.id === document.querySelector('#scanClass')?.value);
  const sessionDate = document.querySelector('#simulateScan')?.dataset?.sessionDate || dayKey(TODAY);
  try {
    if (!student) throw new Error(isSupabaseConnected ? 'No hay un alumno seleccionado o vinculado para registrar la lectura.' : 'El alumno de la demostración ya no existe. Reiniciá la demo.');
    if (!target) throw new Error('No hay una clase válida para registrar esta lectura.');

    if (isSupabaseConnected) {
      await syncRemoteAttendance({
        studentCardId: student.id,
        classId: target.id,
        sessionDate,
        method: 'qr_scan'
      });
    }

    recordAttendance(target.id, [student.id], sessionDate);
  } catch (error) {
    showToast('No se registró la asistencia', error.message);
    return;
  }
  closeModal();
  showToast('Asistencia registrada', `${student.name} · ${target.name} · ${target.time}`);
  renderAndFocus();
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
  const fresh = createDefaultState();
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
  renderAndFocus();
}

function handleModalClick(event) {
  if (event.target.closest('#confirmWebMcp')) return resolveWebMcp(true);
  const randomizeMoodBtn = event.target.closest('[data-randomize-mood]');
  if (randomizeMoodBtn) {
    const pool = MUSIC_MOODS.filter((m) => m.id !== currentSelectedMoodId);
    const chosen = pool[Math.floor(Math.random() * pool.length)] || MUSIC_MOODS[0];
    currentSelectedMoodId = chosen.id;
    const input = elements.modalLayer.querySelector('#selectedMoodIdInput');
    if (input) input.value = chosen.id;
    elements.modalLayer.querySelectorAll('[data-select-mood]').forEach((btn) => {
      const selected = btn.dataset.selectMood === chosen.id;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-checked', String(selected));
    });
    return;
  }
  const selectMoodBtn = event.target.closest('[data-select-mood]');
  if (selectMoodBtn) {
    const moodId = selectMoodBtn.dataset.selectMood;
    currentSelectedMoodId = moodId;
    const input = elements.modalLayer.querySelector('#selectedMoodIdInput');
    if (input) input.value = moodId;
    elements.modalLayer.querySelectorAll('[data-select-mood]').forEach((btn) => {
      const selected = btn === selectMoodBtn;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-checked', String(selected));
    });
    return;
  }
  const openMusicFromModal = event.target.closest('[data-open-music-modal]');
  if (openMusicFromModal) {
    return openMusicSuggestionModal(openMusicFromModal.dataset.openMusicModal || null);
  }
  const studentClasses = event.target.closest('[data-student-classes]');
  if (studentClasses) return openStudentClassesModal(studentClasses.dataset.studentClasses);
  if (event.target.closest('[data-print-pass]')) {
    window.print();
    return;
  }
  const modalVal = event.target.closest('[data-modal-validate]');
  if (modalVal) return openValidatePassModal(modalVal.dataset.modalValidate || null);
  const modalColl = event.target.closest('[data-modal-open-collect]');
  if (modalColl) return openCollectPassPaymentModal(modalColl.dataset.modalOpenCollect);
  const modalCancel = event.target.closest('[data-cancel-pass]');
  if (modalCancel) return openCancelPassModal(modalCancel.dataset.cancelPass);
  const quickPass = event.target.closest('[data-open-validate-pass]');
  if (quickPass) return openValidatePassModal(quickPass.dataset.openValidatePass || null);
  if (event.target.closest('[data-retry-validate]')) return openValidatePassModal(null);
  if (event.target.closest('[data-close-modal]')) return closeModal();
  if (event.target.closest('#simulateScan')) return simulateScan();
  if (event.target.closest('#confirmReset')) return resetDemo();
}

function handleModalSubmit(event) {
  if (event.target.id === 'paymentForm') handlePaymentSubmit(event);
  if (event.target.id === 'studentForm') handleStudentSubmit(event);
  if (event.target.id === 'enrollmentForm') handleEnrollmentSubmit(event);
  if (event.target.id === 'musicSuggestionForm') handleMusicSuggestionSubmit(event);
  if (event.target.id === 'createPassForm') handleCreatePassSubmit(event);
  if (event.target.id === 'validatePassSearchForm') handleValidatePassSearchSubmit(event);
  if (event.target.id === 'confirmPassAttendanceForm') handleConfirmPassAttendanceSubmit(event);
  if (event.target.id === 'authPendingAttendanceForm') handleAuthPendingAttendanceSubmit(event);
  if (event.target.id === 'collectPassPaymentForm') handleCollectPassPaymentSubmit(event);
  if (event.target.id === 'cancelPassForm') handleCancelPassSubmit(event);
}

// ---------------------------------------------------------------------------
// Mientras la demo solo admita liquidaciones completas, el importe de un
// registro no es libre: es la cuota correspondiente al mes solicitado (según
// membresía u obligación registrada). Si no hay información suficiente, no se
// inventan importes.
// ---------------------------------------------------------------------------
function requiredPaymentFor(studentId, period) {
  const existing = state.payments.find((item) => item.studentId === studentId && item.period === period);
  const student = studentById(studentId);
  const plan = planForStudent(studentId);

  // En modo Supabase, validar contra la membresía del mes solicitado
  if (isSupabaseConnected) {
    const mems = student?.memberships || [];
    const mem = mems.find((m) => (m.period === period) || (m.start_date && m.start_date.slice(0, 7) === period));
    if (!mem && existing?.membershipId && Number.isFinite(existing.amount) && existing.amount > 0) {
      return {
        existing,
        plan,
        source: 'membresia',
        amount: Number(existing.amount),
        period
      };
    }
    if (!mem || !Number.isFinite(Number(mem.price))) {
      return {
        existing,
        plan,
        source: 'sin_cuota',
        amount: null,
        period
      };
    }
    return {
      existing,
      plan,
      source: 'membresia',
      amount: Number(mem.price),
      period
    };
  }

  // En modo demo / almacenamiento local:
  // Si existe una obligación registrada para ese mes en particular, esa es su cuota.
  if (existing && Number.isFinite(existing.amount)) {
    return {
      existing,
      plan,
      source: 'deuda',
      amount: existing.amount,
      period
    };
  }

  // Si no hay deuda previa y se consulta el mes en curso, se usa el plan vigente
  if (period === monthKey(TODAY)) {
    return {
      existing: null,
      plan,
      source: 'plan',
      amount: Number.isFinite(plan.price) ? plan.price : null,
      period
    };
  }

  // Para períodos sin información suficiente, no inventar importes
  return {
    existing: null,
    plan,
    source: 'sin_cuota',
    amount: null,
    period
  };
}

function requiredPaymentText(required) {
  if (required.amount === null) {
    if (required.source === 'sin_cuota') {
      return `la cuota del período solicitado (${required.period}), pero no existe información suficiente de cuota registrada para ese mes. La academia debe registrar la membresía u obligación antes de procesar el pago`;
    }
    return `la cuota del plan guardado (${required.plan.planName}), que no figura en el catálogo de la demo y debe corregirse desde administración antes de registrar un pago`;
  }
  return required.source === 'deuda'
    ? `la mensualidad correspondiente registrada de Q ${formatAmount(required.amount)}`
    : required.source === 'membresia'
    ? `la cuota de membresía de Q ${formatAmount(required.amount)} registrada para el período ${required.period}`
    : `la cuota del ${required.plan.planName}, Q ${formatAmount(required.amount)}`;
}

// Comparacion en centavos: 450 y 450.00 son el mismo importe.
function sameAmount(a, b) {
  return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}

function preparePaymentRecord({ studentId, period, amount, method, reference = '' }) {
  TODAY = new Date();
  const student = studentById(studentId);
  if (!student) throw new Error('Alumno no encontrado.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Elegí un período válido.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('El monto debe ser mayor que cero.');
  if (!PAYMENT_METHODS.includes(method)) throw new Error('Método de pago no válido.');
  const required = requiredPaymentFor(student.id, period);
  const existing = required.existing;
  if (existing?.status === 'Pagado') throw new Error('Este mes ya está pagado. El registro existente no se reemplazó.');
  if (required.amount === null) {
    if (required.source === 'sin_cuota') {
      throw new Error(`No existe información suficiente de cuota para el período ${period} y este alumno. No se pueden inventar importes; definí la membresía u obligación correspondiente antes de registrar el pago.`);
    }
    throw new Error(`El plan guardado de este alumno (${required.plan.planName}) no figura en el catálogo de la demo, así que no hay cuota que registrar. Corregí el plan del alumno antes de registrar el pago.`);
  }
  if (!sameAmount(amount, required.amount)) {
    throw new Error(`El registro debe cubrir ${requiredPaymentText(required)}. La demo solo admite liquidaciones completas: no registra abonos, descuentos ni cargos adicionales.`);
  }
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
  return { student, record, existing };
}

function commitPaymentRecord({ student, record, existing }) {
  const nextPayments = existing
    ? state.payments.map((item) => (item.studentId === record.studentId && item.period === record.period ? record : item))
    : [record, ...state.payments];

  // Actualizar únicamente la obligación de este período pagado en memoria local
  const nextStudents = state.students.map((item) => {
    if (item.id !== student.id) return item;
    if (!Array.isArray(item.memberships)) return item;
    const nextMems = item.memberships.map((mem) => {
      const matchPeriod = (mem.period === record.period) || (mem.start_date && mem.start_date.slice(0, 7) === record.period);
      if (matchPeriod && mem.status === 'past_due') {
        return { ...mem, status: 'active' };
      }
      return mem;
    });
    return { ...item, memberships: nextMems };
  });

  const nextState = {
    ...state,
    students: nextStudents,
    payments: nextPayments
  };
  persistState(nextState);
  return record;
}

function registerPayment({ studentId, period, amount, method, reference = '' }) {
  const prepared = preparePaymentRecord({ studentId, period, amount, method, reference });
  return commitPaymentRecord(prepared);
}

async function handlePaymentSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const message = document.querySelector('#paymentFormMessage');
  const submitBtn = form.querySelector('button[type="submit"]');

  let prepared;
  try {
    prepared = preparePaymentRecord({
      studentId: data.get('studentId'),
      period: data.get('period'),
      amount: Number(data.get('amount')),
      method: data.get('method'),
      reference: data.get('reference') || ''
    });
  } catch (error) {
    if (message) message.textContent = error.message;
    return;
  }

  const { student, record } = prepared;
  let remoteConfirmed = false;

  // Si está conectado a Supabase, la confirmación remota es obligatoria antes de guardar
  if (isSupabaseConnected) {
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando en la nube...';
      }
      if (message) message.textContent = '';
      const serverResult = await syncRemotePayment({
        studentCardId: student.id,
        amount: record.amount,
        method: record.method,
        period: record.period,
        receiptNumber: record.id,
        notes: record.reference,
        idempotencyKey: `PAY-${student.id}-${record.period}`
      });
      remoteConfirmed = true;

      // El frontend registra y muestra el registro confirmado devuelto por el servidor;
      // no sustituirlo por la fecha actual ni por datos del intento
      const confirmedDate = serverResult.recordedAt ? new Date(serverResult.recordedAt) : TODAY;
      record.id = serverResult.id;
      record.amount = serverResult.amount;
      record.method = serverResult.method;
      record.period = serverResult.period;
      record.reference = serverResult.reference !== undefined && serverResult.reference !== null ? serverResult.reference : record.reference;
      record.status = 'Pagado';
      record.paidAt = dayKey(confirmedDate);
      record.date = shortDate(confirmedDate);

      if (serverResult.isDuplicate) {
        showToast('Pago ya confirmado', `Se recuperó el registro original de ${record.student} (${record.id}) con fecha ${record.date}.`);
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar pago';
      }
      if (message) {
        message.textContent = `Error remoto: ${err.message}. Podés corregir o reintentar sin duplicar.`;
      }
      return;
    }
  }

  // Persistir solo tras confirmación
  try {
    commitPaymentRecord(prepared);
    closeModal();
    showToast('Pago guardado', `${record.student} · Q ${formatAmount(record.amount)} · ${record.method}`);
    renderAndFocus();
  } catch (error) {
    if (remoteConfirmed) {
      console.warn('[In Motion] Pago confirmado en servidor pero falló persistencia/render:', error.message);
      const nextPayments = state.payments.map((item) => (item.studentId === record.studentId && item.period === record.period ? record : item));
      if (!nextPayments.some((item) => item.id === record.id)) {
        nextPayments.unshift(record);
      }
      state.payments = nextPayments;
      closeModal();
      showToast('Pago confirmado en la nube', `El pago (${record.id}) de ${record.student} fue registrado exitosamente en Supabase. Advertencia: ${error.message}.`);
      renderAndFocus();
    } else {
      if (message) message.textContent = error.message;
    }
  }
}

async function handleStudentSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const message = document.querySelector('#studentFormMessage');
  const submitBtn = form.querySelector('button[type="submit"]');
  const name = String(data.get('name') || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3) {
    if (message) message.textContent = 'Escribí el nombre completo del alumno.';
    return;
  }
  const selectedPlanName = PLAN_NAMES.includes(String(data.get('plan'))) ? String(data.get('plan')) : DEFAULT_PLAN.planName;
  const selectedPlan = planByName(selectedPlanName);

  const student = {
    id: nextStudentId(),
    name: name.slice(0, 80),
    initials: initials(name),
    plan: selectedPlanName,
    phone: String(data.get('phone') || '').trim().slice(0, 24) || 'Sin registrar',
    status: 'Pendiente',
    level: 'Sin nivel',
    classIds: [],
    notes: String(data.get('notes') || '').trim().slice(0, 280),
    memberships: []
  };

  let remoteRow = null;
  let remoteConfirmed = false;

  if (isSupabaseConnected) {
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando en la nube...';
      }
      remoteRow = await createRemoteStudent({
        id: student.id,
        name: student.name,
        phone: student.phone,
        plan: student.plan,
        planPrice: selectedPlan?.price || null,
        level: student.level,
        notes: student.notes
      });
      remoteConfirmed = true;
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear alumno';
      }
      if (message) message.textContent = `Error al guardar en Supabase: ${err.message}`;
      return;
    }
  }

  const currentPeriod = monthKey(TODAY);

  // Si se confirmó en Supabase, incorporar identificadores remotos y membresía
  if (isSupabaseConnected && remoteRow) {
    student.profileId = remoteRow.profile_id;
    student.cardId = remoteRow.card_id;
    student.id = remoteRow.card_number || student.id;

    if (remoteRow.membership_id) {
      const newMembership = {
        id: remoteRow.membership_id,
        student_id: remoteRow.profile_id,
        plan_name: student.plan,
        price: selectedPlan?.price || 0,
        status: 'past_due',
        period: currentPeriod,
        start_date: dayKey(TODAY),
        end_date: dayKey(addDays(TODAY, 30))
      };
      student.memberships = [newMembership];

      // Incorporar la obligación de pago pendiente en state.payments para este período
      const pendingPayment = {
        id: `MEM-${remoteRow.membership_id.slice(0, 8)}`,
        membershipId: remoteRow.membership_id,
        studentId: student.id,
        studentUuid: remoteRow.profile_id,
        student: student.name,
        month: monthLabel(parseDayKey(`${currentPeriod}-01`)),
        period: currentPeriod,
        amount: Number(selectedPlan?.price) || 0,
        method: 'Pendiente',
        reference: `Membresía: ${student.plan}`,
        date: 'Sin fecha de vencimiento',
        paidAt: null,
        dueDate: null,
        status: 'Pendiente'
      };
      state.payments = [pendingPayment, ...state.payments.filter((p) => !(p.studentId === student.id && p.period === currentPeriod))];
    }
  } else if (!isSupabaseConnected) {
    // Modo demo: si tiene plan con precio, crear obligación pendiente en state.payments
    if (selectedPlan && Number.isFinite(selectedPlan.price) && selectedPlan.price > 0) {
      const pendingPayment = {
        id: `P-${currentPeriod}-${student.id}`,
        studentId: student.id,
        student: student.name,
        month: monthLabel(parseDayKey(`${currentPeriod}-01`)),
        period: currentPeriod,
        amount: selectedPlan.price,
        method: 'Pendiente',
        reference: `Plan: ${student.plan}`,
        date: 'Sin fecha de vencimiento',
        paidAt: null,
        dueDate: null,
        status: 'Pendiente'
      };
      state.payments = [pendingPayment, ...state.payments.filter((p) => !(p.studentId === student.id && p.period === currentPeriod))];
    }
  }

  // Incorporar alumno al estado en memoria
  state.students = [student, ...state.students.filter((s) => s.id !== student.id)];

  // Persistir en almacenamiento local y actualizar interfaz
  try {
    persistState(state);
  } catch (storageError) {
    console.warn('[In Motion] Fallo de localStorage al persistir nuevo alumno:', storageError.message);
    if (remoteConfirmed) {
      closeModal();
      showToast('Alumno creado en la nube', `${student.name} (${student.id}) fue creado en Supabase. Advertencia: no se pudo guardar en este navegador (${storageError.message}). Podés registrar su pago o consultar su ficha.`);
      renderAndFocus();
      return;
    } else {
      if (message) message.textContent = storageError.message;
      return;
    }
  }

  try {
    closeModal();
    showToast('Alumno creado', `${student.name} · ${isSupabaseConnected ? 'guardado en la nube' : 'registro local'}`);
    renderAndFocus();
  } catch (renderError) {
    console.error('[In Motion] Error al actualizar la interfaz tras alta de alumno:', renderError);
    if (remoteConfirmed) {
      showToast('Alumno creado en la nube', `${student.name} (${student.id}) ya fue creado en Supabase. Falla de interfaz: ${renderError.message}. Podés consultar la ficha del alumno.`);
    }
  }
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
      if (isSupabaseConnected) {
        throw new Error('Esta herramienta demo está bloqueada en modo conectado con Supabase. Usá la interfaz de asistencia conectada.');
      }
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
      if (isSupabaseConnected) {
        throw new Error('Esta herramienta demo está bloqueada en modo conectado con Supabase. No se modificó el estado.');
      }
      recordAttendance(classItem.id, [student.id], dayKey(new Date()));
      if (!elements.app.classList.contains('is-hidden')) renderAndFocus();
      return { classId: classItem.id, studentId: student.id, status: 'present' };
    }
  });

  register({
    name: 'register_demo_payment',
    title: 'Registrar pago demo',
    description: 'Registra localmente un pago ya realizado fuera de la plataforma; no cobra ni procesa tarjetas. El monto debe cubrir la mensualidad completa: la deuda registrada del mes o, si no hay ninguna, la cuota del plan del alumno.',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: { type: 'string' },
        amount: { type: 'number', exclusiveMinimum: 0 },
        method: { type: 'string', enum: ['Transferencia', 'Efectivo', 'Tarjeta'] }
      },
      required: ['studentId', 'amount', 'method'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      if (isSupabaseConnected) {
        throw new Error('Esta herramienta demo está bloqueada en modo conectado con Supabase. Los pagos deben confirmarse remotamente en la nube.');
      }
      const student = state.students.find((item) => item.id === input?.studentId);
      if (!student) throw new Error('Alumno demo no encontrado.');
      const period = monthKey(new Date());
      const required = requiredPaymentFor(student.id, period);
      if (required.existing?.status === 'Pagado') throw new Error('Este mes ya está pagado. El registro existente no se reemplazó.');
      if (!sameAmount(input?.amount, required.amount)) {
        throw new Error(`El registro debe cubrir ${requiredPaymentText(required)}. La demo solo admite liquidaciones completas: no registra abonos, descuentos ni cargos adicionales.`);
      }
      const approved = await confirmWebMcpWrite({
        title: 'Confirmar pago',
        lines: [
          `Alumno · ${student.name} (${student.id})`,
          `Monto · Q ${formatAmount(input?.amount)} (liquidación completa)`,
          `Referencia del importe · ${required.source === 'deuda' ? 'mensualidad pendiente registrada' : `cuota del ${required.plan.planName}`}`,
          `Método · ${input?.method}`,
          `Mes aplicado · ${monthLabel(new Date())}`
        ],
        confirmLabel: 'Sí, registrar pago'
      });
      if (!approved) throw new Error('La confirmación se canceló en pantalla. No se registró ningún pago.');
      if (isSupabaseConnected) {
        throw new Error('Esta herramienta demo está bloqueada en modo conectado con Supabase. No se modificó el estado.');
      }
      const record = registerPayment({ studentId: input?.studentId, amount: input?.amount, method: input?.method, period });
      if (!elements.app.classList.contains('is-hidden')) renderAndFocus();
      return { paymentId: record.id, studentId: record.studentId, amount: record.amount, status: 'recorded' };
    }
  });
}

async function handleAttendanceSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const classId = form.dataset.classId;
  const sessionDate = form.dataset.sessionDate;
  const studentIds = [...form.querySelectorAll('input[name="attendance"]:checked')].map((input) => input.value);
  const scope = [...form.querySelectorAll('input[name="attendance"]')].map((input) => input.value);
  const submitBtn = form.querySelector('button[type="submit"]');

  if (isSupabaseConnected) {
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando en la nube...';
      }
      await syncSessionAttendances({
        classId,
        sessionDate,
        presentStudentCards: studentIds,
        scopeStudentCards: scope,
        method: 'manual_list'
      });
    } catch (error) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar asistencia';
      }
      showToast('No se guardó la asistencia', `Error remoto: ${error.message}. Podés reintentar.`);
      return;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar asistencia';
      }
    }
  }

  try {
    recordAttendance(classId, studentIds, sessionDate, { replaceDay: true, scope });
  } catch (error) {
    showToast('No se guardó la asistencia', error.message);
    return;
  }
  showToast('Asistencia guardada', `${studentIds.length} alumno${studentIds.length === 1 ? '' : 's'} marcado${studentIds.length === 1 ? '' : 's'} como presente${studentIds.length === 1 ? '' : 's'}.`);
  renderAndFocus();
}

function openClassAttendance(classId) {
  if (findClass(classId)) activeClassId = classId;
  activeRole = 'teacher';
  activeRoute = 'asistencia';
  history.pushState(null, '', '#/asistencia');
  renderAndFocus();
}

function applyClassFilter(button) {
  elements.content.querySelectorAll('.filter-row [data-class-filter]').forEach((chip) => {
    const active = chip.dataset.classFilter === button.dataset.classFilter;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  const filter = button.dataset.classFilter;
  const classes = scheduledClasses();
  const filtered = filter === 'today' ? classes.filter((item) => item.day === 'Hoy')
    : filter === 'initial' ? classes.filter((item) => item.level.toLowerCase().includes('inicial'))
    : filter === 'intermediate' ? classes.filter((item) => item.level.toLowerCase().includes('intermedio'))
    : filter === 'advanced' ? classes.filter((item) => item.level.toLowerCase().includes('avanzado'))
    : classes;
  elements.content.querySelector('#studentSchedule').innerHTML = scheduleList(filtered);
}

// Se redibuja solo el carne para no perder la posicion de scroll al cambiar de hijo.
function applyChildSelect(button) {
  activeChildId = button.dataset.childSelect;
  elements.content.querySelectorAll('[data-child-select]').forEach((chip) => {
    const active = chip === button;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  const panel = elements.content.querySelector('#guardianCarnet');
  if (panel) panel.innerHTML = guardianCarnetMarkup();
}

function applyPaymentFilter(button) {
  elements.content.querySelectorAll('[data-payment-filter]').forEach((chip) => {
    const active = chip === button;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  const filter = button.dataset.paymentFilter;
  const filtered = filter === 'all' ? state.payments : state.payments.filter((item) => paymentStatus(item) === filter);
  elements.content.querySelector('#paymentTableBody').innerHTML = adminPaymentRows(filtered, filter === 'all'
    ? { title: 'Sin pagos registrados', detail: 'Registrá el primer cobro con “+ Registrar pago”.' }
    : { title: 'Sin pagos con este estado', detail: 'Probá con otro filtro o mirá todos los registros.' });
}

// Un solo manejador delegado para toda la página: el contenido se redibuja en cada
// render y enganchar listeners elemento por elemento los iba duplicando.
function handleContentClick(event) {
  TODAY = new Date();
  const find = (selector) => event.target.closest(selector);

  const scheduleClassBtn = find('[data-toggle-schedule-class]');
  if (scheduleClassBtn) {
    const classId = scheduleClassBtn.dataset.toggleScheduleClass;
    if (selectedScheduleClassIds.has(classId)) {
      selectedScheduleClassIds.delete(classId);
    } else {
      selectedScheduleClassIds.add(classId);
    }
    updateScheduleViews();
    return;
  }

  const scheduleAction = find('[data-schedule-action]');
  if (scheduleAction) {
    const action = scheduleAction.dataset.scheduleAction;
    if (action === 'select-all') {
      SCHEDULE_CLASSES.forEach((c) => selectedScheduleClassIds.add(c.id));
    } else if (action === 'clear-selection') {
      selectedScheduleClassIds.clear();
    }
    updateScheduleViews();
    return;
  }

  const attendanceAction = find('[data-attendance-action]');
  if (attendanceAction) {
    const form = elements.content.querySelector('#attendanceForm');
    if (form) {
      const shouldCheck = attendanceAction.dataset.attendanceAction === 'check-all';
      form.querySelectorAll('input[name="attendance"]:not(:disabled)').forEach((input) => {
        input.checked = shouldCheck;
        const label = input.closest('.student-check')?.querySelector('span:last-child');
        if (label) label.textContent = shouldCheck ? 'Presente' : 'Sin registro';
      });
    }
    return;
  }

  const adminExport = find('[data-admin-export]');
  if (adminExport) return exportTableToCsv(adminExport.dataset.adminExport);

  const planDetail = find('[data-plan-detail]');
  if (planDetail) return openPlanDetail(planDetail.dataset.planDetail);
  const go = find('[data-go]');
  if (go) return routeTo(go.dataset.go);
  if (find('[data-open-scan]')) return openScanModal();
  if (find('[data-open-payment]')) return openPaymentModal();
  if (find('[data-open-student]')) return openNewStudentModal();
  if (find('[data-student-payment]')) return openStudentPayment();

  const toggleMusicStatusBtn = find('[data-toggle-music-status]');
  if (toggleMusicStatusBtn) {
    const id = toggleMusicStatusBtn.dataset.toggleMusicStatus;
    const item = (state.musicSuggestions || []).find((s) => s.id === id);
    if (item) {
      const nextStatus = item.status === 'accepted' ? 'pending' : 'accepted';
      item.status = nextStatus;
      persistOrWarn({ ...state });
      renderAndFocus();
      showToast(
        nextStatus === 'accepted' ? '¡Agregada a la playlist! 🎧' : 'Sugerencia pendiente',
        `"${item.song || item.artist || 'Rola'}" ${nextStatus === 'accepted' ? 'quedó lista para la clase' : 'volvió a pendientes'}.`
      );
    }
    return;
  }

  const toggleMusicLikeBtn = find('[data-toggle-music-like]');
  if (toggleMusicLikeBtn) {
    const id = toggleMusicLikeBtn.dataset.toggleMusicLike;
    const item = (state.musicSuggestions || []).find((s) => s.id === id);
    if (item) {
      item.liked = !item.liked;
      persistOrWarn({ ...state });
      renderAndFocus();
      showToast(
        item.liked ? '¡Te gustó esta rola! ❤️' : 'Reacción retirada',
        `Reacción actualizada para "${item.song || item.artist || 'Rola'}".`
      );
    }
    return;
  }

  const openMusicModalBtn = find('[data-open-music-modal]');
  if (openMusicModalBtn) {
    return openMusicSuggestionModal(openMusicModalBtn.dataset.openMusicModal || null);
  }

  const teacherMusicFilterBtn = find('[data-teacher-music-filter]');
  if (teacherMusicFilterBtn) {
    musicTeacherFilter = teacherMusicFilterBtn.dataset.teacherMusicFilter;
    renderAndFocus();
    return;
  }

  const calNav = find('[data-calendar-nav]');
  if (calNav) {
    const delta = Number(calNav.dataset.calendarNav) || 0;
    studentCalendarDate = addDays(studentCalendarDate, delta);
    updateStudentCalendarUI();
    return;
  }

  if (find('[data-calendar-today]')) {
    studentCalendarDate = startOfDay(TODAY);
    updateStudentCalendarUI();
    return;
  }

  const calSelect = find('[data-calendar-select]');
  if (calSelect) {
    studentCalendarDate = parseDayKey(calSelect.dataset.calendarSelect);
    updateStudentCalendarUI();
    return;
  }

  const calFilter = find('[data-calendar-filter]');
  if (calFilter) {
    studentCalendarFilter = calFilter.dataset.calendarFilter;
    updateStudentCalendarUI();
    return;
  }

  const calJump = find('[data-calendar-jump]');
  if (calJump) {
    studentCalendarDate = parseDayKey(calJump.dataset.calendarJump);
    return routeTo('clases');
  }

  const attendance = find('[data-take-attendance]');
  if (attendance) return openClassAttendance(attendance.dataset.takeAttendance);
  const detail = find('[data-class-detail]');
  if (detail) return openClassDetail(detail.dataset.classDetail, detail.dataset.contextDate || null);
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

  if (find('[data-open-create-pass]')) return openCreatePassModal();
  const openVal = find('[data-open-validate-pass]');
  if (openVal) return openValidatePassModal(openVal.dataset.openValidatePass || null);
  const viewPass = find('[data-view-pass]');
  if (viewPass) return openPassModal(viewPass.dataset.viewPass);
  const collectPass = find('[data-collect-pass]');
  if (collectPass) return openCollectPassPaymentModal(collectPass.dataset.collectPass);
  const cancelPass = find('[data-cancel-pass]');
  if (cancelPass) return openCancelPassModal(cancelPass.dataset.cancelPass);

  const passDateBtn = find('[data-pass-date]');
  if (passDateBtn) {
    passFilterDate = passDateBtn.dataset.passDate;
    const customInput = elements.content.querySelector('#passDateInput');
    if (passFilterDate === 'today' && customInput) customInput.value = dayKey(TODAY);
    if (passFilterDate === 'all' && customInput) customInput.value = '';
    updatePassViews();
    return;
  }
  const passTypeBtn = find('[data-pass-type]');
  if (passTypeBtn) {
    passFilterType = passTypeBtn.dataset.passType;
    updatePassViews();
    return;
  }
  const passPayBtn = find('[data-pass-pay]');
  if (passPayBtn) {
    passFilterPayment = passPayBtn.dataset.passPay;
    updatePassViews();
    return;
  }
  const passStatusBtn = find('[data-pass-status]');
  if (passStatusBtn) {
    passFilterStatus = passStatusBtn.dataset.passStatus;
    updatePassViews();
    return;
  }
}

function handleContentInput(event) {
  if (event.target.id === 'passSearchInput') {
    passSearchQuery = event.target.value;
    updatePassViews();
    return;
  }
  if (event.target.id === 'passDateInput') {
    passFilterDate = event.target.value || 'all';
    updatePassViews();
    return;
  }
  if (!event.target.closest('#studentSearch')) return;
  const query = event.target.value.trim().toLowerCase();
  const filtered = state.students.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(query));
  elements.content.querySelector('#studentTableBody').innerHTML = studentRows(filtered);
  // El resultado del filtro se anuncia: sin esto el cambio de la tabla pasaba
  // inadvertido para quien usa lector de pantalla.
  const status = elements.content.querySelector('#studentSearchStatus');
  if (status) status.textContent = `${filtered.length} de ${state.students.length} alumnos.`;
}

function handleContentSubmit(event) {
  if (event.target.id === 'attendanceForm') handleAttendanceSubmit(event);
}

document.querySelectorAll('[data-enter-role]').forEach((button) => button.addEventListener('click', () => enterDemo(button.dataset.enterRole, button.dataset.entryRoute || 'inicio')));
document.querySelector('#exitDemo').addEventListener('click', () => {
  if (isSupabaseConnected) {
    handleSignOut();
  } else {
    leaveDemo();
  }
});
document.querySelector('#resetDemo')?.addEventListener('click', openResetModal);
elements.content.addEventListener('click', handleContentClick);
elements.content.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    const interactive = event.target.closest('[role="button"][data-class-detail]');
    if (interactive && interactive.tagName !== 'BUTTON') {
      event.preventDefault();
      interactive.click();
    }
  }
});
elements.content.addEventListener('input', handleContentInput);
elements.content.addEventListener('submit', handleContentSubmit);
elements.content.addEventListener('change', (event) => {
  if (event.target.id === 'passDateInput') {
    passFilterDate = event.target.value || 'all';
    updatePassViews();
    return;
  }
  if (event.target.matches('input[name="attendance"]')) {
    const label = event.target.closest('.student-check')?.querySelector('span:last-child');
    if (label) label.textContent = event.target.checked ? 'Presente' : 'Sin registro';
  }
});
elements.modalLayer.addEventListener('click', handleModalClick);
elements.modalLayer.addEventListener('submit', handleModalSubmit);
elements.modalLayer.addEventListener('change', (event) => {
  if (event.target.closest('#paymentForm') && ['studentId', 'period'].includes(event.target.name)) updatePaymentForm();
  if (event.target.closest('#createPassForm')) updateCreatePassForm();
});

// Estabilizar inputs en modal al abrir teclado móvil
elements.modalLayer.addEventListener('focusin', (event) => {
  const target = event.target;
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
    setTimeout(() => {
      syncModalWithVisualViewport();
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncModalWithVisualViewport);
  window.visualViewport.addEventListener('scroll', syncModalWithVisualViewport);
}
document.querySelector('#profileButton').addEventListener('click', openProfile);

elements.roleSwitcher.addEventListener('change', (event) => {
  if (isSupabaseConnected) {
    event.preventDefault();
    elements.roleSwitcher.value = activeRole;
    showToast('Modo conectado activo', 'El rol está determinado por tu sesión autenticada en Supabase.');
    return;
  }
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

async function handleSignOut() {
  await signOut();
  clearCurrentSessionState();
  isSupabaseConnected = false;
  authenticatedUser = null;
  authenticatedProfile = null;
  clearLocalAuthCache(true);
  state = loadState();
  activeRole = state.role || 'student';
  updateShell();
  leaveDemo();
  showToast('Sesión cerrada', 'Has vuelto al modo demostración local.');
}

function openAuthModal() {
  if (isSupabaseConnected) {
    openModal({
      title: 'Sesión autenticada en Supabase',
      eyebrow: 'Conexión a la nube',
      body: `
        <article class="surface-card">
          <div class="person-cell">
            <span class="avatar" style="width:52px;height:52px">${escapeHtml(roleConfig[activeRole]?.initials || 'IM')}</span>
            <span>
              <strong>${escapeHtml(authenticatedUser?.email || 'Usuario conectado')}</strong>
              <small>Rol asignado: ${escapeHtml(roleConfig[activeRole]?.label || activeRole)}</small>
            </span>
          </div>
          <p class="payment-meta" style="margin-top:16px">
            Estás conectado en tiempo real con Supabase. Las operaciones se validan con RLS y procedimientos transaccionales.
          </p>
        </article>
        <div class="form-actions" style="margin-top:20px">
          <button class="button button--light" type="button" data-close-modal>Cerrar</button>
          <button class="button button--red" type="button" id="confirmSignOut">Cerrar sesión remota</button>
        </div>
      `
    });
    document.querySelector('#confirmSignOut')?.addEventListener('click', async () => {
      closeModal();
      await handleSignOut();
    });
  } else {
    openModal({
      title: 'Iniciar sesión en Supabase',
      eyebrow: 'Conexión a la nube',
      body: `
        <p class="modal-note">Iniciá sesión para ingresar en modo conectado con permisos RLS según tu rol oficial.</p>
        <form id="authLoginForm" class="modal-form">
          <label class="field">
            <span>Correo electrónico</span>
            <input class="input" type="email" name="email" required autocomplete="username" placeholder="ejemplo@inmotion.gt" />
          </label>
          <label class="field">
            <span>Contraseña</span>
            <input class="input" type="password" name="password" required autocomplete="current-password" placeholder="••••••••" />
          </label>
          <p class="payment-meta" id="authErrorMessage" role="status" style="color:var(--red)"></p>
          <div class="form-actions">
            <button class="button button--light" type="button" data-close-modal>Cancelar</button>
            <button class="button button--primary" type="submit" id="submitAuthLogin">Conectar</button>
          </div>
        </form>
      `
    });
    const authForm = document.querySelector('#authLoginForm');
    authForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.querySelector('#authErrorMessage');
      const submitBtn = document.querySelector('#submitAuthLogin');
      const fd = new FormData(authForm);
      const email = fd.get('email');
      const password = fd.get('password');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Conectando...';
      }
      if (errEl) errEl.textContent = '';
      try {
        const res = await signInWithPassword(email, password);
        clearCurrentSessionState();
        authenticatedUser = res.user;
        authenticatedProfile = res.profile;
        isSupabaseConnected = true;
        if (res.profile?.role && roleConfig[res.profile.role]) {
          activeRole = res.profile.role;
        }
        state = loadState();
        closeModal();
        showToast('Sesión iniciada', `Conectado como ${res.profile?.first_name || email} · Rol: ${activeRole}`);
        await syncWithSupabase();
        renderAndFocus();
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Conectar';
        }
        if (errEl) errEl.textContent = err.message;
      }
    });
  }
}

async function syncWithSupabase() {
  if (!isSupabaseConnected) return;
  try {
    // 1. Clases remotas
    const remoteClasses = await fetchRemoteClasses();
    if (Array.isArray(remoteClasses)) {
      classData = remoteClasses;
    }

    // 2. Alumnos remotos (las respuestas remotas vacías reemplazan el ámbito, sin mezclar datos demo)
    const remoteStudents = await fetchRemoteStudents();
    if (Array.isArray(remoteStudents)) {
      state.students = remoteStudents;
      persistState(state);
    }

    // 3. Pagos remotos (las respuestas remotas vacías reemplazan el ámbito, sin mezclar datos demo)
    const remotePayments = await fetchRemotePayments(state.students);
    if (Array.isArray(remotePayments)) {
      state.payments = remotePayments;
      persistState(state);
    }

    // 4. Asistencias remotas (reemplaza sin preservar marcas viejas ni demo)
    const remoteAttendance = await fetchRemoteAttendance();
    if (Array.isArray(remoteAttendance)) {
      state.attendanceLog = remoteAttendance;
      persistState(state);
    }

    supabaseSyncError = null;

    if (!elements.app.classList.contains('is-hidden')) {
      renderApp();
    }
    console.log('[In Motion] Base de datos Supabase sincronizada con éxito');
  } catch (err) {
    supabaseSyncError = err.message;
    console.warn('[In Motion] No se pudo sincronizar con Supabase:', err.message);
    if (!elements.app.classList.contains('is-hidden')) {
      renderApp();
    }
    showToast('Error de sincronización', `No se pudieron cargar datos remotos: ${err.message}.`);
  }
}

async function initSessionAndBoot() {
  registerWebMcpTools();
  elements.demoBadge?.addEventListener('click', openAuthModal);

  try {
    const authSession = await restoreSession();
    if (authSession && authSession.profile) {
      clearCurrentSessionState();
      authenticatedUser = authSession.user;
      authenticatedProfile = authSession.profile;
      isSupabaseConnected = true;
      if (authSession.profile.role && roleConfig[authSession.profile.role]) {
        activeRole = authSession.profile.role;
      }
      state = loadState();
      await syncWithSupabase();
    } else {
      isSupabaseConnected = false;
      state = loadState();
    }
  } catch (e) {
    console.warn('[In Motion] Inicio en modo demostración local:', e.message);
    isSupabaseConnected = false;
    state = loadState();
  }
  updateShell();
}

window.inmotionAuth = {
  signInWithPassword,
  signOut,
  restoreSession,
  refreshSession,
  getAuthenticatedProfile,
  clearLocalAuthCache
};

initSessionAndBoot();
