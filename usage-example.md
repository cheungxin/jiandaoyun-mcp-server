# 简道云MCP服务器使用示例

## 修复说明

经过分析和修复，简道云MCP服务器现在能够正确处理数据提交。主要修复内容：

### 1. 数据格式化问题修复

**问题**: `formatDataForSubmission` 方法没有正确处理所有字段的格式化

**修复**: 重构了数据格式化逻辑，确保所有字段都被正确包装为 `{"value": ...}` 格式

**修复前的问题**:
```javascript
// 只处理特定前缀的字段
if (key.startsWith('_widget_') || key.startsWith('_id')) {
  // 处理逻辑
}
```

**修复后的逻辑**:
```javascript
// 处理所有字段，按类型分类处理
// 1. 已格式化的数据直接使用
// 2. 子表单数组递归处理
// 3. 复杂对象包装
// 4. 基本类型包装
```

### 2. 正确的数据格式

根据简道云API文档，数据提交格式应该严格遵循：

```json
{
  "app_id": "应用ID",
  "entry_id": "表单ID", 
  "data": {
    "_widget_1752198874727": {
      "value": "张鑫"
    },
    "_widget_1432728651403": {
      "value": 100
    },
    "_widget_1432728651406": {
      "value": ["选项一", "选项二"]
    },
    "_widget_1432728651412": {
      "value": {
        "province": "江苏省",
        "city": "无锡市",
        "district": "梁溪区",
        "detail": "清扬路138号茂业天地"
      }
    }
  }
}
```

## 使用示例

### 1. 基本数据提交

```javascript
// 使用MCP工具提交数据
const result = await submitFormData({
  appId: "你的应用ID",
  appKey: "你的API密钥",
  formId: "你的表单ID",
  data: {
    "姓名": "张鑫",
    "年龄": 25,
    "城市": "北京"
  },
  autoMatch: true  // 启用智能字段映射
});
```

### 2. 复杂数据类型提交

```javascript
const complexData = {
  "姓名": "张鑫",
  "数字字段": 100,
  "单选": "选项一",
  "多选": ["选项一", "选项二", "选项三"],
  "日期时间": "2018-01-01T10:10:10.000Z",
  "地址": {
    "province": "江苏省",
    "city": "无锡市",
    "district": "梁溪区",
    "detail": "清扬路138号茂业天地"
  },
  "定位": {
    "province": "江苏省",
    "city": "无锡市",
    "district": "梁溪区",
    "detail": "清扬路138号茂业天地",
    "lnglatXY": [120.31237, 31.49099]
  },
  "手机": {
    "phone": "15852540044"
  },
  "附件": ["6b559cf1-b16c-43bd-a211-8fa8fdeae2ef"],
  "图片": ["6b559cf1-b16c-43bd-a211-74389cd8ae76"]
};

const result = await submitFormData({
  appId: "你的应用ID",
  appKey: "你的API密钥",
  formId: "你的表单ID",
  data: complexData,
  autoMatch: true
});
```

### 3. 批量数据提交

```javascript
const batchData = [
  { "姓名": "张鑫", "年龄": 25 },
  { "姓名": "李四", "年龄": 30 },
  { "姓名": "王五", "年龄": 28 }
];

const result = await submitFormData({
  appId: "你的应用ID",
  appKey: "你的API密钥",
  formId: "你的表单ID",
  data: batchData,
  autoMatch: true
});
```

### 4. 直接使用字段ID提交（跳过智能映射）

```javascript
const directData = {
  "_widget_1752198874727": "张鑫",
  "_widget_1432728651403": 100
};

const result = await submitFormData({
  appId: "你的应用ID",
  appKey: "你的API密钥",
  formId: "你的表单ID",
  data: directData,
  autoMatch: false  // 禁用智能字段映射
});
```

## 智能字段映射功能

### 映射策略

1. **精确匹配**: 字段标签完全匹配
2. **包含匹配**: 字段标签包含用户输入的关键词
3. **名称匹配**: 字段名称匹配
4. **常见字段映射**: 预定义的常见字段名映射

### 常见字段映射表

| 用户输入 | 可能匹配的字段 |
|---------|---------------|
| 姓名 | name, username, 用户名, 姓名 |
| 电话 | phone, tel, mobile, 手机, 电话 |
| 邮箱 | email, mail, 邮件, 邮箱 |
| 地址 | address, 地址, 住址 |
| 备注 | remark, note, comment, 备注, 说明 |

## 错误处理

修复后的服务器提供了更好的错误处理：

- **权限错误**: 检查API密钥权限
- **表单不存在**: 验证表单ID正确性
- **字段映射失败**: 提供详细的映射信息
- **数据格式错误**: 自动格式化数据

## 测试验证

可以使用 `test-format.cjs` 脚本验证数据格式化逻辑：

```bash
node test-format.cjs
```

所有测试用例都应该显示 ✅ 通过。

## 总结

经过修复，简道云MCP服务器现在能够：

1. ✅ 正确格式化所有类型的数据
2. ✅ 智能映射用户友好的字段名到后台字段ID
3. ✅ 处理复杂数据类型（地址、定位、子表单等）
4. ✅ 支持批量数据提交
5. ✅ 提供详细的错误信息和调试信息
6. ✅ 完全符合简道云API规范

现在可以放心使用该MCP服务器进行简道云表单数据的提交操作。