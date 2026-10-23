#!/usr/bin/env node
// Crea en Supabase las cuentas de los alumnos a partir de un CSV.
// Cada alumno entra a la app con su teléfono y la contraseña inicial que genera este script.
//
// Uso (desde la raíz del repo, con Node 18 o superior):
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/crear-cuentas.mjs cuentas/alumnos-activos.csv          (prueba, no crea nada)
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/crear-cuentas.mjs cuentas/alumnos-activos.csv --crear  (crea las cuentas)
//
// La clave service_role está en Supabase > Project Settings > API. Da acceso total a la base:
// úsala solo en esta computadora, nunca la pongas en la app ni la subas a git.
// Requiere la migración docs/migrations/005_service_role_account_import.sql.
//
// CSV de entrada (con encabezado): nombre,apellido,telefono,nivel,notas
// Escribe <entrada>-resultado.csv con la contraseña inicial y el carné de cada alumno.
// Ese archivo tiene contraseñas: entrégalo a recepción y no lo subas a git.
// Volver a correrlo es seguro: salta los teléfonos que ya tienen cuenta.

import { readFileSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qwjlixqtbcchyiwynfmv.supabase.co';
// Mismo formato que loginIdToEmail en academia/assets/js/supabase.js.
const PHONE_LOGIN_DOMAIN = 'tel.inmotion.invalid';

const [inputPath, ...flags] = process.argv.slice(2);
const CREATE = flags.includes('--crear');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!inputPath) {
  console.error('Falta el CSV. Uso: node scripts/crear-cuentas.mjs cuentas/alumnos-activos.csv [--crear]');
  process.exit(1);
}
if (!KEY || KEY.startsWith('sb_publishable_')) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY (la clave service_role o secret, no la publishable).');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  const [header, ...data] = rows;
  const keys = header.map((h) => h.trim().replace(/^﻿/, '').toLowerCase());
  return data.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] || '').trim()])));
}

const csvCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;

function phoneDigits(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('502')) digits = digits.slice(3);
  return digits.length === 8 ? digits : null;
}

// Sin 0/O ni 1/l/I para que se pueda dictar por teléfono sin confusiones.
function initialPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

async function api(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.msg || data?.message || data?.error_description || text || `HTTP ${res.status}`);
  return data;
}

// La base real puede ir atrasada respecto a docs/supabase-schema.sql. Si a profiles le falta
// una columna opcional, se quita del insert y su valor se guarda en notes para no perderlo.
const OPTIONAL_PROFILE_COLUMNS = ['level', 'phone', 'notes'];
const missingProfileColumns = new Set();

async function insertProfile(row) {
  for (;;) {
    const body = { ...row };
    const extra = [];
    for (const col of missingProfileColumns) {
      if (body[col]) extra.push(`${col === 'level' ? 'Nivel' : col === 'phone' ? 'Teléfono' : 'Nota'}: ${body[col]}`);
      delete body[col];
    }
    if (extra.length && !missingProfileColumns.has('notes')) body.notes = [row.notes, ...extra.filter((e) => !e.startsWith('Nota'))].filter(Boolean).join(' · ');
    try {
      const [profile] = await api('/rest/v1/profiles', { method: 'POST', prefer: 'return=representation', body });
      return profile;
    } catch (err) {
      const col = /Could not find the '(\w+)' column of 'profiles'/.exec(err.message)?.[1];
      if (!col || !OPTIONAL_PROFILE_COLUMNS.includes(col) || missingProfileColumns.has(col)) throw err;
      missingProfileColumns.add(col);
      console.log(`Aviso: la tabla profiles no tiene la columna «${col}»; se guarda en notas.`);
    }
  }
}

// Una corrida anterior pudo dejar el usuario de Auth creado sin perfil: se reutiliza.
async function findAuthUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const data = await api(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    const users = data?.users || [];
    const found = users.find((u) => u.email === email);
    if (found || users.length < 1000) return found || null;
  }
  return null;
}

const students = parseCsv(readFileSync(inputPath, 'utf8'));
const existingProfiles = await api('/rest/v1/profiles?select=id,user_id,phone,role');
const takenPhones = new Set(existingProfiles.filter((p) => p.user_id).map((p) => phoneDigits(p.phone)).filter(Boolean));
const cards = await api('/rest/v1/cards?select=card_number');
let nextCard = Math.max(0, ...cards.map((c) => Number(/^IM-(\d+)$/.exec(c.card_number)?.[1] || 0))) + 1;

console.log(`${students.length} alumnos en el CSV · ${takenPhones.size} teléfonos ya tienen cuenta · ${CREATE ? 'CREANDO CUENTAS' : 'modo prueba (agrega --crear para crearlas)'}\n`);

const results = [];
const seen = new Set();
for (const s of students) {
  const fullName = `${s.nombre} ${s.apellido}`.trim();
  const digits = phoneDigits(s.telefono);
  const base = { nombre: fullName, telefono: s.telefono, contrasena: '', carne: '' };
  if (!s.nombre) { results.push({ ...base, estado: 'Saltado: sin nombre' }); continue; }
  if (!digits) { results.push({ ...base, estado: 'Saltado: teléfono inválido' }); continue; }
  if (seen.has(digits)) { results.push({ ...base, estado: 'Saltado: teléfono repetido en el CSV' }); continue; }
  seen.add(digits);
  if (takenPhones.has(digits)) { results.push({ ...base, estado: 'Ya tenía cuenta' }); continue; }

  const cardNumber = `IM-${String(nextCard++).padStart(4, '0')}`;
  const password = initialPassword();
  if (!CREATE) { results.push({ ...base, carne: cardNumber, estado: 'Se crearía' }); continue; }

  let userId = null;
  const email = `502${digits}@${PHONE_LOGIN_DOMAIN}`;
  try {
    const userBody = { email, password, email_confirm: true, user_metadata: { first_name: s.nombre, last_name: s.apellido, phone: s.telefono } };
    try {
      userId = (await api('/auth/v1/admin/users', { method: 'POST', body: userBody })).id;
    } catch (err) {
      if (!/already (been )?registered|already exists/i.test(err.message)) throw err;
      const existing = await findAuthUserByEmail(email);
      if (!existing) throw err;
      await api(`/auth/v1/admin/users/${existing.id}`, { method: 'PUT', body: { password } });
      userId = existing.id;
    }
    const profile = await insertProfile({ user_id: userId, role: 'student', first_name: s.nombre, last_name: s.apellido || '', phone: s.telefono, level: s.nivel || null, notes: s.notas || null });
    await api('/rest/v1/cards', {
      method: 'POST',
      body: { student_id: profile.id, card_number: cardNumber, qr_code: cardNumber, is_active: true }
    });
    results.push({ ...base, contrasena: password, carne: cardNumber, estado: 'Creada' });
  } catch (err) {
    // Sin perfil la cuenta no sirve: se borra para poder reintentar limpio.
    if (userId) await api(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' }).catch(() => {});
    results.push({ ...base, estado: `Error: ${err.message}` });
  }
}

const outPath = inputPath.replace(/\.csv$/i, '') + '-resultado.csv';
writeFileSync(outPath, '﻿' + ['Nombre,Teléfono,Contraseña inicial,Carné,Estado', ...results.map((r) => [r.nombre, r.telefono, r.contrasena, r.carne, r.estado].map(csvCell).join(','))].join('\n'));

const tally = results.reduce((acc, r) => ((acc[r.estado.split(':')[0]] = (acc[r.estado.split(':')[0]] || 0) + 1), acc), {});
console.log(Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join(' · '));
results.filter((r) => /^(Error|Saltado)/.test(r.estado)).forEach((r) => console.log(`  ${r.nombre} (${r.telefono}) → ${r.estado}`));
console.log(`\nResultado en ${outPath}${CREATE ? ' (tiene contraseñas: no lo subas a git)' : ''}`);
