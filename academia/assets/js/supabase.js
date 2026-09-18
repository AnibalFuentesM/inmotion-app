// ==============================================================================
// IN MOTION ACADEMY - SUPABASE CLIENT & CLOUD SYNC
// Conexión oficial a Supabase (Vanilla ES Modules, Zero Dependencies)
// ==============================================================================

export const SUPABASE_URL = 'https://qwjlixqtbcchyiwynfmv.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_8rsKaCxrpcr7-7fZ1LKrFg_tUhbiDiu';

// Gestión del token de autenticación (JWT) para peticiones RLS
let currentAuthToken = null;

export function setAuthToken(token) {
  currentAuthToken = token || null;
}

export function getAuthToken() {
  return currentAuthToken;
}

function getHeaders(extra = {}) {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...extra
  };
  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }
  return headers;
}

// Mapas en memoria para traducción rápida entre card_number ('IM-0241') y profile.id (UUID)
const cardToProfileUuid = new Map();
const profileUuidToCard = new Map();

export const db = {
  /**
   * Consulta registros en una tabla de Supabase
   */
  async get(table, query = 'select=*') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
    const res = await fetch(url, {
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Supabase GET Error ${res.status}] ${table}:`, err);
      throw new Error(`Error al consultar ${table}: ${err || res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Inserta uno o varios registros
   */
  async insert(table, data) {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Supabase POST Error ${res.status}] ${table}:`, err);
      throw new Error(`Error al insertar en ${table}: ${err || res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Actualiza registros según un filtro
   */
  async update(table, matchQuery, data) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${matchQuery}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Supabase PATCH Error ${res.status}] ${table}:`, err);
      throw new Error(`Error al actualizar ${table}: ${err || res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Elimina registros según un filtro
   */
  async delete(table, matchQuery) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${matchQuery}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Supabase DELETE Error ${res.status}] ${table}:`, err);
      throw new Error(`Error al eliminar en ${table}: ${err || res.statusText}`);
    }
    return true;
  },

  /**
   * Ejecuta una función remota RPC
   */
  async rpc(functionName, params = {}) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Supabase RPC Error ${res.status}] ${functionName}:`, err);
      throw new Error(`Error en RPC ${functionName}: ${err || res.statusText}`);
    }
    return await res.json();
  }
};

// ------------------------------------------------------------------------------
// OPERACIONES DE DOMINIO IN MOTION
// ------------------------------------------------------------------------------

/**
 * Consulta las clases activas en Supabase
 */
export async function fetchRemoteClasses() {
  const rows = await db.get('classes', 'select=*&order=weekday.asc,time.asc');
  if (Array.isArray(rows) && rows.length > 0) {
    return rows.map((c) => ({
      id: c.id,
      weekday: c.weekday,
      time: c.time,
      name: c.name,
      level: c.level || 'Nivel abierto',
      teacher: c.teacher_name || 'Staff In Motion',
      room: c.room || 'Salón',
      enrolled: 10,
      capacity: c.capacity || 20
    }));
  }
  return [];
}

/**
 * Consulta el perfil de estudiante por número de carné ('IM-0241')
 */
export async function getProfileUuidByCard(cardNumber) {
  if (cardToProfileUuid.has(cardNumber)) {
    return cardToProfileUuid.get(cardNumber);
  }
  try {
    const rows = await db.get('cards', `card_number=eq.${encodeURIComponent(cardNumber)}&select=student_id,card_number`);
    if (rows && rows.length > 0) {
      cardToProfileUuid.set(cardNumber, rows[0].student_id);
      profileUuidToCard.set(rows[0].student_id, cardNumber);
      return rows[0].student_id;
    }
  } catch (err) {
    console.warn('[Supabase] Error buscando carné:', err.message);
  }
  return null;
}

/**
 * Obtiene los alumnos y carnés almacenados en Supabase.
 * No inventa planes, niveles, precios ni estados.
 */
export async function fetchRemoteStudents() {
  const cards = await db.get('cards', 'select=student_id,card_number,qr_code,is_active');
  if (!Array.isArray(cards) || cards.length === 0) return [];

  const profiles = await db.get('profiles', 'select=*');
  const enrollments = await db.get('enrollments', 'select=*&status=eq.active');
  const memberships = await db.get('memberships', 'select=*');

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  const membershipMap = new Map((memberships || []).map((m) => [m.student_id, m]));
  const enrollmentsMap = new Map();

  for (const e of enrollments || []) {
    if (!enrollmentsMap.has(e.student_id)) {
      enrollmentsMap.set(e.student_id, []);
    }
    enrollmentsMap.get(e.student_id).push(e.class_id);
  }

  const students = [];
  for (const c of cards) {
    cardToProfileUuid.set(c.card_number, c.student_id);
    profileUuidToCard.set(c.student_id, c.card_number);

    const p = profileMap.get(c.student_id);
    if (!p) continue;

    const mem = membershipMap.get(c.student_id);
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Alumno In Motion';
    const initials = fullName
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

    // Mapeo fidedigno sin inventar datos:
    // Si no tiene membresía, plan es null y estado es 'Sin membresía'
    // Si no tiene nivel, level es p.level o null
    const planName = mem ? mem.plan_name : null;
    const planStatus = mem
      ? (mem.status === 'active' ? 'Al día' : 'Pendiente')
      : 'Sin membresía';

    students.push({
      id: c.card_number,
      name: fullName,
      initials: initials || 'IM',
      plan: planName,
      phone: p.phone || 'Sin registrar',
      status: planStatus,
      level: p.level || 'Sin nivel',
      classIds: enrollmentsMap.get(c.student_id) || [],
      notes: p.notes || '',
      guardianId: p.guardian_id ? (profileUuidToCard.get(p.guardian_id) || p.guardian_id) : null
    });
  }

  return students;
}

/**
 * Registra un nuevo alumno remotamente en Supabase.
 */
export async function createRemoteStudent({ id, name, phone, plan, level, notes }) {
  const parts = String(name || '').trim().split(/\s+/);
  const firstName = parts[0] || name;
  const lastName = parts.slice(1).join(' ') || '';

  // 1. Crear perfil
  const createdProfiles = await db.insert('profiles', {
    role: 'student',
    first_name: firstName,
    last_name: lastName,
    phone: phone && phone !== 'Sin registrar' ? phone : null,
    level: level && level !== 'Sin nivel' ? level : null,
    notes: notes || null
  });

  if (!createdProfiles || !createdProfiles[0]) {
    throw new Error('No se pudo crear el perfil remoto del alumno.');
  }

  const profileId = createdProfiles[0].id;
  cardToProfileUuid.set(id, profileId);
  profileUuidToCard.set(profileId, id);

  // 2. Crear carné permanente desacoplado de pagos
  await db.insert('cards', {
    student_id: profileId,
    card_number: id,
    qr_code: id,
    is_active: true
  });

  // 3. Crear membresía inicial si se especificó plan
  if (plan) {
    await db.insert('memberships', {
      student_id: profileId,
      plan_name: plan,
      price: plan.includes('4') ? 300 : plan.includes('ilimitado') ? 625 : 450,
      status: 'past_due'
    });
  }

  return { profileId, cardId: id };
}

/**
 * Sincroniza los cambios de inscripciones de un alumno en Supabase.
 */
export async function syncRemoteEnrollments({ studentCardId, classIds = [] }) {
  const studentUuid = await getProfileUuidByCard(studentCardId);
  if (!studentUuid) {
    throw new Error(`No se encontró registro remoto para el alumno ${studentCardId}`);
  }

  // 1. Obtener inscripciones activas actuales
  const current = await db.get('enrollments', `student_id=eq.${studentUuid}&select=id,class_id,status`);
  const currentMap = new Map((current || []).map((e) => [e.class_id, e]));

  // 2. Retirar las que ya no están en classIds
  for (const [cid, e] of currentMap.entries()) {
    if (!classIds.includes(cid)) {
      await db.delete('enrollments', `id=eq.${e.id}`);
    }
  }

  // 3. Insertar las nuevas
  for (const cid of classIds) {
    if (!currentMap.has(cid)) {
      await db.insert('enrollments', {
        student_id: studentUuid,
        class_id: cid,
        status: 'active'
      });
    }
  }

  return true;
}

/**
 * Obtiene o crea de forma atómica una sesión de clase para evitar concurrencia
 */
async function getOrCreateSessionId(classId, sessionDate) {
  try {
    // Intentar vía función RPC atómica
    const rpcRes = await db.rpc('get_or_create_session', {
      p_class_id: classId,
      p_session_date: sessionDate
    });
    if (rpcRes) return rpcRes;
  } catch {
    // Fallback directo con verificación
    const existing = await db.get('class_sessions', `class_id=eq.${classId}&session_date=eq.${sessionDate}&select=id`);
    if (existing && existing.length > 0) {
      return existing[0].id;
    }
    const created = await db.insert('class_sessions', {
      class_id: classId,
      session_date: sessionDate
    });
    if (created && created[0]) return created[0].id;
  }
  return null;
}

/**
 * Marca la asistencia de un alumno de forma concurrente y segura
 */
export async function syncRemoteAttendance({ studentCardId, classId, sessionDate, method = 'qr_scan' }) {
  const studentUuid = await getProfileUuidByCard(studentCardId);
  if (!studentUuid) {
    throw new Error(`No se encontró UUID para el carné ${studentCardId}`);
  }

  try {
    // Intentar RPC atómico si existe
    await db.rpc('set_attendance', {
      p_class_id: classId,
      p_session_date: sessionDate,
      p_student_id: studentUuid,
      p_present: true,
      p_method: method
    });
    return true;
  } catch {
    // Fallback a inserción directa
    const sessionId = await getOrCreateSessionId(classId, sessionDate);
    if (!sessionId) throw new Error('No se pudo abrir la sesión de clase.');

    await db.insert('attendances', {
      session_id: sessionId,
      student_id: studentUuid,
      status: 'presente',
      method: method === 'manual' ? 'manual_list' : 'qr_scan'
    });
    return true;
  }
}

/**
 * Desmarca la asistencia de un alumno (elimina el registro para que no reaparezca)
 */
export async function deleteRemoteAttendance({ studentCardId, classId, sessionDate }) {
  const studentUuid = await getProfileUuidByCard(studentCardId);
  if (!studentUuid) return false;

  try {
    await db.rpc('set_attendance', {
      p_class_id: classId,
      p_session_date: sessionDate,
      p_student_id: studentUuid,
      p_present: false
    });
    return true;
  } catch {
    const existingSessions = await db.get('class_sessions', `class_id=eq.${classId}&session_date=eq.${sessionDate}&select=id`);
    if (!existingSessions || existingSessions.length === 0) return true;
    const sessionId = existingSessions[0].id;
    await db.delete('attendances', `session_id=eq.${sessionId}&student_id=eq.${studentUuid}`);
    return true;
  }
}

/**
 * Consulta el historial de asistencia en Supabase
 */
export async function fetchRemoteAttendance() {
  const rows = await db.get('attendances', 'select=student_id,recorded_at,class_sessions(class_id,session_date)');
  if (!Array.isArray(rows)) return [];

  const log = [];
  for (const r of rows) {
    const cardNumber = profileUuidToCard.get(r.student_id);
    const classId = r.class_sessions?.class_id;
    const at = r.class_sessions?.session_date || r.recorded_at?.slice(0, 10);
    if (cardNumber && classId && at) {
      log.push({ studentId: cardNumber, classId, at });
    }
  }
  return log;
}

/**
 * Registra un pago en Supabase con período e idempotencia.
 * Devuelve el registro confirmado o propaga el error.
 */
export async function syncRemotePayment({ studentCardId, amount, method, period, receiptNumber, notes, idempotencyKey }) {
  const studentUuid = await getProfileUuidByCard(studentCardId);
  if (!studentUuid) {
    throw new Error(`No se encontró UUID para el alumno ${studentCardId}`);
  }

  if (!period) {
    throw new Error('El período de pago es obligatorio.');
  }

  try {
    // Intentar RPC idempotente
    const rpcRes = await db.rpc('register_payment_idempotent', {
      p_student_id: studentUuid,
      p_period: String(period),
      p_amount: Number(amount) || 0,
      p_payment_method: method || 'transferencia',
      p_receipt_number: receiptNumber || null,
      p_notes: notes || null,
      p_idempotency_key: idempotencyKey || receiptNumber || null
    });
    return rpcRes;
  } catch (rpcErr) {
    // Si la función RPC aún no está migrada en la base remota, ejecutar insert directo
    console.warn('[Supabase] RPC idempotente no disponible, usando insert con constraint:', rpcErr.message);
    const result = await db.insert('payments', {
      student_id: studentUuid,
      period: String(period),
      amount: Number(amount) || 0,
      payment_method: method || 'transferencia',
      receipt_number: receiptNumber || null,
      notes: notes || null,
      idempotency_key: idempotencyKey || receiptNumber || null
    });
    return result && result[0] ? result[0] : result;
  }
}

/**
 * Recupera el listado de pagos registrados en Supabase
 */
export async function fetchRemotePayments() {
  const rows = await db.get('payments', 'select=*&order=recorded_at.desc');
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const payments = [];
  for (const r of rows) {
    const cardNumber = profileUuidToCard.get(r.student_id);
    if (!cardNumber) continue;

    payments.push({
      id: r.receipt_number || `REC-${r.id.slice(0, 8)}`,
      studentId: cardNumber,
      period: r.period || 'Período actual',
      amount: Number(r.amount) || 0,
      method: r.payment_method || 'transferencia',
      reference: r.notes || '',
      date: r.recorded_at?.slice(0, 10) || '',
      paidAt: r.recorded_at?.slice(0, 10) || '',
      status: 'Pagado'
    });
  }
  return payments;
}
