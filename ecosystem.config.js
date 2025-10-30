module.exports = {
  apps: [
    {
      name: "tailadmin",
      cwd: ".",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        // Tambahkan env lain yang dibutuhkan app Anda di sini
        // DATABASE_URL: ""
      },
      // Opsi log (opsional)
      // error_file: "./logs/tailadmin.err.log",
      // out_file: "./logs/tailadmin.out.log",
      // merge_logs: true,
    },
  ],
};