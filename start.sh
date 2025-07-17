#!/bin/bash

# 简道云 MCP 服务快速启动脚本

# 检查环境变量
if [ -z "$JIANDAOYUN_APP_ID" ] || [ -z "$JIANDAOYUN_APP_KEY" ]; then
    echo "错误：请先设置环境变量 JIANDAOYUN_APP_ID 和 JIANDAOYUN_APP_KEY"
    echo ""
    echo "使用方法："
    echo "export JIANDAOYUN_APP_ID='你的应用ID'"
    echo "export JIANDAOYUN_APP_KEY='你的API密钥'"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误：未找到 Node.js，请先安装 Node.js 18.0 或更高版本"
    exit 1
fi

# 检查是否已构建
if [ ! -d "build" ]; then
    echo "首次运行，正在安装依赖..."
    npm install
    
    echo "正在构建项目..."
    npm run build
fi

echo "启动简道云 MCP 服务..."
echo "App ID: $JIANDAOYUN_APP_ID"
echo "API Key: ${JIANDAOYUN_APP_KEY:0:6}****"
echo ""

npm start