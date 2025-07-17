# Gitee 仓库创建和代码上传指南

## 步骤一：在 Gitee 上创建仓库

1. 访问 [Gitee](https://gitee.com) 并登录您的账户
2. 点击右上角的 "+" 按钮，选择 "新建仓库"
3. 填写仓库信息：
   - **仓库名称**: `jiandaoyun-mcp-server`
   - **仓库介绍**: `简道云MCP服务器 - 用于简道云表单数据操作的MCP协议服务`
   - **是否开源**: 选择 "公开" 或 "私有"（根据您的需求）
   - **初始化仓库**: 不要勾选任何初始化选项（因为本地已有代码）
4. 点击 "创建" 按钮

## 步骤二：本地 Git 初始化和推送

### 1. 打开命令行
在项目根目录 `d:\工作\2025\MCP学习\简道云MCP\jiandaoyun-mcp-server` 下打开 PowerShell 或命令提示符。

### 2. 初始化 Git 仓库（如果尚未初始化）
```bash
git init
```

### 3. 添加所有文件到暂存区
```bash
git add .
```

### 4. 创建首次提交
```bash
git commit -m "初始提交：简道云MCP服务器"
```

### 5. 添加 Gitee 远程仓库
将下面命令中的 `YOUR_USERNAME` 替换为您的 Gitee 用户名：
```bash
git remote add origin https://gitee.com/YOUR_USERNAME/jiandaoyun-mcp-server.git
```

### 6. 推送代码到 Gitee
```bash
git push -u origin master
```

## 步骤三：验证上传

1. 返回 Gitee 仓库页面
2. 刷新页面，确认所有文件已成功上传
3. 检查 README.md 文件是否正确显示

## 注意事项

- 确保 `.env` 文件不会被上传（已在 `.gitignore` 中配置）
- 如果遇到权限问题，可能需要配置 SSH 密钥或使用个人访问令牌
- 首次推送可能需要输入 Gitee 用户名和密码

## 后续更新代码

当您修改代码后，使用以下命令更新仓库：

```bash
# 添加修改的文件
git add .

# 提交修改
git commit -m "描述您的修改内容"

# 推送到远程仓库
git push
```

## 克隆仓库（其他人使用）

其他人可以使用以下命令克隆您的仓库：

```bash
git clone https://gitee.com/YOUR_USERNAME/jiandaoyun-mcp-server.git
```

---

如果在操作过程中遇到任何问题，请参考 [Gitee 帮助文档](https://help.gitee.com/) 或联系技术支持。