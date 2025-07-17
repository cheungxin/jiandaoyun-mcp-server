@echo off
REM 简道云 MCP 服务快速启动脚本 (Windows)

REM 检查环境变量
if "%JIANDAOYUN_APP_ID%"=="" (
    echo 错误：请先设置环境变量 JIANDAOYUN_APP_ID
    echo.
    echo 使用方法：
    echo set JIANDAOYUN_APP_ID=你的应用ID
    echo set JIANDAOYUN_APP_KEY=你的API密钥
    exit /b 1
)

if "%JIANDAOYUN_APP_KEY%"=="" (
    echo 错误：请先设置环境变量 JIANDAOYUN_APP_KEY
    echo.
    echo 使用方法：
    echo set JIANDAOYUN_APP_ID=你的应用ID
    echo set JIANDAOYUN_APP_KEY=你的API密钥
    exit /b 1
)

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误：未找到 Node.js，请先安装 Node.js 18.0 或更高版本
    exit /b 1
)

REM 检查是否已构建
if not exist "build" (
    echo 首次运行，正在安装依赖...
    call npm install
    
    echo 正在构建项目...
    call npm run build
)

echo 启动简道云 MCP 服务...
echo App ID: %JIANDAOYUN_APP_ID%
echo API Key: %JIANDAOYUN_APP_KEY:~0,6%****
echo.

npm start