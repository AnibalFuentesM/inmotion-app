// ==============================================================================
// IN MOTION ACADEMY - SUPABASE CLIENT & CLOUD SYNC
// Conexión oficial a Supabase (Vanilla ES Modules, Zero Dependencies)
// ==============================================================================

export const SUPABASE_URL = 'https://qwjlixqtbcchyiwynfmv.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_8rsKaCxrpcr7-7fZ1LKrFg_tUhbiDiu';

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
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Supabase GET Error ${res.status}] ${table}:`, err);
      throw new Error(`Error al consultar ${table}: ${res.statusText}`);
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
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Supabase POST Error ${res.status}] ${table}:`, err);
      throw new Error(`Error al insertar en ${table}: ${res.statusText}`);
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
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Supabase PATCH Error ${res.status}] ${table}:`, err);
      throw new Error(`Error al actualizar ${table}: ${res.statusText}`);
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
      headers: {
        'apikey': SUPABASE_KEY
      }
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Supabase DELETE Error ${res.status}] ${table}:`, err);
      throw new Error(`Error al eliminar en ${table}: ${res.statusText}`);
    }
    return true;
  }
};

// ------------------------------------------------------------------------------
// OPERACIONES DE DOMINIO IN MOTION
// ------------------------------------------------------------------------------

/**
 * Consulta las clases activas en Supabase
 */
export async function fetchRemoteClasses() {
  try {
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
  } catch (err) {
    console.warn('[Supabase] No se pudieron cargar clases remotas, usando locales:', err.message);
  }
  return null;
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
 * Si la base de datos está vacía, sincroniza los alumnos semilla iniciales con sus carnés
 */
export async function seedRemoteStudentsIfEmpty(baseStudents) {
  try {
    const existingCards = await db.get('cards', 'select=id&limit=1');
    if (Array.isArray(existingCards) && existingCards.length > 0) {
      // Ya existen alumnos en la nube
      return;
    }

    console.log('[Supabase] Inicializando padrón de alumnos en la nube...');
    for (const s of baseStudents) {
      const parts = s.name.trim().split(' ');
      const firstName = parts[0] || s.name;
      const lastName = parts.slice(1).join(' ') || 'In Motion';

      // 1. Crear Profile
      const profile = await db.insert('profiles', {
        role: 'student',
        first_name: firstName,
        last_name: lastName,
        phone: s.phone || null
      });

      if (!profile || !profile[0]) continue;
      const profileId = profile[0].id;
      cardToProfileUuid.set(s.id, profileId);
      profileUuidToCard.set(profileId, s.id);

      // 2. Crear Card permanente
      await db.insert('cards', {
        student_id: profileId,
        card_number: s.id,
        qr_code: s.id,
        is_active: true
      });

      // 3. Crear Enrollments
      if (Array.isArray(s.classIds)) {
        for (const cid of s.classIds) {
          try {
            await db.insert('enrollments', {
              student_id: profileId,
              class_id: cid,
              status: 'active'
            });
          } catch (e) {
            console.warn(`[Supabase] No se pudo inscribir a ${s.id} en ${cid}:`, e.message);
          }
        }
      }

      // 4. Crear Membresía
      await db.insert('memberships', {
        student_id: profileId,
        plan_name: s.plan || 'Plan 8 clases',
        price: s.plan?.includes('4') ? 300 : s.plan?.includes('ilimitado') ? 625 : 450,
        status: s.status === 'Al día' ? 'active' : 'past_due'
      });
    }
    console.log('[Supabase] Padrón de alumnos inicial sincronizado con éxito.');
  } catch (err) {
    console.warn('[Supabase] Error en inicialización de alumnos:', err.message);
  }
}

/**
 * Obtiene los alumnos y carnés almacenados en Supabase
 */
export async function fetchRemoteStudents() {
  try {
    const cards = await db.get('cards', 'select=student_id,card_number,qr_code,is_active');
    if (!Array.isArray(cards) || cards.length === 0) return null;

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
      const fullName = `${p.first_name} ${p.last_name}`.trim();
      const initials = fullName
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

      students.push({
        id: c.card_number,
        name: fullName,
        initials: initials || 'IM',
        plan: mem ? mem.plan_name : 'Plan 8 clases',
        phone: p.phone || 'Sin registrar',
        status: mem?.status === 'past_due' ? 'Pendiente' : 'Al día',
        level: 'Nivel intermedio',
        classIds: enrollmentsMap.get(c.student_id) || [],
        notes: ''
      });
    }

    return students.length > 0 ? students : null;
  } catch (err) {
    console.warn('[Supabase] Error consultando alumnos remotos:', err.message);
    return null;
  }
}

/**
 * Registra una sesión de clase y la marcación de asistencia en Supabase
 */
export async function syncRemoteAttendance({ studentCardId, classId, sessionDate, method = 'qr_scan' }) {
  try {
    const studentUuid = await getProfileUuidByCard(studentCardId);
    if (!studentUuid) {
      console.warn(`[Supabase] No se encontró UUID para el carné ${studentCardId}`);
      return false;
    }

    // 1. Asegurar o crear la sesión de clase para esa fecha
    let sessionId = null;
    const existingSessions = await db.get('class_sessions', `class_id=eq.${classId}&session_date=eq.${sessionDate}&select=id`);
    if (existingSessions && existingSessions.length > 0) {
      sessionId = existingSessions[0].id;
    } else {
      const createdSession = await db.insert('class_sessions', {
        class_id: classId,
        session_date: sessionDate
      });
      if (createdSession && createdSession[0]) {
        sessionId = createdSession[0].id;
      }
    }

    if (!sessionId) return false;

    // 2. Registrar asistencia
    await db.insert('attendances', {
      session_id: sessionId,
      student_id: studentUuid,
      status: 'presente',
      method: method === 'manual' ? 'manual_list' : 'qr_scan'
    });

    console.log(`[Supabase] Asistencia sincronizada para alumno ${studentCardId} en clase ${classId}`);
    return true;
  } catch (err) {
    console.warn('[Supabase] No se pudo sincronizar la asistencia remota:', err.message);
    return false;
  }
}

/**
 * Registra un pago en la tabla payments de Supabase
 */
export async function syncRemotePayment({ studentCardId, amount, method, receiptNumber, notes }) {
  try {
    const studentUuid = await getProfileUuidByCard(studentCardId);
    if (!studentUuid) return false;

    await db.insert('payments', {
      student_id: studentUuid,
      amount: Number(amount) || 0,
      payment_method: method || 'transferencia',
      receipt_number: receiptNumber || null,
      notes: notes || null
    });

    console.log(`[Supabase] Pago sincronizado para alumno ${studentCardId} ($${amount})`);
    return true;
  } catch (err) {
    console.warn('[Supabase] Error sincronizando pago remoto:', err.message);
    return false;
  }
}

/**
 * Consulta el historial de asistencia en Supabase
 */
export async function fetchRemoteAttendance() {
  try {
    const rows = await db.get('attendances', 'select=student_id,recorded_at,class_sessions(class_id,session_date)');
    if (!Array.isArray(rows)) return null;

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
  } catch (err) {
    console.warn('[Supabase] Error consultando historial de asistencia:', err.message);
    return null;
  }
}
