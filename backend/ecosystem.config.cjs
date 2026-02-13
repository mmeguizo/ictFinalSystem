module.exports = {
  apps: [
    {
      name: "ICT TICKET BACKEND",
      script: "cmd.exe",
      args: "/c npm run dev",
      // cwd: "C:/Users/Mark Oliver/Desktop/SUPPLY WEB APP/app",
      cwd: "C:/Users/Mark Oliver/Desktop/ICT SUPPORT TICKET/ictsystem/backend",
      env: {
        NODE_ENV: "development"
      }
    }
  ]
}