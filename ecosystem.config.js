module.exports = {
  apps: [
    {
      name: 'carter-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
        SLOW_ENDPOINT_MS: 250,
        SPAREPART_BATCH_DEBUG: 'true',
        TRANSFER_DEBUG: 'true'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5000,
        SLOW_ENDPOINT_MS: 250,
        SPAREPART_BATCH_DEBUG: 'false',
        TRANSFER_DEBUG: 'false'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        SLOW_ENDPOINT_MS: 250,
        SPAREPART_BATCH_DEBUG: 'false',
        TRANSFER_DEBUG: 'false'
      }
    }
  ]
};
