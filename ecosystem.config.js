module.exports = {
  apps: [{
    name: 'jiandaoyun-mcp',
    script: './build/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    env: {
      NODE_ENV: 'production',
      JIANDAOYUN_APP_ID: process.env.JIANDAOYUN_APP_ID,
      JIANDAOYUN_APP_KEY: process.env.JIANDAOYUN_APP_KEY,
      JIANDAOYUN_BASE_URL: process.env.JIANDAOYUN_BASE_URL || 'https://api.jiandaoyun.com'
    },
    // 生产环境高级配置
    env_production: {
      NODE_ENV: 'production',
      // 可以在这里覆盖环境变量
    },
    // 崩溃后重启延迟
    restart_delay: 4000,
    // 监听端口（如果服务需要）
    // port: 3000,
    // 优雅关闭超时
    kill_timeout: 5000,
    // 监控和健康检查
    min_uptime: '10s',
    max_restarts: 10,
    // 错误日志记录
    merge_logs: true,
    // CPU 和内存限制
    max_cpu_restart: '90%',
    // 进程名称
    name_prefix: 'prod',
  }]
};