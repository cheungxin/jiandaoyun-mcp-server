# 部署前检查清单

## 环境准备

### 1. 系统要求
- [ ] Node.js 18.0+ 已安装
- [ ] npm 或 yarn 包管理器可用
- [ ] 服务器具有外网访问权限（访问简道云API）

### 2. 项目文件
- [ ] 已删除所有测试文件（test-*.cjs, debug-*.cjs, demo-*.cjs）
- [ ] 确保 build 目录存在且包含编译后的文件
- [ ] .env 文件已配置（不要提交到版本控制）
- [ ] .gitignore 文件已更新

### 3. 安全配置
- [ ] API密钥已从环境变量或配置文件加载
- [ ] 敏感信息未硬编码在代码中
- [ ] .env 文件权限设置正确（仅限当前用户读取）

## 部署步骤

### 1. 安装依赖
```bash
npm install --production
```

### 2. 构建项目（如果build目录不存在）
```bash
npm run build
```

### 3. 设置环境变量
```bash
# Linux/Mac
export JIANDAOYUN_APP_ID="your_app_id"
export JIANDAOYUN_APP_KEY="your_api_key"

# Windows
set JIANDAOYUN_APP_ID=your_app_id
set JIANDAOYUN_APP_KEY=your_api_key

# 或使用 .env 文件
cp .env.example .env
# 编辑 .env 文件填入真实的凭证
```

### 4. 启动服务

#### 方式一：直接运行
```bash
npm start
```

#### 方式二：使用启动脚本
```bash
# Linux/Mac
chmod +x start.sh
./start.sh

# Windows
start.bat
```

#### 方式三：使用进程管理器（推荐生产环境）
```bash
# 使用 PM2
npm install -g pm2
pm2 start build/index.js --name jiandaoyun-mcp

# 使用 systemd (Linux)
# 创建 /etc/systemd/system/jiandaoyun-mcp.service 文件
```

## 生产环境部署建议

### 1. 进程管理
使用 PM2 进行进程管理：

```bash
# 安装 PM2
npm install -g pm2

# 创建 ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'jiandaoyun-mcp',
    script: './build/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      JIANDAOYUN_APP_ID: process.env.JIANDAOYUN_APP_ID,
      JIANDAOYUN_APP_KEY: process.env.JIANDAOYUN_APP_KEY
    }
  }]
};
EOF

# 启动服务
pm2 start ecosystem.config.js

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
```

### 2. 日志管理
```bash
# 查看日志
pm2 logs jiandaoyun-mcp

# 日志轮转
pm2 install pm2-logrotate
```

### 3. 监控和告警
- 设置健康检查端点
- 配置错误监控（如 Sentry）
- 设置资源使用告警

### 4. 安全加固
- 使用 HTTPS 代理（如果需要）
- 限制 API 请求频率
- 设置防火墙规则

## 故障排查

### 常见问题

1. **缺少环境变量**
   - 错误信息：`Missing required environment variables: JIANDAOYUN_APP_KEY`
   - 解决方法：确保设置了正确的环境变量

2. **网络连接失败**
   - 错误信息：`ECONNREFUSED` 或 `ETIMEDOUT`
   - 解决方法：检查服务器网络设置，确保可以访问 api.jiandaoyun.com

3. **权限错误**
   - 错误信息：`403 Forbidden`
   - 解决方法：检查 API 密钥是否正确，应用是否有相应权限

4. **内存不足**
   - 错误信息：`JavaScript heap out of memory`
   - 解决方法：增加 Node.js 内存限制
   ```bash
   node --max-old-space-size=4096 build/index.js
   ```

## 性能优化建议

1. **启用生产模式**
   ```bash
   export NODE_ENV=production
   ```

2. **调整超时设置**
   - 根据实际网络情况调整 axios 超时时间
   - 考虑实现连接池

3. **批量处理优化**
   - 合理使用批量提交功能
   - 注意 100 条记录的限制

## 备份和恢复

1. **配置备份**
   - 定期备份 .env 文件
   - 保存 API 凭证到安全的密钥管理系统

2. **服务恢复**
   ```bash
   # 恢复 PM2 进程
   pm2 resurrect
   ```

## 更新和维护

1. **更新依赖**
   ```bash
   npm update
   npm audit fix
   ```

2. **重新构建**
   ```bash
   npm run build
   pm2 restart jiandaoyun-mcp
   ```

## 联系支持

- 简道云API文档：https://hc.jiandaoyun.com/open/
- MCP协议文档：https://modelcontextprotocol.io/
- 问题反馈：在项目仓库创建 Issue