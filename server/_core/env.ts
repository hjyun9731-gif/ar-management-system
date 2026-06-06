export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  simpleAdminPassword: process.env.SIMPLE_ADMIN_PASSWORD ?? "",
};

// Warn if OAuth is not configured in production
if (ENV.isProduction && !ENV.oAuthServerUrl) {
  console.warn(
    "[WARNING] OAUTH_SERVER_URL is not configured. Using simple admin password authentication. " +
      "Set SIMPLE_ADMIN_PASSWORD environment variable for access control."
  );
}

// Warn if simple admin password is not set in production
if (ENV.isProduction && !ENV.simpleAdminPassword) {
  console.warn(
    "[WARNING] SIMPLE_ADMIN_PASSWORD is not configured in production. " +
      "System will be accessible without authentication. Set SIMPLE_ADMIN_PASSWORD for security."
  );
}
