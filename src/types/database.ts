// ==================== 数据库模块类型定义 ====================

// 支持的数据库类型
export type DatabaseType = 'mysql' | 'mariadb' | 'postgresql' | 'sqlite'

// 数据库类型配置
export const DATABASE_CONFIGS: Record<DatabaseType, {
  label: string
  defaultPort: number
  icon: string
  color: string
}> = {
  mysql: { label: 'MySQL', defaultPort: 3306, icon: 'mysql', color: '#4479A1' },
  mariadb: { label: 'MariaDB', defaultPort: 3306, icon: 'mariadb', color: '#003B5C' },
  postgresql: { label: 'PostgreSQL', defaultPort: 5432, icon: 'postgresql', color: '#336791' },
  sqlite: { label: 'SQLite', defaultPort: 0, icon: 'sqlite', color: '#003B57' },
}

// 数据库连接配置
export interface DbConnection {
  id: string
  name: string
  type: DatabaseType

  // 连接信息
  host: string
  port: number
  username: string
  password: string
  database: string  // 默认数据库

  // 高级选项
  charset?: string
  ssl?: boolean
  connectTimeout?: number  // 毫秒

  // 状态
  connected: boolean
  connecting?: boolean
  error?: string

  // 元数据
  createdAt: number
  updatedAt: number
}

// 表信息
export interface TableInfo {
  name: string
  type: 'TABLE' | 'VIEW'
  schema?: string
  comment?: string
  rowCount?: number
  dataSize?: number
  createTime?: string
  updateTime?: string
}

// 列信息
export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  comment?: string
  isPrimaryKey: boolean
  isAutoIncrement: boolean
  maxLength?: number
  precision?: number
  scale?: number
  ordinalPosition: number
}

// 索引信息
export interface IndexInfo {
  name: string
  type: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT'
  columns: string[]
  comment?: string
}

// 外键信息
export interface ForeignKeyInfo {
  name: string
  columns: string[]
  referencedTable: string
  referencedColumns: string[]
  onUpdate: 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION'
  onDelete: 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION'
}

// 表完整结构
export interface TableStructure {
  columns: ColumnInfo[]
  indexes: IndexInfo[]
  foreignKeys: ForeignKeyInfo[]
}

// 查询结果
export interface QueryResult {
  success: boolean
  data?: any[][]
  columns?: string[]
  columnTypes?: string[]
  rowCount?: number
  affectedRows?: number
  insertId?: number
  error?: string
  executionTime: number  // 毫秒
}

// 批量查询结果
export interface BatchQueryResult {
  results: QueryResult[]
  totalExecutionTime: number
}

// 执行历史记录
export interface QueryHistory {
  id: string
  connectionId: string
  database: string
  sql: string
  executionTime: number
  rowCount?: number
  error?: string
  timestamp: number
}

// 收藏的查询
export interface SavedQuery {
  id: string
  name: string
  sql: string
  connectionId?: string  // 可选，如果关联特定连接
  database?: string
  createdAt: number
  updatedAt: number
}

// 数据库信息
export interface DatabaseInfo {
  name: string
  charset?: string
  collation?: string
  tableCount: number
  size?: number
}

// 数据库树节点
export type DbTreeNodeType = 'root' | 'database' | 'tables' | 'views' | 'procedures' | 'triggers' | 'table' | 'view' | 'procedure' | 'trigger' | 'saved_queries' | 'saved_query'

export interface DbTreeNode {
  id: string
  name: string
  type: DbTreeNodeType
  parentId: string | null
  children?: DbTreeNode[]
  data?: {
    tableInfo?: TableInfo
    databaseInfo?: DatabaseInfo
    savedQuery?: SavedQuery
  }
  expanded?: boolean
  loading?: boolean
}

// SQL 编辑器标签页
export interface QueryTab {
  id: string
  name: string
  sql: string
  connectionId?: string
  database?: string
  result?: QueryResult
  isModified: boolean
  createdAt: number
}

// 数据编辑模式
export type DataEditMode = 'view' | 'edit' | 'insert'

// 数据表格状态
export interface DataGridState {
  table: string
  database: string
  data: any[][]
  columns: string[]
  columnTypes: string[]
  page: number
  pageSize: number
  totalRows: number
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
  whereClause?: string
  loading: boolean
  editMode: DataEditMode
  selectedRows: number[]
  modifiedCells: Map<string, any>
}

// 导入导出配置
export type ExportFormat = 'sql' | 'csv' | 'json' | 'excel'

export interface ExportConfig {
  format: ExportFormat
  includeHeaders: boolean
  includeCreateTable: boolean
  selectedRowsOnly: boolean
  batchSize: number  // 批量导出时的批次大小
}

export interface ImportConfig {
  format: ExportFormat
  file: string
  tableName: string
  columnMapping?: Record<string, string>
  skipErrors: boolean
  truncateFirst: boolean
}

// 连接测试结果
export interface ConnectionTestResult {
  success: boolean
  error?: string
  serverVersion?: string
  serverType?: string
}

export {}