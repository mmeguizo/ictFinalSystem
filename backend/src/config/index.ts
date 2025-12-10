export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
  



  cors: {
    origins: [
  "http://localhost:4000",
  'https://studio.apollographql.com',  
  'http://localhost:4200',
  ],
    credentials: true,
  },

  // cors: {
  //   origins: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:4200'],
  // },
  
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:4000',
};
