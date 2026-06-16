# 为任何网站添加 AI 对话助手

本文介绍如何使用 **SiteAgent** 模板，为你的网站添加一个 AI 对话助手。只需一行代码嵌入，AI 就能自动理解页面内容、查询你的业务 API，实时回答用户问题。

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

1. 一个 [EdgeOne Makers](https://console.cloud.tencent.com/edgeone/makers) 账号
2. 一个 GitHub 账号
3. 你的网站（任何框架：React、Vue、WordPress、静态 HTML 等）
4. （可选）你的后端 API 地址，如果需要 AI 查询业务数据

---

## 快速开始

### 1、Fork 项目并配置 API Schema

**第一步：Fork 到你的 GitHub**

打开 [https://github.com/xiaban-x/site-agent](https://github.com/xiaban-x/site-agent)，点击右上角 **Fork** 按钮，将项目复制到你自己的 GitHub 账号下。

**第二步：配置 API Schema（可选）**

如果你需要 AI 查询你的后端数据，克隆 Fork 后的仓库到本地，编辑根目录下的 `api-schema.json` 文件，描述你的后端接口：

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

编辑完成后提交推送到你的 GitHub 仓库。

> **提示：** 如果暂时不需要 AI 查询后端数据，可以跳过这一步。AI 默认就能根据页面内容回答问题。

### 2、导入部署并配置环境变量

进入 [EdgeOne Makers 控制台](https://console.cloud.tencent.com/edgeone/makers)，点击 **新建项目** → **从 Git 导入**，选择你 Fork 的仓库。

在部署配置页面，填写环境变量：

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `AI_GATEWAY_API_KEY` | ✅ | AI 模型的 API Key |
| `AI_GATEWAY_BASE_URL` | ✅ | 模型网关地址，Makers 内置模型填 `https://ai-gateway.edgeone.link/v1` |
| `DATA_API_BASE_URL` | ❌ | 你的后端 API 根地址，如 `https://api.example.com` |
| `DATA_API_KEY` | ❌ | 后端认证 Token（会加到请求的 `Authorization: Bearer` 头） |

> **提示：** `AI_GATEWAY_API_KEY` 可在 Makers 控制台的 Models 页面获取。`DATA_API_BASE_URL` 和 `DATA_API_KEY` 仅在需要 AI 查询后端数据时配置。如果部署时忘了填，也可以在项目 → **设置** → **环境变量** 中补充。

点击部署，等待完成。

### 3、绑定自定义域名

进入 EdgeOne Makers 控制台 → 你的项目 → **域名管理**，绑定你自己的域名，例如：`chat.example.com`

> **提示：** 绑定自定义域名后无需任何鉴权即可访问，这是正式使用的前提条件。

### 4、嵌入到你的网站

在你网站的 HTML 中，`</body>` 之前添加一行代码：

```html
<script src="https://chat.example.com/embed.js" async></script>
```

刷新页面，右下角出现聊天气泡，点击即可对话。**完成！**

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

## API Schema 详解

### endpoint 路径规则

- 路径中的 `{param}` 会被同名参数值替换：`GET /api/posts/{id}` + `{"id": "5"}` → `GET /api/posts/5`
- 未用于路径替换的参数：
  - GET 请求 → 作为 query string：`GET /api/posts?q=react`
  - POST/PUT 请求 → 作为 JSON body

### description 编写技巧

`description` 决定了 AI 什么时候调用你的接口，写得好不好直接影响效果：

```json
// ❌ 太模糊
"description": "获取数据"

// ✅ 清楚说明功能 + 使用时机
"description": "Get the full content of a single blog post by its ID. Use search_posts first if you don't know the ID."
```

### 后端跨域要求

Agent 会从 EdgeOne 域名向你的后端发起请求，你需要在后端设置 CORS：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
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
embed.js 注入气泡 + iframe（加载同源 /widget）
       ↓
embed.js 提取页面内容，通过 postMessage 发送给 iframe
       ↓
┌─────────────────────────────────────────┐
│     iframe 内的 /widget 页面（同源）     │
│                                         │
│  fetch('/chat') → Agent 处理：           │
│  1. 将页面内容注入 AI 上下文             │
│  2. AI 判断是否需要调用后端接口          │
│  3. 如果需要 → 调用你的 API → 获取数据   │
│  4. AI 基于所有信息生成回答              │
│  5. SSE 流式返回给前端                   │
└─────────────────────────────────────────┘
       ↓
用户看到实时生成的回答
```

> **为什么用 iframe？** iframe 加载的是 Agent 同域的 `/widget` 页面，内部所有 API 请求都是同源的，不存在跨域问题。

---

## 本地调试

```bash
# 克隆你 Fork 的仓库
git clone https://github.com/你的用户名/site-agent.git
cd site-agent

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 AI_GATEWAY_API_KEY 等

# 启动开发服务器
npm run dev
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

**Q：不配置 api-schema.json 能用吗？**

能用。不配置时 AI 只根据当前页面内容回答问题，不会调用任何外部接口。

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
