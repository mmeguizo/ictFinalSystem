export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  isDevelopment: process.env.NODE_ENV !== "production",
  isProduction: process.env.NODE_ENV === "production",

  cors: {
    origins: [
      "http://localhost:4000",
      "https://studio.apollographql.com",
      "http://localhost:4200",
      "https://localhost:4200",
      "http://localhost:4201",
      "https://localhost:4201",
      "http://10.100.168.9:4200",
      "https://10.100.168.9:4200",
      "http://10.100.168.9:4201",
      "https://10.100.168.9:4201",
      "http://10.100.168.9:4201",
      "https://10.100.168.9:55001",
    ],
    credentials: true,
  },

  // cors: {
  //   origins: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:4200'],
  // },

  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:4000",

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  },
};
