// 工具类型
export type ToolType = 'redis' | 'api' | 'mysql' | 'mongodb'

// 工具配置
export interface ToolConfig {
  id: ToolType
  label: string
  color: string
}

export const TOOL_CONFIGS: Record<ToolType, ToolConfig> = {
  redis: { id: 'redis', label: 'Redis', color: '#DC382D' },
  api: { id: 'api', label: 'API', color: '#3B82F6' },
  mysql: { id: 'mysql', label: 'MySQL', color: '#F97316' },
  mongodb: { id: 'mongodb', label: 'MongoDB', color: '#22C55E' },
}

// ==================== API Module Types ====================

// HTTP方法
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

// Key-Value对
export interface KeyValue {
  key: string
  value: string
  enabled: boolean
  description?: string
}

// 表单数据项
export interface FormField {
  key: string
  value: string
  type: 'text' | 'file'  // text为普通文本，file为文件
  enabled: boolean
  fileName?: string  // 文件名（仅file类型）
  fileType?: string  // 文件MIME类型（仅file类型）
}

// 请求Body
export interface RequestBody {
  type: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary'
  content: string  // 用于json/raw
  formData: FormField[]  // 用于form-data和x-www-form-urlencoded
  binaryFile?: {  // 用于binary
    name: string
    type: string
    data: string  // base64编码
  }
  rawType?: 'text' | 'xml' | 'html' | 'javascript'  // raw类型子类型
}

// 认证配置
export interface AuthConfig {
  type: 'none' | 'bearer' | 'basic' | 'api-key'
  // Bearer
  token?: string
  // Basic
  username?: string
  password?: string
  // API Key
  apiKeyName?: string
  apiKeyValue?: string
  apiKeyLocation?: 'header' | 'query'
}

// 保存的请求
export interface SavedRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body: RequestBody
  auth: AuthConfig
  description?: string
  timeout?: number  // 请求超时时间（毫秒），默认30000
  createdAt: number
  updatedAt: number
}

// 请求文件夹（支持多层级）
export interface RequestFolder {
  id: string
  name: string
  parentId: string | null  // null表示根目录
  children: (SavedRequest | RequestFolder)[]  // 可以包含请求或子文件夹
  createdAt: number
  updatedAt: number
}

// 判断是否为文件夹
export function isFolder(item: SavedRequest | RequestFolder): item is RequestFolder {
  return 'children' in item
}

// 判断是否为请求
export function isRequest(item: SavedRequest | RequestFolder): item is SavedRequest {
  return 'method' in item
}

// 响应数据
export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number   // ms
  size: number   // bytes
}

// 历史记录
export interface HistoryItem {
  id: string
  request: {
    name?: string
    method: HttpMethod
    url: string
    headers: KeyValue[]
    params: KeyValue[]
    body: RequestBody
    auth: AuthConfig
  }
  response?: ResponseData
  error?: string
  timestamp: number
}

// 环境变量
export interface Environment {
  id: string
  name: string
  variables: KeyValue[]
}

// API项目
export interface ApiProject {
  id: string
  name: string
  description?: string
  requestFolders: RequestFolder[]
  rootRequests: SavedRequest[]
  environments: Environment[]
  activeEnvId: string | null
  createdAt: number
  updatedAt: number
}

// API模块状态
export interface ApiState {
  // 项目列表
  projects: ApiProject[]
  activeProjectId: string | null

  // 历史记录（全局共享）
  history: HistoryItem[]

  // 当前编辑的请求
  currentRequest: SavedRequest | null

  // 当前响应
  currentResponse: ResponseData | null

  // 当前错误
  currentError: string | null

  // 加载状态
  loading: boolean
}

// ==================== MySQL Module Types (预留) ====================

export interface MySQLConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  password: string
  database: string
}

export interface MySQLState {
  connections: MySQLConnection[]
  activeConnectionId: string | null
  // ... 其他状态预留
}

// ==================== MongoDB Module Types (预留) ====================

export interface MongoConnection {
  id: string
  name: string
  uri: string
  database: string
}

export interface MongoState {
  connections: MongoConnection[]
  activeConnectionId: string | null
  // ... 其他状态预留
}

// ==================== 全局状态 ====================

export interface DevtoolsState {
  // 当前激活工具
  activeTool: ToolType

  // 全局设置
  theme: 'light' | 'dark'

  // 各工具模块状态
  // Redis状态保持现有结构，这里不重复定义
}

// ==================== 回收站类型 ====================

export type RecycleBinItemType = 'request' | 'folder'

export interface RecycleBinItem {
  id: string
  type: RecycleBinItemType
  name: string
  data: SavedRequest | RequestFolder
  projectId: string
  projectName: string
  parentFolderId: string | null  // 原来所在的文件夹ID，null表示根目录
  deletedAt: number
  expiresAt: number  // 过期时间（3天后）
}