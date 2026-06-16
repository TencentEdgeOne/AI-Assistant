# 为任何网站添加 AI 对话助手

本文介绍如何使用 EdgeOne Makers 的 **SiteAgent** 模板，为你的网站添加一个 AI 对话助手。只需一行代码嵌入，AI 就能自动理解页面内容、查询你的业务 API，实时回答用户问题。

**你将获得：**

- 一个开箱即用的 AI 对话 Widget（气泡 + 聊天面板）
- 自动提取当前页面内容作为 AI 上下文
- 通过 API Schema 让 AI 实时查询你的后端数据
- 支持嵌入到任何网站（博客、电商、文档站、管理后台等）

---

## 效果预览

用户在你的网站上看到一个聊天气泡，点击后打开对话面板：

- 问"这篇文章讲了什么？"→ AI 根据页面内容回答
- 问"帮我搜索 React 相关文章"→ AI 调用你的搜索接口，返回真实数据
- 问"第 3 篇文章的详细内容"→ AI 调用详情接口获取全文

---

## 前置条件

1. 一个 [EdgeOne Makers](https://edgeone.ai/makers) 账号
2. 你的网站（任何框架：React、Vue、WordPress、静态 HTML 等）
3. （可选）你的后端 API 地址，如果需要 AI 查询业务数据

---

## 快速开始

### 1、一键部署 Agent

点击下方按钮，将 SiteAgent 模板部署到 EdgeOne Makers：

[![部署到 EdgeOne Makers](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/makers/new?template=site-agent&from=within&fromAgent=1&agentLang=typescript)

部署完成后，你会获得一个项目地址，例如：`https://your-project.edgeone.app`

### 2、绑定自定义域名

进入 EdgeOne Makers 控制台 → 你的项目 → **设置** → **域名**，绑定你自己的域名，例如：`chat.example.com`

> **提示：** 绑定自定义域名后无需任何鉴权即可访问，这是正式使用的前提条件。

### 3、配置环境变量

进入项目 → **设置** → **环境变量**，填写以下必填项：

| 变量 | 说明 |
|------|------|
| `AI_GATEWAY_API_KEY` | AI 模型的 API Key |
| `AI_GATEWAY_BASE_URL` | 模型网关地址，Makers 内置模型填 `https://ai-gateway.edgeone.link/v1` |

> **提示：** 如果你使用 Makers 内置模型，`AI_GATEWAY_API_KEY` 可在 Makers 控制台的 Models 页面获取。

### 4、嵌入到你的网站

在你网站的 HTML 中，`</body>` 之前添加一行代码：

```html
<script src="https://chat.example.com/embed.js" async></script>
```

刷新页面，右下角出现聊天气泡，点击即可对话。**完成！**

---

## 让 AI 查询你的业务 API

默认情况下，AI 只能根据当前页面内容回答问题。如果你希望 AI 能实时查询你的后端数据（如搜索文章、查询订单、获取商品信息），需要告诉 AI 你有哪些接口。

### 1、编写 API Schema

在 Agent 项目根目录创建一个 `api-schema.json` 文件，描述你的后端接口：

```json
{
  "tools": [
    {
      "name": "search_products",
      "description": "Search products by keyword. Returns product name, price, and stock status.",
      "endpoint": "GET /api/products",
      "parameters": {
        "q": { "type": "string", "description": "Search keyword" },
        "category": { "type": "string", "description": "Filter by category" }
      }
    },
    {
      "name": "get_product",
      "description": "Get full details of a product by ID. Use search_products first if you don't know the ID.",
      "endpoint": "GET /api/products/{id}",
      "parameters": {
        "id": { "type": "string", "description": "Product ID", "required": true }
      }
    }
  ]
}
```

**字段说明：**

- `name`：工具名称，英文 + 下划线
- `description`：告诉 AI 这个接口是干什么的，**写得越清楚 AI 越准确**
- `endpoint`：HTTP 方法 + 路径，路径中 `{param}` 会被参数值替换
- `parameters`：参数定义，`required: true` 表示必填

### 2、配置后端地址

在环境变量中添加：

| 变量 | 说明 |
|------|------|
| `DATA_API_BASE_URL` | 你的后端 API 根地址，如 `https://api.example.com` |
| `DATA_API_KEY` | （可选）后端认证 Token |

### 3、确保后端允许跨域

Agent 会从 EdgeOne 域名向你的后端发起请求，你需要在后端设置 CORS：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

配置完成后重新部署，AI 就能在对话中实时调用你的接口了。

---

## 自定义外观

通过 `data-*` 属性自定义聊天气泡的外观：

```html
<script
  src="https://chat.example.com/embed.js"
  data-color="#10b981"
  data-position="bottom-left"
  data-name="小助手"
  async>
</script>
```

| 属性 | 默认值 | 说明 |
|------|--------|------|
| `data-color` | `#6366f1` | 主题色（气泡、按钮、头像背景） |
| `data-position` | `bottom-right` | 气泡位置：`bottom-right` 或 `bottom-left` |
| `data-name` | `AI Assistant` / `AI 助手` | 聊天面板顶部显示的名称 |

---

## 自定义系统提示词

通过 `SYSTEM_PROMPT` 环境变量，你可以定制 AI 的行为风格：

```
你是一个专业的电商客服助手。回答要简洁友好，优先推荐店铺商品。如果用户询问退换货政策，引导他们联系人工客服。
```

---

## 在不同框架中嵌入

### React / Next.js

```jsx
useEffect(() => {
  const s = document.createElement('script');
  s.src = 'https://chat.example.com/embed.js';
  s.async = true;
  document.body.appendChild(s);
  return () => document.body.removeChild(s);
}, []);
```

### Vue

```vue
<script setup>
import { onMounted } from 'vue'
onMounted(() => {
  const s = document.createElement('script')
  s.src = 'https://chat.example.com/embed.js'
  s.async = true
  document.body.appendChild(s)
})
</script>
```

### WordPress

在主题的 `footer.php` 中 `</body>` 前添加：

```html
<script src="https://chat.example.com/embed.js" async></script>
```

### 静态 HTML

直接在 `</body>` 前添加即可，无需任何构建工具。

---

## 工作原理

```
用户在你的网站提问
       ↓
embed.js 自动提取页面内容 + 发送问题
       ↓
┌─────────────────────────────────────────┐
│          EdgeOne Makers Agent           │
│                                         │
│  1. 将页面内容注入 AI 上下文             │
│  2. AI 判断是否需要调用后端接口          │
│  3. 如果需要 → 调用你的 API → 获取数据   │
│  4. AI 基于所有信息生成回答              │
│  5. 流式返回给前端                       │
└─────────────────────────────────────────┘
       ↓
用户看到实时生成的回答
```

---

## 本地调试

```bash
# 克隆项目
git clone <your-repo>
cd site-agent

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 AI_GATEWAY_API_KEY 等

# 启动开发服务器
npm run dev

# 部署更新
npm run deploy
```

---

## 环境变量一览

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `AI_GATEWAY_API_KEY` | ✅ | AI 模型 API Key |
| `AI_GATEWAY_BASE_URL` | ✅ | 模型网关地址 |
| `AI_GATEWAY_MODEL` | ❌ | 模型 ID，默认 `@makers/deepseek-v4-flash` |
| `SYSTEM_PROMPT` | ❌ | 自定义系统提示词 |
| `ASSISTANT_NAME` | ❌ | 助手名称 |
| `WELCOME_MESSAGE` | ❌ | 欢迎消息 |
| `DATA_API_BASE_URL` | ❌ | 你的后端 API 根地址 |
| `DATA_API_KEY` | ❌ | 后端认证 Token |
| `SITEMAP_URL` | ❌ | 你网站的 sitemap.xml 地址（启用全站知识搜索） |

---

## 常见问题

**Q：我的后端不在 EdgeOne 上，可以用吗？**

可以。你的后端可以部署在任何有公网地址的地方（AWS、阿里云、自建服务器等），只需设置 `DATA_API_BASE_URL` 指向你的后端地址。

**Q：需要后端提供 schema 接口吗？**

不需要。直接在 Agent 项目里放一个 `api-schema.json` 文件即可，无需后端额外开发。

**Q：AI 会不会调用 schema 里没定义的接口？**

不会。AI 只能调用 `api-schema.json` 中明确定义的接口，不会自行构造其他请求。

**Q：支持哪些模型？**

支持所有 OpenAI 兼容的模型接口，包括 DeepSeek、GPT-4o、Claude、通义千问等。只需修改 `AI_GATEWAY_BASE_URL` 和 `AI_GATEWAY_API_KEY`。

**Q：embed.js 对单页应用（SPA）支持如何？**

支持。脚本会自动检测 URL 变化，路由切换时重新提取页面内容发送给 AI。

**Q：如何限制 AI 调用频率？**

在你的后端做限流即可。Agent 每轮对话最多调用 4 次工具。

---

## 相关链接

- [EdgeOne Makers 控制台](https://edgeone.ai/makers)
- [EdgeOne Pages 文档](https://edgeone.ai/document/pages/overview)
- [API Schema 格式参考](./api-schema.example.json)
