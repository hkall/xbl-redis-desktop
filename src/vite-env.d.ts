declare global {
  interface Window {
    electronAPI: {
      redisTest: (config: { host: string; port: number; password?: string; db: number }) => Promise<{ success: boolean; error?: string }>
      redisConnect: (id: string, config: { host: string; port: number; password?: string; db: number }) => Promise<{ success: boolean; error?: string }>
      redisDisconnect: (id: string) => Promise<{ success: boolean; error?: string }>
      redisScan: (id: string, pattern?: string, count?: number) => Promise<{ success: boolean; data?: string[]; error?: string }>
      redisKeyInfo: (id: string, key: string) => Promise<{ success: boolean; data?: any; error?: string }>
      redisGet: (id: string, key: string) => Promise<{ success: boolean; data?: any; error?: string }>
      redisSet: (id: string, key: string, type: string, value: any) => Promise<{ success: boolean; error?: string }>
      redisDelete: (id: string, key: string) => Promise<{ success: boolean; error?: string }>
      redisRename: (id: string, key: string, newKey: string) => Promise<{ success: boolean; error?: string }>
      redisSetTTL: (id: string, key: string, seconds: number) => Promise<{ success: boolean; error?: string }>
      redisClearTTL: (id: string, key: string) => Promise<{ success: boolean; error?: string }>
      redisInfo: (id: string) => Promise<{ success: boolean; data?: Record<string, number>; error?: string }>
      javaDeserialize: (byteArray: number[]) => Promise<{ success: boolean; data?: any; error?: string }>
    }
  }
}

export {}