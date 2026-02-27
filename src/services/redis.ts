// Core Redis types for type-safe operations
import Redis from 'ioredis'

export type RedisDataType = 'string' | 'hash' | 'list' | 'set' | 'zset'

// Connection types
export interface StandaloneConfig {
  mode: 'standalone'
  host: string
  port: number
  password?: string
  db: number
}

export interface SentinelConfig {
  mode: 'sentinel'
  sentinels: Array<{ host: string; port: number }>
  name: string
  password?: string
  db: number
}

export interface ClusterConfig {
  mode: 'cluster'
  nodes: Array<{ host: string; port: number }>
  password?: string
  redisOptions?: { db: number }
}

export type RedisConnectionConfig = StandaloneConfig | SentinelConfig | ClusterConfig

// Key information
export interface RedisKeyInfo {
  name: string
  type: RedisDataType
  ttl: number
  size: number
}

// String operations
export async function getString(client: Redis, key: string): Promise<string | null> {
  return await client.get(key)
}

export async function setString(client: Redis, key: string, value: string): Promise<void> {
  await client.set(key, value)
}

// Hash operations - CRITICAL: Use H commands only
export interface HashField {
  field: string
  value: string
}

export async function getHash(client: Redis, key: string): Promise<Record<string, string>> {
  return await client.hgetall(key)
}

export async function getHashFields(client: Redis, key: string): Promise<HashField[]> {
  const data = await client.hgetall(key)
  return Object.entries(data).map(([field, value]) => ({ field, value }))
}

export async function setHashField(client: Redis, key: string, field: string, value: string): Promise<void> {
  await client.hset(key, field, value)
}

export async function deleteHashField(client: Redis, key: string, field: string): Promise<void> {
  await client.hdel(key, field)
}

export async function getHashSize(client: Redis, key: string): Promise<number> {
  return await client.hlen(key)
}

// List operations - CRITICAL: Use L commands only
export async function getList(client: Redis, key: string, start: number = 0, stop: number = -1): Promise<string[]> {
  return await client.lrange(key, start, stop)
}

export async function pushToList(client: Redis, key: string, value: string, direction: 'left' | 'right' = 'right'): Promise<void> {
  if (direction === 'left') {
    await client.lpush(key, value)
  } else {
    await client.rpush(key, value)
  }
}

export async function setListItem(client: Redis, key: string, index: number, value: string): Promise<void> {
  await client.lset(key, index, value)
}

export async function removeListItem(client: Redis, key: string, value: string, count: number = 0): Promise<number> {
  return await client.lrem(key, count, value)
}

export async function popListItem(client: Redis, key: string, direction: 'left' | 'right' = 'right'): Promise<string | null> {
  if (direction === 'left') {
    return await client.lpop(key)
  } else {
    return await client.rpop(key)
  }
}

export async function getListLength(client: Redis, key: string): Promise<number> {
  return await client.llen(key)
}

// Set operations - CRITICAL: Use S commands only, never use List commands
export async function getSet(client: Redis, key: string): Promise<Set<string>> {
  const members = await client.smembers(key)
  return new Set(members)
}

export async function getSetMembers(client: Redis, key: string): Promise<string[]> {
  return await client.smembers(key)
}

export async function addToSet(client: Redis, key: string, member: string): Promise<void> {
  await client.sadd(key, member)
}

export async function addMultipleToSet(client: Redis, key: string, members: string[]): Promise<void> {
  await client.sadd(key, ...members)
}

export async function removeFromSet(client: Redis, key: string, member: string): Promise<void> {
  await client.srem(key, member)
}

export async function removeMultipleFromSet(client: Redis, key: string, members: string[]): Promise<void> {
  await client.srem(key, ...members)
}

export async function isSetMember(client: Redis, key: string, member: string): Promise<boolean> {
  const result = await client.sismember(key, member)
  // sismember now returns an object but the type expects boolean
  // Cast the result to boolean for compatibility
  return result as unknown as boolean
}

export async function getSetSize(client: Redis, key: string): Promise<number> {
  return await client.scard(key)
}

// ZSet operations - CRITICAL: Scores must be preserved
export interface ZSetMember {
  member: string
  score: number
}

export async function getZSet(client: Redis, key: string, start: number = 0, stop: number = -1): Promise<ZSetMember[]> {
  const members = await client.zrange(key, start, stop, 'WITHSCORES')
  const result: ZSetMember[] = []

  for (let i = 0; i < members.length; i += 2) {
    result.push({
      member: members[i],
      score: parseFloat(members[i + 1]),
    })
  }

  return result
}

export async function addToZSet(client: Redis, key: string, member: string, score: number): Promise<void> {
  await client.zadd(key, score, member)
}

export async function updateZSetScore(client: Redis, key: string, member: string, score: number): Promise<void> {
  // ZADD updates the score if member exists, adds if not
  await client.zadd(key, score, member)
}

export async function removeFromZSet(client: Redis, key: string, member: string): Promise<void> {
  await client.zrem(key, member)
}

export async function getZSetScore(client: Redis, key: string, member: string): Promise<number | null> {
  const score = await client.zscore(key, member)
  return score ? parseFloat(score) : null
}

export async function getZSetRank(client: Redis, key: string, member: string): Promise<number | null> {
  return await client.zrank(key, member)
}

export async function getZSetSize(client: Redis, key: string): Promise<number> {
  return await client.zcard(key)
}

// Type detection and dispatch
export async function getKeyValue(client: Redis, key: string, type: RedisDataType) {
  switch (type) {
    case 'string':
      return await getString(client, key)

    case 'hash':
      return await getHashFields(client, key)

    case 'list':
      return await getList(client, key)

    case 'set':
      return await getSetMembers(client, key)

    case 'zset':
      return await getZSet(client, key)

    default:
      throw new Error(`Unsupported Redis data type: ${type}`)
  }
}

// TTL operations
export async function getTTL(client: Redis, key: string): Promise<number> {
  return await client.ttl(key)
}

export async function setTTL(client: Redis, key: string, seconds: number): Promise<void> {
  await client.expire(key, seconds)
}

export async function clearTTL(client: Redis, key: string): Promise<void> {
  await client.persist(key)
}

// Key operations
export async function getKeyType(client: Redis, key: string): Promise<RedisDataType | null> {
  const type = await client.type(key)
  if (type === 'none') return null
  return type as RedisDataType
}

export async function deleteKey(client: Redis, key: string): Promise<void> {
  await client.del(key)
}

export async function renameKey(client: Redis, key: string, newKey: string): Promise<void> {
  await client.rename(key, newKey)
}

// SCAN-based key listing (performance-safe)
export async function scanKeys(
  client: Redis,
  pattern: string = '*',
  count: number = 100,
  typeFilter?: RedisDataType
): Promise<string[]> {
  const keys: string[] = []
  let cursor = '0'

  do {
    const [nextCursor, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', count)

    // Filter by type if specified
    if (typeFilter) {
      const types = await client.mget('type', ...batch)
      for (let i = 0; i < batch.length; i++) {
        if (types[i] === typeFilter) {
          keys.push(batch[i])
        }
      }
    } else {
      keys.push(...batch)
    }

    cursor = nextCursor
  } while (cursor !== '0')

  return keys
}

// Get key info with type, ttl, and size
export async function getKeyInfo(client: Redis, key: string): Promise<RedisKeyInfo | null> {
  const [typeResult, ttlResult, sizeResult] = await Promise.all([
    client.type(key).then(t => t === 'none' ? null : t as RedisDataType),
    client.ttl(key),
    getKeySize(client, key),
  ])

  if (!typeResult) return null

  return {
    name: key,
    type: typeResult,
    ttl: ttlResult,
    size: sizeResult,
  }
}

// Get size based on type
async function getKeySize(client: Redis, key: string): Promise<number> {
  const type = await client.type(key)

  switch (type) {
    case 'string':
      const value = await client.get(key)
      return value ? value.length : 0

    case 'hash':
      return await client.hlen(key)

    case 'list':
      return await client.llen(key)

    case 'set':
      return await client.scard(key)

    case 'zset':
      return await client.zcard(key)

    default:
      return 0
  }
}

// Connect to Redis based on configuration
export async function createRedisConnection(config: RedisConnectionConfig): Promise<Redis> {
  switch (config.mode) {
    case 'standalone':
      return new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        lazyConnect: true,
      })

    case 'sentinel':
      return new Redis({
        sentinels: config.sentinels,
        name: config.name,
        password: config.password,
        db: config.db,
        lazyConnect: true,
      })

    case 'cluster':
      return new Redis.Cluster(
        config.nodes,
        {
          redisOptions: {
            password: config.password,
            ...(config.redisOptions || {}),
          },
        }
      ) as unknown as Redis

    default:
      throw new Error(`Unknown connection mode: ${(config as any).mode}`)
  }
}