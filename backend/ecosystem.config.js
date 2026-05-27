// PM2 Ecosystem config for production
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: "customs-api-hub",
      script: "dist/app.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "../logs/err.log",
      out_file: "../logs/out.log",
      log_file: "../logs/combined.log",
      time: true,
    },
  ],
};
