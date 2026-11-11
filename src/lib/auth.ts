import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "nv_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function configuredPassword() {
  const value = process.env.STUDIO_PASSWORD?.trim();
  return value || null;
}

export function authConfigured() {
  return configuredPassword() !== null;
}

export function passwordOk(input: string) {
  const expectedRaw = configuredPassword();
  if (!expectedRaw || !input) return false;
  const expected = Buffer.from(expectedRaw);
  const given = Buffer.from(input);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

function signingKey() {
  const value = configuredPassword();
  if (!value) throw new Error("Falta STUDIO_PASSWORD");
  return value;
}

export function signSession() {
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", exp: Date.now() + THIRTY_DAYS * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function sessionValid(token: string | undefined | null) {
  if (!authConfigured() || !token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      role?: string;
      exp?: number;
    };
    return data.role === "admin" && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function isAdmin() {
  if (!authConfigured()) return true;
  const jar = await cookies();
  return sessionValid(jar.get(COOKIE)?.value);
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
