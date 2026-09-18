// ==============================================================================
// IN MOTION ACADEMY - SUPABASE CLIENT & CLOUD SYNC
// Conexión oficial a Supabase (Vanilla ES Modules, Zero Dependencies)
// ==============================================================================

export const SUPABASE_URL = 'https://qwjlixqtbcchyiwynfmv.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_8rsKaCxrpcr7-7fZ1LKrFg_tUhbiDiu';

const AUTH_STORAGE_KEY = 'inmotion_supabase_auth_session';

// Gestión del token de autenticación (JWT) para peticiones RLS
let currentAuthToken = null;
let authenticatedProfile = null;

export function setAuthToken(token) {
  currentAuthToken = token || null;
}

export function getAuthToken() {
  return currentAuthToken;
}

export function getAuthenticatedProfile() {
  return authenticatedProfile;
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

function saveAuthSession(session) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('[Supabase] No se pudo persistir la sesión localmente:', e.message);
  }
}

function getStoredAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Limpia todas las memorias intermedias y cachés de usuario al cambiar de sesión
 */
export function clearLocalAuthCache(purgeStorage = true) {
  currentAuthToken = null;
  authenticatedProfile = null;
  cardToProfileUuid.clear();
  profileUuidToCard.clear();
  if (purgeStorage) {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
  }
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
      let parsedMessage = err || res.statusText;
      try {
        const jsonErr = JSON.parse(err);
        if (jsonErr.message) parsedMessage = jsonErr.message;
      } catch {}
      throw new Error(`Error en RPC ${functionName}: ${parsedMessage}`);
    }
    return await res.json();
  }
};

// ------------------------------------------------------------------------------
// SUPABASE AUTH (AUTENTICACIÓN REAL)
// ------------------------------------------------------------------------------

/**
 * Consulta el perfil del usuario autenticado en la tabla public.profiles
 */
async function fetchProfileByUserId(userId) {
  const rows = await db.get('profiles', `user_id=eq.${userId}&select=*`);
  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0];
  }
  return null;
}

/**
 * Inicio de sesión con correo y contraseña en Supabase Auth
 */
export async function signInWithPassword(email, password) {
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.msg || err.message || `Error de autenticación (${res.status})`);
  }

  const session = await res.json();
  clearLocalAuthCache(false);
  saveAuthSession(session);
  setAuthToken(session.access_token);

  const profile = await fetchProfileByUserId(session.user.id);
  authenticatedProfile = profile;

  return { user: session.user, session, profile };
}

/**
 * Refresca la sesión activa de Supabase usando el refresh_token
 */
export async function refreshSession(refreshToken) {
  const stored = getStoredAuthSession();
  const token = refreshToken || stored?.refresh_token;
  if (!token) throw new Error('No hay token de refresco disponible.');

  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: token })
  });

  if (!res.ok) {
    clearLocalAuthCache(true);
    throw new Error('La sesión remota ha expirado. Es necesario iniciar sesión nuevamente.');
  }

  const session = await res.json();
  clearLocalAuthCache(false);
  saveAuthSession(session);
  setAuthToken(session.access_token);

  const profile = await fetchProfileByUserId(session.user.id);
  authenticatedProfile = profile;

  return { user: session.user, session, profile };
}

/**
 * Restaura la sesión guardada y recupera el perfil y rol del usuario
 */
export async function restoreSession() {
  const session = getStoredAuthSession();
  if (!session || !session.access_token) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at - nowSec < 60) {
    if (session.refresh_token) {
      try {
        return await refreshSession(session.refresh_token);
      } catch {
        return null;
      }
    } else {
      clearLocalAuthCache(true);
      return null;
    }
  }

  setAuthToken(session.access_token);
  try {
    const profile = await fetchProfileByUserId(session.user.id);
    authenticatedProfile = profile;
    return { user: session.user, session, profile };
  } catch (err) {
    console.warn('[Supabase] Error al validar sesión guardada:', err.message);
    if (session.refresh_token) {
      try {
        return await refreshSession(session.refresh_token);
      } catch {
        clearLocalAuthCache(true);
        return null;
      }
    }
    clearLocalAuthCache(true);
    return null;
  }
}

/**
 * Cierra la sesión activa en Supabase y limpia las memorias locales
 */
export async function signOut() {
  try {
    if (currentAuthToken) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: getHeaders()
      });
    }
  } catch (err) {
    console.warn('[Supabase] Aviso en cierre remoto de sesión:', err.message);
  } finally {
    clearLocalAuthCache(true);
  }
  return true;
}

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
      teacherId: c.teacher_id || null,
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

    const planName = mem ? mem.plan_name : null;
    const planStatus = mem
      ? (mem.status === 'active' ? 'Al día' : 'Pendiente')
      : 'Sin membresía';

    students.push({
      id: c.card_number,
      profileId: p.id,
      userId: p.user_id || null,
      name: fullName,
      initials: initials || 'IM',
      plan: planName,
      phone: p.phone || 'Sin registrar',
      status: planStatus,
      level: p.level || 'Sin nivel',
      classIds: enrollmentsMap.get(c.student_id) || [],
      notes: p.notes || '',
      guardianId: p.guardian_id ? (profileUuidToCard.get(p.guardian_id) || p.guardian_id) : null,
      rawGuardianUuid: p.guardian_id || null
    });
  }

  return students;
}

/**
 * Registra un nuevo alumno remotamente en Supabase de forma transaccional.
 * Pasa precio numérico explícito sin deducciones textuales.
 */
export async function createRemoteStudent({ id, name, phone, plan, planPrice, level, notes }) {
  const parts = String(name || '').trim().split(/\s+/);
  const firstName = parts[0] || name;
  const lastName = parts.slice(1).join(' ') || '';

  const res = await db.rpc('create_student_transactional', {
    p_card_number: id,
    p_first_name: firstName,
    p_last_name: lastName,
    p_phone: phone && phone !== 'Sin registrar' ? phone : null,
    p_level: level && level !== 'Sin nivel' ? level : null,
    p_notes: notes || null,
    p_plan_name: plan || null,
    p_plan_price: planPrice !== undefined && planPrice !== null ? Number(planPrice) : null
  });

  const row = Array.isArray(res) ? res[0] : res;
  if (row?.profile_id) {
    cardToProfileUuid.set(id, row.profile_id);
    profileUuidToCard.set(row.profile_id, id);
  }

  return row;
}

/**
 * Sincroniza los cambios de inscripciones de un alumno en Supabase.
 */
export async function syncRemoteEnrollments({ studentCardId, classIds = [] }) {
  const studentUuid = await getProfileUuidByCard(studentCardId);
  if (!studentUuid) {
    throw new Error(`No se encontró registro remoto para el alumno ${studentCardId}`);
  }

  const current = await db.get('enrollments', `student_id=eq.${studentUuid}&select=id,class_id,status`);
  const currentMap = new Map((current || []).map((e) => [e.class_id, e]));

  for (const [cid, e] of currentMap.entries()) {
    if (!classIds.includes(cid)) {
      await db.delete('enrollments', `id=eq.${e.id}`);
    }
  }

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
 * Sincronización transaccional y por lotes de la lista de asistencia de una sesión.
 * Permite listas vacías para desmarcar el ámbito consultado sin fallos parciales.
 */
export async function syncSessionAttendances({ classId, sessionDate, presentStudentCards = [], scopeStudentCards = [], method = 'manual_list' }) {
  const presentUuids = [];
  for (const card of presentStudentCards) {
    const uuid = await getProfileUuidByCard(card);
    if (!uuid) {
      throw new Error(`No se encontró perfil para el alumno con carné ${card}`);
    }
    presentUuids.push(uuid);
  }

  const scopeUuids = [];
  for (const card of scopeStudentCards) {
    const uuid = await getProfileUuidByCard(card);
    if (uuid) {
      scopeUuids.push(uuid);
    }
  }

  const res = await db.rpc('sync_session_attendances', {
    p_class_id: classId,
    p_session_date: sessionDate,
    p_present_student_ids: presentUuids,
    p_scope_student_ids: scopeUuids,
    p_method: method
  });

  return Array.isArray(res) ? res[0] : res;
}

/**
 * Marca la asistencia individual de un alumno vía RPC (sin fallbacks directos elusivos)
 */
export async function syncRemoteAttendance({ studentCardId, classId, sessionDate, method = 'qr_scan' }) {
  const studentUuid = await getProfileUuidByCard(studentCardId);
  if (!studentUuid) {
    throw new Error(`No se encontró perfil para el carné ${studentCardId}`);
  }

  const res = await db.rpc('set_attendance', {
    p_class_id: classId,
    p_session_date: sessionDate,
    p_student_id: studentUuid,
    p_present: true,
    p_method: method
  });

  return Array.isArray(res) ? res[0] : res;
}

/**
 * Desmarca la asistencia individual de un alumno vía RPC (sin fallbacks directos elusivos)
 */
export async function deleteRemoteAttendance({ studentCardId, classId, sessionDate }) {
  const studentUuid = await getProfileUuidByCard(studentCardId);
  if (!studentUuid) return false;

  const res = await db.rpc('set_attendance', {
    p_class_id: classId,
    p_session_date: sessionDate,
    p_student_id: studentUuid,
    p_present: false
  });

  return Array.isArray(res) ? res[0] : res;
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
 * Registra un pago en Supabase con período e idempotencia vía RPC.
 * Valida período e importe en servidor y rechaza reutilización de clave con datos alterados.
 */
export async function syncRemotePayment({ studentCardId, amount, method, period, receiptNumber, notes, idempotencyKey }) {
  const studentUuid = await getProfileUuidByCard(studentCardId);
  if (!studentUuid) {
    throw new Error(`No se encontró perfil para el alumno ${studentCardId}`);
  }

  if (!period) {
    throw new Error('El período de pago es obligatorio.');
  }

  const res = await db.rpc('register_payment_idempotent', {
    p_student_id: studentUuid,
    p_period: String(period),
    p_amount: Number(amount) || 0,
    p_payment_method: method || 'transferencia',
    p_receipt_number: receiptNumber || null,
    p_notes: notes || null,
    p_idempotency_key: idempotencyKey || receiptNumber || null
  });

  const row = Array.isArray(res) ? res[0] : res;
  if (!row) {
    throw new Error('No se recibió respuesta del servidor para el pago registrado.');
  }

  return {
    id: row.receipt_number || `REC-${row.id.slice(0, 8)}`,
    remoteId: row.id,
    studentId: studentCardId,
    studentUuid: row.student_id,
    period: row.period,
    amount: Number(row.amount),
    method: row.payment_method,
    reference: notes || '',
    isDuplicate: Boolean(row.is_duplicate)
  };
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
