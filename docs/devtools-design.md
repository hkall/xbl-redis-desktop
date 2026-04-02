# XBL DevTools - 个人开发者工具集设计方案

## 一、设计理念

**本地优先 · 简洁高效 · 无需协作**

- 纯本地工具，数据不上传，安全可控
- 去掉协作功能，界面更清爽
- 收藏 + 历史模式，快速访问常用请求
- 批量导出导入，便于备份迁移
- 统一交互，多工具无缝切换

---

## 二、整体架构

### 2.1 界面布局（保持现有风格）

```
┌─────────────────────────────────────────────────────────────┐
│                      工具栏 Tab                              │
│   [Redis]   [API]   [MySQL]   [MongoDB]   │   [主题] [设置] │
├──────────┬──────────────────────────────────────────────────┤
│ 侧边栏   │                                                  │
│          │                   主工作区                        │
│ 连接列表 │                                                  │
│          │          (根据当前工具动态切换)                    │
│ 收藏项目 │                                                  │
│          │                                                  │
│ 历史记录 │                                                  │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

**与现有 Redis 工具的融合：**
- 工具栏放在顶部，替代原来的底部工具按钮区域
- 侧边栏保持不变，根据工具类型显示不同内容
- 主工作区保持不变，各工具共享这个区域

---

## 三、API Tester 设计

### 3.1 功能清单（精简版）

| 功能 | 描述 |
|-----|------|
| **请求构建** | HTTP方法、URL、Headers、Body |
| **响应展示** | 状态码、耗时、响应体(JSON高亮) |
| **收藏管理** | 保存常用请求，一键发送 |
| **历史记录** | 自动记录所有请求，可重发 |
| **环境变量** | 开发/测试/生产环境切换 |
| **批量导出** | 导出收藏+环境变量为JSON |
| **批量导入** | 导入JSON恢复收藏和环境 |

### 3.2 界面设计

```
┌────────────────────────────────────────────────────────────────┐
│ [Redis] [API✓] [MySQL] [MongoDB]                    [☀] [⚙]   │
├──────────┬─────────────────────────────────────────────────────┤
│ API Tester│                                                    │
│          │  ┌─────────────────────────────────────────────────┐│
│ ──连接──  │  │ [GET▼] [https://api.example.com/users    ] [Send]│
│ localhost │  └─────────────────────────────────────────────────┘│
│           │                                                     │
│ ──收藏──  │  ┌─ Params ── Headers ── Body ── Auth ─────────────┐│
│ ▸ 用户列表│  │                                                 ││
│   GET /api│  │  Key               Value                        ││
| ▸ 登录接口│  │  Authorization     Bearer {{token}}             ││
│   POST /lo│  │  Content-Type      application/json             ││
│           │  │                                                 ││
│ ──历史──  │  └─────────────────────────────────────────────────┘│
│ 10:23 GET │                                                     │
│ 10:21 POST│  ┌─ Response ── 200 OK ── 45ms ── 1.2KB ────────────┐│
│ 09:15 GET │  │ [Body]  [Headers]                                ││
│ 08:50 POST│  │                                                 ││
│           │  │  {                                              ││
│           │  │    "code": 0,                                   ││
│           │  │    "data": {                                    ││
│           │  │      "users": [...],                            ││
│           │  │      "total": 100                               ││
│           │  │    }                                            ││
│           │  │  }                                              ││
│           │  └─────────────────────────────────────────────────┘│
│          │                                                     │
│ [导出] [导入]                                                  │
└──────────┴─────────────────────────────────────────────────────┘
```

### 3.3 侧边栏结构

```
API Tester 侧边栏
├── 环境 (下拉选择)
│   ├── 开发环境
│   ├── 测试环境
│   └── 生产环境
│
├── 收藏 (可展开折叠)
│   ├── 用户相关
│   │   ├── GET 用户列表
│   │   └── POST 创建用户
│   ├── 订单相关
│   │   ├── GET 订单详情
│   │   └── POST 创建订单
│   └── ...
│
├── 历史 (最近20条)
│   ├── 10:23 GET /api/users
│   ├── 10:21 POST /api/login
│   └── ...
│
└── 底部操作
    ├── [导出收藏]
    └── [导入收藏]
```

### 3.4 核心数据结构

```typescript
// 收藏的请求（简化版，无分组概念）
interface SavedRequest {
  id: string
  name: string           // 显示名称，如 "用户列表"
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body?: RequestBody
  auth?: AuthConfig
  createdAt: number
}

// 历史记录
interface HistoryItem {
  id: string
  request: SavedRequest
  response?: ResponseData
  timestamp: number
}

// 环境变量
interface Environment {
  id: string
  name: string           // "开发环境", "测试环境"
  variables: KeyValue[]  // [{key: "baseUrl", value: "https://dev.api.com"}]
}

// 导出格式
interface ExportData {
  version: string
  exportedAt: number
  savedRequests: SavedRequest[]
  environments: Environment[]
}

// 基础类型
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
type KeyValue = { key: string; value: string; enabled: boolean }
type RequestBody = { type: 'json' | 'form' | 'raw'; content: string }
type AuthConfig = { type: 'none' | 'bearer' | 'basic'; token?: string; user?: string; pass?: string }
type ResponseData = { status: number; headers: Record<string,string>; body: string; time: number; size: number }
```

### 3.5 组件结构

```
src/components/api/
├── ApiSidebar.tsx           # 侧边栏容器
│   ├── EnvironmentSelect.tsx # 环境下拉选择
│   ├── SavedList.tsx        # 收藏列表（树形展开）
│   ├── HistoryList.tsx      # 历史列表
│   └── ImportExport.tsx     # 导出导入按钮
│
├── ApiWorkspace.tsx         # 主工作区
│   ├── RequestBar.tsx       # 方法+URL+发送按钮
│   ├── RequestTabs.tsx      # Params/Headers/Body/Auth tabs
│   ├── KeyValueEditor.tsx   # Key-Value编辑器(复用)
│   ├── BodyEditor.tsx       # Body编辑(JSON高亮)
│   └── AuthEditor.tsx       # 认证配置
│
├── ResponsePanel.tsx        # 响应面板
│   ├── StatusBadge.tsx      # 状态码+耗时+大小
│   ├── ResponseTabs.tsx     # Body/Headers tabs
│   └── JsonViewer.tsx       # JSON展示(复用现有组件)
│
└── ApiModals.tsx            # 弹窗
    ├── SaveRequestModal.tsx # 保存请求弹窗
    ├── EditEnvModal.tsx     # 编辑环境变量弹窗
    └── ImportModal.tsx      # 导入确认弹窗
```

---

## 四、交互细节

### 4.1 快捷操作

| 操作 | 快捷键/方式 |
|-----|------------|
| 发送请求 | `Ctrl + Enter` 或点击 Send |
| 保存当前请求 | 点击收藏按钮 → 输入名称 |
| 重发历史请求 | 点击历史项 → 自动填充 |
| 复制响应 | 右键 → 复制响应体 |
| 删除收藏 | 右键 → 删除 |

### 4.2 变量替换

使用 `{{变量名}}` 语法：

```
URL: {{baseUrl}}/users/{{userId}}
Headers: Authorization: Bearer {{token}}
Body: {"name": "{{userName}}"}
```

鼠标悬停显示当前环境下的变量值。

### 4.3 状态码颜色

```css
--status-2xx: #22C55E  /* 成功 - 绿色 */
--status-3xx: #3B82F6  /* 重定向 - 蓝色 */
--status-4xx: #F97316  /* 客户端错误 - 橙色 */
--status-5xx: #EF4444  /* 服务端错误 - 红色 */
```

### 4.4 导出导入格式

导出JSON示例：
```json
{
  "version": "1.0",
  "exportedAt": 1711432800000,
  "savedRequests": [
    {
      "id": "req-001",
      "name": "用户列表",
      "method": "GET",
      "url": "{{baseUrl}}/users",
      "headers": [
        {"key": "Authorization", "value": "Bearer {{token}}", "enabled": true}
      ],
      "params": [],
      "body": null,
      "auth": {"type": "none"}
    }
  ],
  "environments": [
    {
      "id": "env-001",
      "name": "开发环境",
      "variables": [
        {"key": "baseUrl", "value": "http://localhost:8080"},
        {"key": "token", "value": "dev-test-token"}
      ]
    },
    {
      "id": "env-002",
      "name": "生产环境",
      "variables": [
        {"key": "baseUrl", "value": "https://api.production.com"},
        {"key": "token", "value": ""}
      ]
    }
  ]
}
```

---

## 五、与其他工具的融合

### 5.1 工具栏设计

顶部工具栏，每个工具一个 Tab：

```tsx
type ToolType = 'redis' | 'api' | 'mysql' | 'mongodb'

const TOOLS = [
  { id: 'redis', label: 'Redis', icon: Database, color: '#DC382D' },
  { id: 'api', label: 'API', icon: Globe, color: '#3B82F6' },
  { id: 'mysql', label: 'MySQL', icon: Database, color: '#F97316' },
  { id: 'mongodb', label: 'MongoDB', icon: Layers, color: '#22C55E' },
]
```

当前激活的工具 Tab 显示对应颜色高亮。

### 5.2 侧边栏切换

根据 `activeTool` 显示不同侧边栏内容：
- Redis → 连接列表 + Keys面板切换
- API → 环境 + 收藏 + 历史
- MySQL → 连接列表 + 数据库/表列表
- MongoDB → 连接列表 + Collection列表

### 5.3 主工作区切换

根据 `activeTool` 显示不同主组件：
- Redis → KeyBrowser + DataPanel
- API → RequestBuilder + ResponsePanel
- MySQL → QueryEditor + ResultTable
- MongoDB → QueryEditor + DocumentViewer

### 5.4 工具间协作示例

场景：API返回数据需要存入Redis验证

```
API Tester 响应面板
└─ 右键菜单
   ├─ 复制响应
   ├─ 复制为JSON路径
   └─ 存入Redis ──→ 自动切换到Redis工具
                   └─ Key预填充: api:response:timestamp
                   └─ Value预填充: 响应JSON
                   └─ 直接保存即可
```

---

## 六、技术实现要点

### 6.1 状态管理

```typescript
// src/store/devtoolsStore.ts
interface DevtoolsState {
  activeTool: ToolType

  // Redis状态（保持现有）
  redis: RedisState

  // API Tester状态
  api: {
    environments: Environment[]
    activeEnvId: string | null
    savedRequests: SavedRequest[]
    history: HistoryItem[]
    currentRequest: SavedRequest | null  // 当前编辑的请求
    currentResponse: ResponseData | null // 最新响应
  }

  // 其他工具...
}
```

### 6.2 HTTP请求（Electron端）

```typescript
// electron/preload.js
contextBridge.exposeInMainWorld('httpAPI', {
  request: (config) => ipcRenderer.invoke('http:request', config),
})

// electron/main.cjs
ipcMain.handle('http:request', async (_event, config) => {
  const { method, url, headers, body, timeout = 30000 } = config
  const startTime = Date.now()

  try {
    const response = await fetch(url, {
      method,
      headers: Object.fromEntries(headers.filter(h => h.enabled).map(h => [h.key, h.value])),
      body: body?.content || undefined,
      signal: AbortSignal.timeout(timeout)
    })

    const resHeaders = {}
    response.headers.forEach((v, k) => resHeaders[k] = v)

    return {
      success: true,
      data: {
        status: response.status,
        headers: resHeaders,
        body: await response.text(),
        time: Date.now() - startTime,
        size: 0 // 计算后设置
      }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
```

### 6.3 数据存储

所有数据保存在 `userData` 目录：
- `api-saved.json` - 收藏的请求
- `api-history.json` - 历史记录(最多100条)
- `api-envs.json` - 环境变量配置

---

## 七、开发计划

### Phase 1: 架构准备
- 创建 `devtoolsStore.ts` 统一状态
- 添加顶部工具栏组件
- 重构 App.tsx 支持工具切换
- 确保 Redis 功能不受影响

### Phase 2: API Tester 核心
- ApiSidebar 基础结构
- RequestBar + RequestTabs
- ResponsePanel + JsonViewer
- HTTP请求 IPC 实现

### Phase 3: API Tester 完善
- 收藏保存/删除功能
- 历史记录自动保存
- 环境变量管理
- 导出导入功能
- 变量替换实现

### Phase 4: 扩展其他工具
- MySQL Client
- MongoDB Client

---

## 八、总结

**简化后的优势：**

| 对比项 | Apifox | XBL DevTools |
|-------|--------|--------------|
| 项目分组 | 多人协作复杂管理 | 无，纯本地收藏 |
| 云同步 | 账号登录云端 | 无，本地JSON文件 |
| 团队功能 | 有 | 无 |
| 安全风险 | 数据上传云端 | 100%本地无风险 |
| 界面复杂度 | 功能繁多 | 简洁清爽 |
| 学习成本 | 较高 | 很低 |
| 价格 | 收费 | 免费 |

**适合场景：**
- 个人开发者本地调试
- 快速测试API接口
- 不需要团队协作
- 注重数据安全