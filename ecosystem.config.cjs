// PM2 process manager config — runs the API (Fastify + cron scheduler) and the
// Next.js web app together, auto-restarting on crash/reboot.
//   Start:   pm2 start ecosystem.config.cjs
//   Status:  pm2 status
//   Logs:    pm2 logs
//   Reload:  pm2 reload ecosystem.config.cjs   (after a deploy)
const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'pk-api',
      cwd: __dirname,
      script: 'npm',
      args: 'run start -w @pk/api',
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'pk-web',
      cwd: path.join(__dirname, 'apps/web'),
      script: 'npm',
      args: 'run start',
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: 'production' },
    },
  ],
};
