#!/usr/bin/env node
// Reinicia la contraseña de una cuenta (alumno por teléfono, o equipo por correo).
// Pone una contraseña temporal y, al entrar con ella, la app pide crear una nueva.
//
// Uso (desde la raíz del repo, con Node 18 o superior):
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/reiniciar-contrasena.mjs 55551234
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/reiniciar-contrasena.mjs maestra@correo.com
//
// La clave service_role está en Supabase > Project Settings > API. Da acceso total a la base:
// úsala solo en esta computadora, nunca la pongas en la app ni la subas a git.
// La contraseña temporal solo se muestra en pantalla; no se guarda en ningún archivo.

import { randomInt } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qwjlixqtbcchyiwynfmv.supabase.co';
// Mismo formato que loginIdToEmail en academia/assets/js/supabase.js.
const PHONE_LOGIN_DOMAIN = 'tel.inmotion.invalid';

const [loginId] = process.argv.slice(2);
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!loginId) {
  console.error('Falta el teléfono o correo. Uso: node scripts/reiniciar-contrasena.mjs 55551234');
  process.exit(1);
}
if (!KEY || KEY.startsWith('sb_publishable_')) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY (la clave service_role o secret, no la publishable).');
  process.exit(1);
}

function loginIdToEmail(value) {
  value = String(value || '').trim();
  if (value.includes('@')) return value.toLowerCase();
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('502')) digits = digits.slice(3);
  if (digits.length !== 8) return null;
  return `502${digits}@${PHONE_LOGIN_DOMAIN}`;
}

// Sin 0/O ni 1/l/I para que se pueda dictar por teléfono sin confusiones.
function temporaryPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.msg || data?.message || data?.error_description || text || `HTTP ${res.status}`);
  return data;
}

async function findAuthUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const data = await api(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    const users = data?.users || [];
    const found = users.find((u) => u.email === email);
    if (found || users.length < 1000) return found || null;
  }
  return null;
}

const email = loginIdToEmail(loginId);
if (!email) {
  console.error(`«${loginId}» no parece un teléfono de 8 dígitos ni un correo.`);
  process.exit(1);
}

const user = await findAuthUserByEmail(email);
if (!user) {
  console.error(`No hay ninguna cuenta con ${email.endsWith(PHONE_LOGIN_DOMAIN) ? 'ese teléfono' : 'ese correo'}.`);
  process.exit(1);
}

const password = temporaryPassword();
// password_changed_at en null hace que la app pida crear una contraseña nueva al entrar.
await api(`/auth/v1/admin/users/${user.id}`, {
  method: 'PUT',
  body: { password, user_metadata: { password_changed_at: null } }
});

const name = [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ');
console.log(`Contraseña reiniciada${name ? ` para ${name}` : ''} (${loginId}).`);
console.log(`Contraseña temporal: ${password}`);
console.log('Al entrar con ella, la app le pedirá crear una contraseña nueva.');
