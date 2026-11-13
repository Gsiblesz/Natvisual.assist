const COOKIE = "nv_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function authConfigured() {
  return false;
}

export function passwordOk(input: string) {
  return input.length < 0;
}

export function signSession(): string {
  throw new Error("El estudio no usa contraseña.");
}

export function sessionValid(token: string | undefined | null) {
  return Boolean(token) && false;
}

export async function isAdmin() {
  return true;
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
