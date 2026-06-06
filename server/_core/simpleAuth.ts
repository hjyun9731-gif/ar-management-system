import type { Request, Response } from "express";
import { ENV } from "./env";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";

const SIMPLE_ADMIN_SESSION_PREFIX = "simple_admin_";
const SIMPLE_ADMIN_COOKIE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Simple admin authentication for internal management systems
 * Used when OAuth is not available
 */
export function createSimpleAdminSession(req: Request, res: Response): string {
  const sessionId = SIMPLE_ADMIN_SESSION_PREFIX + Date.now() + "_" + Math.random().toString(36).substring(7);
  const cookieOptions = getSessionCookieOptions(req);

  res.cookie(COOKIE_NAME, sessionId, {
    ...cookieOptions,
    maxAge: SIMPLE_ADMIN_COOKIE_EXPIRY_MS,
  });

  return sessionId;
}

/**
 * Verify simple admin session
 */
export function verifySimpleAdminSession(sessionCookie: string | undefined): boolean {
  if (!sessionCookie) return false;
  return sessionCookie.startsWith(SIMPLE_ADMIN_SESSION_PREFIX);
}

/**
 * Check if simple admin password is configured
 */
export function isSimpleAdminEnabled(): boolean {
  return !!ENV.simpleAdminPassword;
}

/**
 * Verify simple admin password
 */
export function verifySimpleAdminPassword(password: string): boolean {
  if (!ENV.simpleAdminPassword) return false;
  return password === ENV.simpleAdminPassword;
}

/**
 * Create a mock admin user for simple auth
 */
export function createSimpleAdminUser() {
  return {
    id: 1,
    openId: "simple_admin",
    name: "Administrator",
    email: "admin@internal",
    loginMethod: "simple_admin",
    role: "admin" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}
