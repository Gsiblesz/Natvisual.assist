import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "nv_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

// La clave del estudio solo entra por la variable de entorno ESTUDIO_CLAVE.
// Sin esa variable el estudio queda abierto, a propósito.
function clave() {
  return process.env.ESTUDIO_CLAVE?.trim() ?? "";
}

function huella(texto: string) {
  return createHash("sha256").update(texto).digest();
}

function firma(vence: string) {
  return createHmac("sha256", huella(`nv-sesion:${clave()}`)).update(vence).digest("hex");
}

export function authConfigured() {
  return clave() !== "";
}

export function passwordOk(input: string) {
  if (!authConfigured()) return false;
  return timingSafeEqual(huella(input.trim()), huella(clave()));
}

export function signSession(): string {
  if (!authConfigured()) throw new Error("El estudio no usa contraseña.");
  const vence = String(Date.now() + THIRTY_DAYS * 1000);
  return `${vence}.${firma(vence)}`;
}

export function sessionValid(token: string | undefined | null) {
  if (!token || !authConfigured()) return false;
  const [vence, sello] = token.split(".");
  if (!vence || !sello || !/^\d+$/.test(vence) || Number(vence) < Date.now()) return false;
  const esperado = Buffer.from(firma(vence));
  const recibido = Buffer.from(sello);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

export async function isAdmin() {
  if (!authConfigured()) return true;
  return sessionValid((await cookies()).get(COOKIE)?.value);
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: THIRTY_DAYS,
    },
  };
}

export const clearedSessionCookie = {
  name: COOKIE,
  value: "",
  options: { httpOnly: true, path: "/", maxAge: 0 },
};
