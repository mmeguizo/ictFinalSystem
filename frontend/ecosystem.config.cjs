// module.exports = {
//   apps: [
//     {
//       name: "Angular-Client",
//       script: "npm.cmd",      // Windows specific
//       args: "start",          // Runs 'ng serve'
//       interpreter: "none",    // <--- IMPORTANT: Tells PM2 this is NOT a JS file
//       watch: false,
//       env: {
//         NODE_ENV: "development"
//       }
//     }
//   ]
// };

module.exports = {
  apps: [
    {
      name: "ICT TICKET FRONTEND",
      script: "cmd.exe",
      args: "/c npm run start",
      // cwd: "C:/Users/Mark Oliver/Desktop/SUPPLY WEB APP/app",
      cwd: "C:/Users/Mark Oliver/Desktop/ICT SUPPORT TICKET/ictsystem/frontend",
      env: {
        NODE_ENV: "development"
      }
    }
  ]
}
