# XBL DevTools - 开发规范文档

## 一、目录结构规范

```
src/
├── store/
│   ├── devtoolsStore.ts      # 统一状态管理（总入口）
│   ├── modules/
│   │   ├── redisModule.ts    # Redis模块状态
│   │   ├── apiModule.ts      # API模块状态
│   │   ├── mysqlModule.ts    # MySQL模块状态（预留）
│   │   └── mongoModule.ts    # MongoDB模块状态（预留）
│   └── types.ts              # 统一类型定义
│
├── components/
│   ├── common/               # 公共组件
│   │   ├── Toolbar.tsx       # 顶部工具栏
│   │   ├── Sidebar.tsx       # 侧边栏容器
│   │   ├── ConfirmDialog.tsx # 确认弹窗（现有）
│   │   ├── JsonTree.tsx      # JSON展示（现有）
│   │   ├── CodeEditor.tsx    # 代码编辑器（现有）
│   │   └── KeyValueEditor.tsx # Key-Value编辑器（新增，可复用）
│   │
│   ├── redis/                # Redis组件（现有，整理到此目录）
│   │   ├── ConnectionPanel.tsx
│   │   ├── KeyBrowser.tsx
│   │   ├── DataPanel.tsx
│   │   └── ...
│   │
│   ├── api/                  # API Tester组件
│   │   ├── ApiSidebar.tsx
│   │   ├── ApiWorkspace.tsx
│   │   ├── RequestBar.tsx
│   │   ├── RequestTabs.tsx
│   │   ├── ResponsePanel.tsx
│   │   └── ...
│   │
│   ├── mysql/                # MySQL组件（预留目录）
│   │
│   └── mongodb/              # MongoDB组件（预留目录）
│
├── services/
│   ├── redis.ts              # Redis服务（现有）
│   ├── http.ts               # HTTP请求服务（新增）
│   └── storage.ts            # 本地存储服务（新增）
│
└── utils/
    ├── formatter.ts          # 格式化工具（现有）
    └── variables.ts          # 变量替换工具（新增）
```

## 二、数据存储规范

本地存储目录结构（Electron userData）：

```
userData/
├── config/
│   ├── connections.json      # Redis/MySQL/MongoDB连接配置
│   └── settings.json         # 全局设置（主题、语言等）
│
├── redis/
│   └── (无额外数据，连接配置在connections.json)
│
├── api/
│   ├── saved.json            # 收藏的请求
│   ├── history.json          # 历史记录
│   └── environments.json     # 环境变量
│
├── mysql/
│   ├── saved.json            # 收藏的SQL查询（预留）
│   └── history.json          # SQL历史（预留）
│
└── mongodb/
│   ├── saved.json            # 收藏的查询（预留）
│   └── history.json          # 查询历史（预留）
```

## 三、状态管理规范

```typescript
// src/store/types.ts

// 工具类型
export type ToolType = 'redis' | 'api' | 'mysql' | 'mongodb'

// 工具配置
export interface ToolConfig {
  id: ToolType
  label: string
  icon: LucideIcon
  color: string  // 主题色
}

// 统一状态结构
export interface DevtoolsState {
  // 当前激活工具
  activeTool: ToolType

  // 全局设置
  settings: {
    theme: 'light' | 'dark'
    sidebarWidth: number
  }

  // 各工具模块状态
  redis: RedisState
  api: ApiState
  mysql: MySQLState   // 预留
  mongodb: MongoState // 预留
}
```

## 四、组件命名规范

| 规则 | 示例 |
|-----|------|
| 组件目录以工具名命名 | `components/api/`, `components/mysql/` |
| Sidebar组件统一命名 | `ApiSidebar`, `MySQLSidebar`, `MongoSidebar` |
| Workspace组件统一命名 | `ApiWorkspace`, `MySQLWorkspace` |
| 公共组件放common目录 | `KeyValueEditor`, `StatusBadge` |
| 类型定义以模块区分 | `ApiState`, `ApiRequest`, `ApiResponse` |

## 五、IPC通道命名规范

```
redis:*      # Redis相关（现有）
api:*        # API Tester相关（新增）
mysql:*      # MySQL相关（预留）
mongodb:*    # MongoDB相关（预留）
storage:*    # 存储相关（公共）
```

示例：
- `api:request` - 发送HTTP请求
- `api:cancel` - 取消请求
- `storage:load` - 加载配置文件
- `storage:save` - 保存配置文件

## 六、公共组件设计原则

1. **可复用性** - 各工具都能使用的组件放common
2. **一致性** - 相同功能在不同工具中外观一致
3. **扩展性** - 通过props控制不同工具的差异

```tsx
// KeyValueEditor 示例 - 可用于 API Headers、MySQL参数等
<KeyValueEditor
  data={headers}
  onChange={setHeaders}
  placeholder={{ key: 'Header名称', value: 'Header值' }}
  suggestions={['Content-Type', 'Authorization']}  // 自动补全建议
/>
```