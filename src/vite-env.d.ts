declare global {
  interface Window {
    electronAPI: {
      redisTest: (config: { host: string; port: number; password?: string; db: number }) => Promise<{ success: boolean; error?: string }>
      redisConnect: (id: string, config: { host: string; port: number; password?: string; db: number }) => Promise<{ success: boolean; error?: string }>
      redisDisconnect: (id: string) => Promise<{ success: boolean; error?: string }>
      redisScan: (id: string, pattern?: string, count?: number) => Promise<{ success: boolean; data?: string[]; cursor?: string; error?: string }>
      redisKeyInfo: (id: string, key: string) => Promise<{ success: boolean; data?: any; error?: string }>
      redisGet: (id: string, key: string) => Promise<{ success: boolean; data?: any; encoding?: string; isJavaSerialization?: boolean; error?: string }>
      redisSet: (id: string, key: string, type: string, value: any) => Promise<{ success: boolean; error?: string }>
      redisDelete: (id: string, key: string) => Promise<{ success: boolean; error?: string }>
      redisRename: (id: string, key: string, newKey: string) => Promise<{ success: boolean; error?: string }>
      redisSetTTL: (id: string, key: string, seconds: number) => Promise<{ success: boolean; error?: string }>
      redisClearTTL: (id: string, key: string) => Promise<{ success: boolean; error?: string }>
      redisInfo: (id: string) => Promise<{ success: boolean; data?: Record<string, number>; error?: string }>
      redisSelectDb: (id: string, db: number) => Promise<{ success: boolean; error?: string }>
      redisExecuteCommand: (id: string, command: string) => Promise<{ success: boolean; data?: any; encoding?: string; command?: string; error?: string }>
      redisGetServerInfo: (id: string, section?: string) => Promise<{ success: boolean; data?: any; error?: string }>
      javaDeserialize: (byteArray: number[]) => Promise<{ success: boolean; data?: any; error?: string }>
      createAndDownloadArchive: (options: { filename: string; files: { name: string; content: string }[] }) => Promise<{ success: boolean; error?: string }>
      saveConfig: (key: string, data: any) => Promise<{ success: boolean; error?: string }>
      loadConfig: (key: string) => Promise<{ success: boolean; data?: any; error?: string }>
      getUserDataPath: () => Promise<string>
      openExternal: (url: string) => Promise<void>
    }
  }
}

export {}