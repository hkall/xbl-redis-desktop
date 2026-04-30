declare global {
  interface Window {
    electronAPI: {
      redisTest: (config: { host: string; port: number; password?: string; db: number }) => Promise<{ success: boolean; error?: string }>
      redisConnect: (id: string, config: { host: string; port: number; password?: string; db: number }) => Promise<{ success: boolean; db?: number; error?: string }>
      redisDisconnect: (id: string) => Promise<{ success: boolean; error?: string }>
      redisScan: (id: string, pattern?: string, count?: number, cursor?: string) => Promise<{ success: boolean; data?: string[]; cursor?: string; error?: string }>
      redisKeyInfo: (id: string, key: string) => Promise<{ success: boolean; data?: any; error?: string }>
      redisGet: (id: string, key: string) => Promise<{ success: boolean; data?: any; encoding?: string; isJavaSerialization?: boolean; error?: string }>
      redisSet: (id: string, key: string, type: string, value: any) => Promise<{ success: boolean; error?: string }>
      redisDelete: (id: string, key: string) => Promise<{ success: boolean; error?: string }>
      redisRename: (id: string, key: string, newKey: string) => Promise<{ success: boolean; error?: string }>
      redisSetTTL: (id: string, key: string, seconds: number) => Promise<{ success: boolean; error?: string }>
      redisClearTTL: (id: string, key: string) => Promise<{ success: boolean; error?: string }>
      redisInfo: (id: string) => Promise<{ success: boolean; data?: Record<string, number>; error?: string }>
      redisSelectDb: (id: string, db: number) => Promise<{ success: boolean; error?: string }>
      redisDbSize: (id: string) => Promise<{ success: boolean; data?: number; error?: string }>
      redisExecuteCommand: (id: string, command: string) => Promise<{ success: boolean; data?: any; encoding?: string; command?: string; error?: string }>
      redisGetServerInfo: (id: string, section?: string) => Promise<{ success: boolean; data?: any; error?: string }>
      redisHscan: (id: string, key: string, cursor?: string, count?: number) => Promise<{ success: boolean; data?: any; cursor?: string; hasMore?: boolean; total?: number; error?: string }>
      javaDeserialize: (byteArray: number[]) => Promise<{ success: boolean; data?: any; error?: string }>
      createAndDownloadArchive: (options: { filename: string; files: { name: string; content: string }[] }) => Promise<{ success: boolean; error?: string }>
      saveConfig: (key: string, data: any) => Promise<{ success: boolean; error?: string }>
      loadConfig: (key: string) => Promise<{ success: boolean; data?: any; error?: string }>
      getUserDataPath: () => Promise<string>
      openExternal: (url: string) => Promise<void>
      saveFile: (options: { defaultFileName: string; data: number[] }) => Promise<string | null>
      openPath: (path: string) => Promise<void>
      downloadUpdate: (url: string, filename: string) => Promise<{ success: boolean; filePath?: string; downloadsDir?: string; error?: string }>
      openUpdateFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
      openUpdateFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>
      onUpdateProgress: (callback: (data: { percent: number; downloaded: number; total: number }) => void) => void
      // HTTP Request (API Tester)
      httpRequest: (config: {
        method: string
        url: string
        headers?: { key: string; value: string; enabled: boolean }[]
        body?: { type: string; content: string; contentType?: string } | { type: string; entries: { key: string; value: string; type: string; fileName?: string }[] }
        timeout?: number
        requestId?: string
      }) => Promise<{
        success: boolean
        requestId?: string
        data?: {
          status: number
          statusText: string
          headers: Record<string, string>
          body: string
          time: number
          size: number
        }
        error?: string
      }>
      httpCancel: (requestId: string) => Promise<{ success: boolean; error?: string }>

      // Database Module
      dbCreateConnection?: (connectionId: string, config: any) => Promise<{ success: boolean; connectionId?: string; error?: string }>
      dbCloseConnection?: (connectionId: string) => Promise<void>
      dbTestConnection?: (config: any) => Promise<{ success: boolean; error?: string; serverVersion?: string; serverType?: string }>
      dbExecuteQuery?: (connectionId: string, sql: string, database?: string) => Promise<any>
      dbGetDatabases?: (connectionId: string) => Promise<{ success: boolean; databases?: any[]; error?: string }>
      dbGetTables?: (connectionId: string, database: string) => Promise<{ success: boolean; tables?: any[]; error?: string }>
      dbGetColumns?: (connectionId: string, database: string, table: string) => Promise<{ success: boolean; columns?: any[]; error?: string }>
      dbGetProcedures?: (connectionId: string, database: string) => Promise<{ success: boolean; procedures?: any[]; error?: string }>
      dbGetTriggers?: (connectionId: string, database: string) => Promise<{ success: boolean; triggers?: any[]; error?: string }>
      dbGetDatabaseInfo?: (connectionId: string, database: string) => Promise<{ success: boolean; info?: any; error?: string }>
      dbGetTableData?: (connectionId: string, database: string, table: string, options?: { page?: number; pageSize?: number; orderBy?: string; orderDir?: 'ASC' | 'DESC' }) => Promise<{ success: boolean; data?: any[][]; columns?: string[]; total?: number; page?: number; pageSize?: number; error?: string }>
      dbGetTableStructure?: (connectionId: string, database: string, table: string) => Promise<{ success: boolean; columns?: any[]; indexes?: any[]; createStatement?: string; error?: string }>
      dbInsertRow?: (connectionId: string, database: string, table: string, rowData: Record<string, any>) => Promise<{ success: boolean; error?: string }>
      dbUpdateRow?: (connectionId: string, database: string, table: string, primaryKey: Record<string, any>, rowData: Record<string, any>) => Promise<{ success: boolean; error?: string }>
      dbDeleteRows?: (connectionId: string, database: string, table: string, primaryKeys: Record<string, any>[]) => Promise<{ success: boolean; deletedCount?: number; error?: string }>
    }
  }
}

export {}