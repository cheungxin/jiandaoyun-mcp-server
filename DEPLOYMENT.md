# 简道云 MCP 服务部署指南

## 前置准备

### 1. 获取简道云 API 凭证
1. 登录[简道云管理后台](https://www.jiandaoyun.com)
2. 进入 **扩展功能** > **API**
3. 创建应用获取：
   - `App ID`：应用唯一标识
   - `API Key`：API密钥（请妥善保管）

### 2. 系统要求
- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器
- Claude Desktop 应用（用于MCP集成）

## 安装步骤

### 1. 克隆或下载项目
```bash
# 如果是 git 仓库
git clone <repository-url>
cd jiandaoyun-mcp-server

# 或者直接复制项目文件夹
```

### 2. 安装依赖
```bash
npm install
```

### 3. 构建项目
```bash
npm run build
```

## 配置方法

### 方法一：使用 Claude Desktop（推荐）

1. 找到 Claude Desktop 配置文件：
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. 编辑配置文件，添加简道云服务：

```json
{
  "mcpServers": {
    "jiandaoyun": {
      "command": "node",
      "args": ["D:\\工作\\2025\\MCP学习\\简道云MCP\\jiandaoyun-mcp-server\\build\\index.js"],
      "env": {
        "JIANDAOYUN_APP_ID": "你的应用ID",
        "JIANDAOYUN_APP_KEY": "你的API密钥"
      }
    }
  }
}
```

注意：将路径改为你的实际安装路径。

3. 重启 Claude Desktop 应用

### 方法二：命令行测试

```bash
# 设置环境变量
export JIANDAOYUN_APP_ID="你的应用ID"
export JIANDAOYUN_APP_KEY="你的API密钥"

# 运行服务
npm start
```

## 使用示例

### 在 Claude Desktop 中使用

1. **查询表单字段**
```
使用 get_form_fields 工具查看表单 5f3e4d2c1b0a9 的字段定义
```

2. **提交表单数据**
```
使用 submit_form_data 工具向表单 5f3e4d2c1b0a9 提交以下数据：
{
  "姓名": "张三",
  "年龄": 25,
  "部门": "技术部",
  "入职日期": "2024-01-15"
}
```

3. **查询数据**
```
使用 query_form_data 工具查询表单 5f3e4d2c1b0a9 中所有年龄大于20的员工
```

4. **更新数据**
```
使用 update_form_data 工具更新数据ID为 xxx 的记录，将部门改为"产品部"
```

### 高级查询示例

```
使用 query_form_data 查询满足以下条件的数据：
- 表单ID: 5f3e4d2c1b0a9
- 筛选条件：姓名包含"张"且年龄在20-30之间
- 返回前50条记录
```

## 常见问题

### 1. 如何获取表单ID？
- 在简道云表单编辑页面，URL中的 `formId` 参数
- 或在表单设置 > 获取表单ID

### 2. 如何知道字段的 widget ID？
- 使用 `get_form_fields` 工具查询表单，会返回所有字段的ID
- 字段ID格式通常为 `_widget_xxxxxxxxxxxx`

### 3. 批量操作限制
- 批量提交：最多100条
- 批量删除：最多100条
- 查询返回：最多100条（可分页）

### 4. 文件上传流程
1. 先调用 `get_upload_token` 获取上传凭证
2. 使用返回的凭证上传文件到指定地址
3. 在提交数据时使用文件信息

## 调试技巧

### 1. 查看日志
服务启动后会在控制台输出日志，可以查看：
- API 请求详情
- 错误信息
- 数据转换过程

### 2. 测试单个功能
```bash
# 开发模式运行（支持热重载）
npm run dev
```

### 3. 检查配置
确保环境变量正确设置：
```bash
echo $JIANDAOYUN_APP_ID
echo $JIANDAOYUN_APP_KEY
```

## 安全建议

1. **不要将 API Key 提交到代码仓库**
2. **使用环境变量或配置文件管理凭证**
3. **定期轮换 API Key**
4. **限制 API 权限到最小必需范围**

## 故障排除

### 错误：Missing required environment variables
- 检查是否正确设置了 `JIANDAOYUN_APP_ID` 和 `JIANDAOYUN_APP_KEY`

### 错误：Failed to get form fields
- 检查表单ID是否正确
- 确认API凭证有该表单的访问权限

### 错误：Tool execution failed
- 查看具体错误信息
- 检查数据格式是否符合要求
- 确认网络连接正常

## 扩展开发

如需自定义功能：

1. 修改 `src/` 目录下的源代码
2. 重新构建：`npm run build`
3. 重启 Claude Desktop

## 技术支持

- 简道云API文档：https://hc.jiandaoyun.com/open/
- MCP协议文档：https://modelcontextprotocol.io/
- 问题反馈：[创建 Issue]