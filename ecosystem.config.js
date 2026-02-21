// =============================================================================
// Tether — PM2 Ecosystem Config
// pm2 start ecosystem.config.js
// =============================================================================

module.exports = {
  apps: [
    {
      name:        'tether-backend',

      // Run uvicorn directly from the venv — no Python interpreter wrapper needed
      script:      '/var/www/tether/backend/venv/bin/uvicorn',
      args:        'server:app --host 127.0.0.1 --port 8010 --workers 2',
      cwd:         '/var/www/tether/backend',
      interpreter: 'none',      // PM2 must not wrap it with node/python

      // Environment
      env: {
        PATH:     '/var/www/tether/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      },

      // Restart behaviour
      autorestart:   true,
      watch:         false,      // Never watch files in prod
      max_restarts:  10,
      restart_delay: 3000,       // ms between restarts
      min_uptime:    '10s',      // Must stay up 10s to count as a successful start

      // Logging
      out_file:    '/var/log/tether/out.log',
      error_file:  '/var/log/tether/err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:  false,

      // Resource limits (optional, tune to your Lightsail tier)
      // max_memory_restart: '400M',
    },
  ],
};
