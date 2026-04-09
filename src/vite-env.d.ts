declare global {
  interface Window {
    electronAPI: {
      redisTest: (config: { host: string; port: number; password?: string; db: number }) => Promise<{ success: boolean; error?: string }>
      redisConnect: (id: string, config: { host: string; port: number; password?: string; db: number }) => Promise<{ success: boolean; error?: string }>
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
      redisHscan: (id: string, key: string, cursor?: string, count?: number) => Promise<{ success: boolean; data?: any; error?: string }>
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
      dbCreateConnection?: (config: any) => Promise<{ success: boolean; connectionId?: string; error?: string }>
      dbCloseConnection?: (connectionId: string) => Promise<void>
      dbTestConnection?: (config: any) => Promise<{ success: boolean; error?: string; serverVersion?: string; serverType?: string }>
      dbExecuteQuery?: (connectionId: string, sql: string, database?: string) => Promise<any>
      dbExecuteBatch?: (connectionId: string, sqls: string[], database?: string) => Promise<any>
      dbGetDatabases?: (connectionId: string) => Promise<{ success: boolean; databases?: any[]; error?: string }>
      dbGetTables?: (connectionId: string, database: string) => Promise<{ success: boolean; tables?: any[]; error?: string }>
      dbGetColumns?: (connectionId: string, database: string, table: string) => Promise<{ success: boolean; columns?: any[]; error?: string }>
      dbGetIndexes?: (connectionId: string, database: string, table: string) => Promise<{ success: boolean; indexes?: any[]; error?: string }>
      dbGetForeignKeys?: (connectionId: string, database: string, table: string) => Promise<{ success: boolean; foreignKeys?: any[]; error?: string }>
      dbGetTableStructure?: (connectionId: string, database: string, table: string) => Promise<{ success: boolean; structure?: any; error?: string }>
      dbGetTableData?: (connectionId: string, database: string, table: string, options: any) => Promise<{ success: boolean; data?: any[][]; columns?: string[]; totalRows?: number; error?: string }>
      dbExportData?: (connectionId: string, database: string, table: string, config: any) => Promise<{ success: boolean; data?: string; error?: string }>
      dbImportData?: (connectionId: string, database: string, table: string, config: any) => Promise<{ success: boolean; importedRows?: number; error?: string }>
    }
  }
}

export {}