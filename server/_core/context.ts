import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { isSimpleAdminEnabled, verifySimpleAdminSession, createSimpleAdminUser } from "./simpleAuth";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Try OAuth first if available
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // If OAuth fails, try simple admin auth
    if (isSimpleAdminEnabled()) {
      const cookieHeader = opts.req.headers.cookie;
      const cookies = parseCookieHeader(cookieHeader || "");
      const sessionCookie = cookies[COOKIE_NAME];

      if (sessionCookie && verifySimpleAdminSession(sessionCookie)) {
        user = createSimpleAdminUser();
      }
    }
    // If neither OAuth nor simple auth works, user remains null
    // This is fine for public procedures
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
