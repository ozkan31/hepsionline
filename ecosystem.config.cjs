module.exports = {
  apps: [
    {
      name: "app-api",
      script: "server/index.mjs",
      cwd: __dirname,
      exec_mode: "cluster",
      instances: Number(process.env.PM2_INSTANCES || 4),
      instance_var: "NODE_APP_INSTANCE",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "500M",
      kill_timeout: 5000,
      listen_timeout: 10000,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
