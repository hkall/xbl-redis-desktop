import React, { useState, useEffect } from 'react'
import { RefreshCw, Database, Zap, Circle, CheckCircle, AlertTriangle, Activity, Clock, Shield, Code, Server, TrendingUp, Hash, Command, Timer, Ban, HardDrive, Save, FileBox } from 'lucide-react'
import { useRedisStore } from '@/store/redisStore'

interface ServerInfoProps {
  connectionId: string | null
  fullMode?: boolean
}

interface ServerData {
  section: string
  data: Record<string, string>
}

// Friendly field names - 精简到最核心的指标
const CORE_METRICS = {
  // Performance
  instantaneous_ops_per_sec: { name: '每秒操作数', icon: Zap, category: 'performance', format: 'ops' },
  keyspace_hits: { name: '缓存命中', icon: CheckCircle, category: 'performance' },
  keyspace_misses: { name: '缓存未命中', icon: AlertTriangle, category: 'performance' },
  hit_rate: { name: '命中率', icon: TrendingUp, category: 'performance', format: 'percent', computed: true },

  // Memory
  used_memory: { name: '已用内存', icon: Database, category: 'memory', format: 'bytes' },
  used_memory_peak: { name: '峰值内存', icon: Database, category: 'memory', format: 'bytes' },
  maxmemory: { name: '内存限制', icon: Database, category: 'memory', format: 'bytes' },
  maxmemory_policy: { name: '淘汰策略', icon: Shield, category: 'memory' },
  mem_fragmentation_ratio: { name: '碎片率', icon: AlertTriangle, category: 'memory', format: 'ratio' },
  evicted_keys: { name: '已淘汰键', icon: AlertTriangle, category: 'memory', format: 'count' },

  // Server
  redis_version: { name: 'Redis 版本', icon: Code, category: 'server' },
  uptime_in_seconds: { name: '运行时间', icon: Clock, category: 'server', format: 'uptime' },
  connected_clients: { name: '客户端连接', icon: Activity, category: 'server' },

  // Keys & Stats
  db_keys: { name: '总键数', icon: Hash, category: 'stats', format: 'count', computed: true },
  total_commands_processed: { name: '总命令数', icon: Command, category: 'stats', format: 'count' },
  expired_keys: { name: '过期键数', icon: Timer, category: 'stats', format: 'count' },
  rejected_connections: { name: '拒绝连接', icon: Ban, category: 'stats', format: 'count' },
  rdb_last_save_time: { name: '最后保存', icon: Save, category: 'stats', format: 'timeago' },
}

const CATEGORY_COLORS = {
  performance: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-700',
    text: 'text-green-700 dark:text-green-400',
    icon: 'text-green-600 dark:text-green-400',
  },
  memory: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-400',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  server: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-700',
    text: 'text-purple-700 dark:text-purple-400',
    icon: 'text-purple-600 dark:text-purple-400',
  },
  stats: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-400',
    icon: 'text-amber-600 dark:text-amber-400',
  },
}

export default function ServerInfo({ connectionId, fullMode }: ServerInfoProps) {
  const { connections } = useRedisStore()
  const [loading, setLoading] = useState(false)
  const [serverInfo, setServerInfo] = useState<Record<string, string>>({})
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Get connection status
  const activeConnection = connectionId
    ? connections.find((c) => c.id === connectionId)
    : null
  const isConnected = activeConnection?.connected || false

  useEffect(() => {
    if (connectionId && isConnected) {
      loadServerInfo()
    }
  }, [connectionId, isConnected])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh && connectionId) {
      interval = setInterval(() => loadServerInfo(false), 5000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, connectionId])

  const loadServerInfo = async (showLoading = true) => {
    if (!connectionId || !window.electronAPI?.redisGetServerInfo) return

    if (showLoading) setLoading(true)
    try {
      const result = await window.electronAPI.redisGetServerInfo(connectionId, 'default')

      if (result.success && result.data) {
        // Flatten all data into a single object
        const allMetrics: Record<string, string> = {}
        Object.values(result.data).forEach((section: any) => {
          if (section && typeof section === 'object') {
            Object.entries(section).forEach(([key, value]) => {
              allMetrics[key] = String(value)
            })
          }
        })
        setServerInfo(allMetrics)
      }
    } catch (error) {
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const formatValue = (key: string, value: string, formatType?: string) => {
    const num = parseFloat(value)

    if (formatType === 'bytes') {
      const bytes = parseInt(value) || 0
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
    }

    if (formatType === 'ratio') {
      const ratio = parseFloat(value)
      return isNaN(ratio) ? 'N/A' : ratio.toFixed(2)
    }

    if (formatType === 'uptime') {
      const seconds = parseInt(value) || 0
      if (seconds < 60) return `${seconds}s`
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${(seconds % 60)}s`
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
      return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
    }

    if (formatType === 'ops') {
      return (parseInt(value) || 0).toLocaleString()
    }

    if (formatType === 'count') {
      return (parseInt(value) || 0).toLocaleString()
    }

    if (formatType === 'percent') {
      return value
    }

    if (formatType === 'timeago') {
      const timestamp = parseInt(value) || 0
      if (timestamp === 0) return 'N/A'
      const now = Math.floor(Date.now() / 1000)
      const diff = now - timestamp
      if (diff < 60) return `${diff}s ago`
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
      return `${Math.floor(diff / 86400)}d ago`
    }

    return value
  }

  const getMetricStatus = (key: string, value: string) => {
    const num = parseFloat(value)

    // Memory fragmentation ratio warning
    if (key === 'mem_fragmentation_ratio') {
      if (num > 2) return { status: 'critical', bg: 'bg-red-100 dark:bg-red-900/30' }
      if (num > 1.5) return { status: 'warning', bg: 'bg-orange-100 dark:bg-orange-900/30' }
      return { status: 'ok', bg: 'bg-green-100 dark:bg-green-900/30' }
    }

    // Evicted keys warning
    if (key === 'evicted_keys' && num > 0) {
      return { status: 'warning', bg: 'bg-orange-100 dark:bg-orange-900/30' }
    }

    // High ops/s is good
    if (key === 'instantaneous_ops_per_sec' && num > 1000) {
      return { status: 'good', bg: 'bg-green-100 dark:bg-green-900/30' }
    }

    return { status: 'neutral', bg: 'bg-gray-100 dark:bg-gray-800' }
  }

  // Compute derived metrics
  const getComputedValue = (key: string): string => {
    if (key === 'hit_rate') {
      const hits = parseInt(serverInfo['keyspace_hits'] || '0')
      const misses = parseInt(serverInfo['keyspace_misses'] || '0')
      const total = hits + misses
      if (total === 0) return '0%'
      return `${((hits / total) * 100).toFixed(1)}%`
    }
    if (key === 'db_keys') {
      // Parse db0:keys=XXX,expires=XXX format
      const db0 = serverInfo['db0']
      if (db0) {
        const match = db0.match(/keys=(\d+)/)
        if (match) return match[1]
      }
      // Try other db keys
      for (let i = 0; i < 16; i++) {
        const db = serverInfo[`db${i}`]
        if (db) {
          const match = db.match(/keys=(\d+)/)
          if (match) return match[1]
        }
      }
      return '0'
    }
    return '0'
  }

  // Get metric value (computed or direct)
  const getMetricValue = (key: string, config: any): string => {
    if (config.computed) {
      return getComputedValue(key)
    }
    return serverInfo[key] || '0'
  }

  const getCategoryIcon = (icon?: any, category?: string) => {
    if (icon) return icon
    return Circle
  }

  // Get persistence info from server info
  const getPersistenceInfo = () => {
    const rdbEnabled = serverInfo['rdb_last_save_time'] !== undefined
    const aofEnabled = serverInfo['aof_enabled'] === '1'
    const rdbLastSave = serverInfo['rdb_last_save_time']
    const rdbChanges = serverInfo['rdb_changes_since_last_save'] || '0'
    const rdbStatus = serverInfo['rdb_last_bgsave_status'] || 'ok'
    const aofRewriteInProgress = serverInfo['aof_rewrite_in_progress'] === '1'
    const aofLastRewriteTime = serverInfo['aof_last_rewrite_time_sec'] || '0'
    const aofStatus = serverInfo['aof_last_bgrewrite_status'] || 'ok'
    const aofCurrentSize = serverInfo['aof_current_size']
    const aofBaseSize = serverInfo['aof_base_size']

    // Determine persistence mode
    let persistenceMode = '无持久化'
    if (rdbEnabled && aofEnabled) {
      persistenceMode = '混合模式 (RDB + AOF)'
    } else if (aofEnabled) {
      persistenceMode = 'AOF'
    } else if (rdbEnabled) {
      persistenceMode = 'RDB'
    }

    return {
      rdbEnabled,
      aofEnabled,
      persistenceMode,
      rdbLastSave,
      rdbChanges,
      rdbStatus,
      aofRewriteInProgress,
      aofLastRewriteTime,
      aofStatus,
      aofCurrentSize,
      aofBaseSize
    }
  }

  const persistenceInfo = getPersistenceInfo()

  if (!connectionId) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Please connect to a Redis server first</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Control Bar */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">实时监控</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${autoRefresh ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
            {autoRefresh ? '自动刷新' : '手动'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              autoRefresh
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {autoRefresh ? '暂停' : '自动'}
          </button>
          <button
            onClick={() => loadServerInfo()}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && Object.keys(serverInfo).length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Performance Metrics */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">性能指标</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(CORE_METRICS)
                  .filter(([_, config]) => config.category === 'performance')
                  .map(([key, config]) => {
                    const Icon = getCategoryIcon(config.icon, config.category)
                    const value = getMetricValue(key, config)
                    const status = getMetricStatus(key, value)
                    const formatted = formatValue(key, value, config.format)

                    return (
                      <div key={key} className={`${status.bg} rounded-lg p-3`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
                          <span className="text-xs text-green-700/80 dark:text-green-400/80">{config.name}</span>
                        </div>
                        <div className="text-lg font-bold text-green-900 dark:text-green-100">
                          {formatted}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Memory Metrics */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">内存使用</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(CORE_METRICS)
                  .filter(([_, config]) => config.category === 'memory')
                  .map(([key, config]) => {
                    const Icon = getCategoryIcon(config.icon, config.category)
                    const value = serverInfo[key] || '0'
                    const status = getMetricStatus(key, value)
                    const formatted = formatValue(key, value, config.format)

                    return (
                      <div key={key} className={`${status.bg} rounded-lg p-3`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs text-blue-700/80 dark:text-blue-400/80">{config.name}</span>
                        </div>
                        <div className={`text-base font-bold ${
                          status.status === 'critical' ? 'text-red-600 dark:text-red-400' :
                          status.status === 'warning' ? 'text-orange-600 dark:text-orange-400' :
                          'text-blue-900 dark:text-blue-100'
                        }`}>
                          {formatted}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Server Metrics */}
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100">服务器信息</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(CORE_METRICS)
                  .filter(([_, config]) => config.category === 'server')
                  .map(([key, config]) => {
                    const Icon = getCategoryIcon(config.icon, config.category)
                    const value = serverInfo[key] || '0'
                    const formatted = formatValue(key, value, config.format)

                    return (
                      <div key={key} className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span className="text-xs text-purple-700/80 dark:text-purple-400/80">{config.name}</span>
                        </div>
                        <div className="text-base font-bold text-purple-900 dark:text-purple-100">
                          {formatted}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Stats Metrics */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">数据统计</h3>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(CORE_METRICS)
                  .filter(([_, config]) => config.category === 'stats')
                  .map(([key, config]) => {
                    const Icon = getCategoryIcon(config.icon, config.category)
                    const value = getMetricValue(key, config)
                    const formatted = formatValue(key, value, config.format)

                    return (
                      <div key={key} className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs text-amber-700/80 dark:text-amber-400/80">{config.name}</span>
                        </div>
                        <div className="text-base font-bold text-amber-900 dark:text-amber-100">
                          {formatted}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Persistence Metrics */}
            <div className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border border-cyan-200 dark:border-cyan-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileBox className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <h3 className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">持久化备份</h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  persistenceInfo.persistenceMode === '无持久化'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                }`}>
                  {persistenceInfo.persistenceMode}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* RDB Section */}
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-sm font-medium text-cyan-900 dark:text-cyan-100">RDB 快照</span>
                    {persistenceInfo.rdbEnabled ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-cyan-700/70 dark:text-cyan-400/70">最后保存</span>
                      <span className="text-cyan-900 dark:text-cyan-100 font-medium">
                        {formatValue('rdb_last_save_time', persistenceInfo.rdbLastSave || '0', 'timeago')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cyan-700/70 dark:text-cyan-400/70">变更次数</span>
                      <span className="text-cyan-900 dark:text-cyan-100 font-medium">{persistenceInfo.rdbChanges}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cyan-700/70 dark:text-cyan-400/70">保存状态</span>
                      <span className={`font-medium ${persistenceInfo.rdbStatus === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {persistenceInfo.rdbStatus === 'ok' ? '正常' : '异常'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AOF Section */}
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Save className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-sm font-medium text-cyan-900 dark:text-cyan-100">AOF 日志</span>
                    {persistenceInfo.aofEnabled ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-cyan-700/70 dark:text-cyan-400/70">启用状态</span>
                      <span className={`font-medium ${persistenceInfo.aofEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                        {persistenceInfo.aofEnabled ? '已启用' : '未启用'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cyan-700/70 dark:text-cyan-400/70">重写状态</span>
                      <span className="text-cyan-900 dark:text-cyan-100 font-medium">
                        {persistenceInfo.aofRewriteInProgress ? '进行中...' : '空闲'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cyan-700/70 dark:text-cyan-400/70">重写状态</span>
                      <span className={`font-medium ${persistenceInfo.aofStatus === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {persistenceInfo.aofStatus === 'ok' ? '正常' : '异常'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="mt-3 p-2 bg-cyan-100/50 dark:bg-cyan-900/20 rounded-lg">
                <p className="text-xs text-cyan-700 dark:text-cyan-300">
                  💡 提示：RDB 文件通常位于 Redis 服务器的 dump.rdb，AOF 文件为 appendonly.aof。
                  请通过服务器端进行备份和恢复操作。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 h-[52px] px-4 border-t border-black/10 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span>{Object.keys(serverInfo).length} 项指标</span>
        <span>数据每5秒更新</span>
      </div>
    </div>
  )
}