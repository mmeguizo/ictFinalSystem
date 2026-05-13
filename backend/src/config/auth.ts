const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable must be set in production");
}

export const authConfig = {
  auth0: {
    domain: process.env.AUTH0_DOMAIN || "",
    audience: process.env.AUTH0_AUDIENCE || undefined,
  },
  jwt: {
    secret: jwtSecret || "dev-only-secret-do-not-use-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
};
