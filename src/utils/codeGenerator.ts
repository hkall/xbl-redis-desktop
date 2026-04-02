import { SavedRequest } from '@/store/types'

export type CodeTarget = 'curl' | 'fetch' | 'axios' | 'javascript'

export function generateCode(request: SavedRequest, target: CodeTarget): string {
  switch (target) {
    case 'curl':
      return generateCurl(request)
    case 'fetch':
      return generateFetch(request)
    case 'axios':
      return generateAxios(request)
    case 'javascript':
      return generateJavascript(request)
    default:
      return ''
  }
}

function generateCurl(request: SavedRequest): string {
  const lines: string[] = []

  // 基本命令
  lines.push(`curl -X ${request.method} '${request.url}'`)

  // Headers
  const enabledHeaders = request.headers.filter(h => h.enabled && h.key)
  enabledHeaders.forEach(h => {
    lines.push(`  -H '${h.key}: ${escapeShell(h.value)}'`)
  })

  // Auth
  if (request.auth.type === 'bearer' && request.auth.token) {
    lines.push(`  -H 'Authorization: Bearer ${escapeShell(request.auth.token)}'`)
  } else if (request.auth.type === 'basic' && request.auth.username) {
    lines.push(`  -u '${escapeShell(request.auth.username)}:${escapeShell(request.auth.password || '')}'`)
  } else if (request.auth.type === 'api-key' && request.auth.apiKeyName && request.auth.apiKeyValue) {
    if (request.auth.apiKeyLocation !== 'query') {
      lines.push(`  -H '${escapeShell(request.auth.apiKeyName)}: ${escapeShell(request.auth.apiKeyValue)}'`)
    }
  }

  // Body
  if (request.body.type === 'json' && request.body.content) {
    lines.push(`  -H 'Content-Type: application/json'`)
    lines.push(`  -d '${escapeShell(request.body.content)}'`)
  } else if (request.body.type === 'x-www-form-urlencoded') {
    lines.push(`  -H 'Content-Type: application/x-www-form-urlencoded'`)
    const params = (request.body.formData || [])
      .filter(f => f.enabled && f.key && f.type === 'text')
      .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join('&')
    if (params) lines.push(`  -d '${params}'`)
  } else if (request.body.type === 'raw' && request.body.content) {
    const contentType = request.body.rawType === 'xml' ? 'application/xml'
      : request.body.rawType === 'html' ? 'text/html'
      : request.body.rawType === 'javascript' ? 'application/javascript'
      : 'text/plain'
    lines.push(`  -H 'Content-Type: ${contentType}'`)
    lines.push(`  -d '${escapeShell(request.body.content)}'`)
  }

  return lines.join(' \\\n')
}

function generateFetch(request: SavedRequest): string {
  const lines: string[] = []

  // 构建URL
  let url = request.url
  const enabledParams = request.params.filter(p => p.enabled && p.key)
  if (enabledParams.length > 0) {
    const searchParams = enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    url += (url.includes('?') ? '&' : '?') + searchParams
  }

  // Auth query param
  if (request.auth.type === 'api-key' && request.auth.apiKeyName && request.auth.apiKeyValue && request.auth.apiKeyLocation === 'query') {
    url += (url.includes('?') ? '&' : '?') + `${encodeURIComponent(request.auth.apiKeyName)}=${encodeURIComponent(request.auth.apiKeyValue)}`
  }

  lines.push(`fetch('${url}', {`)
  lines.push(`  method: '${request.method}',`)

  // Headers
  const headers: Record<string, string> = {}
  request.headers.filter(h => h.enabled && h.key).forEach(h => {
    headers[h.key] = h.value
  })

  // Auth headers
  if (request.auth.type === 'bearer' && request.auth.token) {
    headers['Authorization'] = `Bearer ${request.auth.token}`
  } else if (request.auth.type === 'basic' && request.auth.username) {
    const credentials = btoa(`${request.auth.username}:${request.auth.password || ''}`)
    headers['Authorization'] = `Basic ${credentials}`
  } else if (request.auth.type === 'api-key' && request.auth.apiKeyName && request.auth.apiKeyValue && request.auth.apiKeyLocation !== 'query') {
    headers[request.auth.apiKeyName] = request.auth.apiKeyValue
  }

  if (Object.keys(headers).length > 0) {
    lines.push(`  headers: {`)
    Object.entries(headers).forEach(([key, value], index, arr) => {
      lines.push(`    '${key}': '${escapeJs(value)}'${index < arr.length - 1 ? ',' : ''}`)
    })
    lines.push(`  },`)
  }

  // Body
  if (request.body.type === 'json' && request.body.content) {
    lines.push(`  body: JSON.stringify(${request.body.content}),`)
  } else if (request.body.type === 'x-www-form-urlencoded') {
    const params = (request.body.formData || [])
      .filter(f => f.enabled && f.key && f.type === 'text')
      .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join('&')
    if (params) lines.push(`  body: '${params}',`)
  } else if (request.body.type === 'raw' && request.body.content) {
    lines.push(`  body: \`${request.body.content.replace(/`/g, '\\`')}\`,`)
  }

  lines.push(`})`)
  lines.push(`  .then(response => response.json())`)
  lines.push(`  .then(data => console.log(data))`)
  lines.push(`  .catch(error => console.error('Error:', error));`)

  return lines.join('\n')
}

function generateAxios(request: SavedRequest): string {
  const lines: string[] = []

  lines.push(`import axios from 'axios';`)
  lines.push('')
  lines.push(`axios({`)
  lines.push(`  method: '${request.method}',`)
  lines.push(`  url: '${request.url}',`)

  // Params
  const enabledParams = request.params.filter(p => p.enabled && p.key)
  if (enabledParams.length > 0) {
    lines.push(`  params: {`)
    enabledParams.forEach((p, index, arr) => {
      lines.push(`    ${p.key}: '${escapeJs(p.value)}'${index < arr.length - 1 ? ',' : ''}`)
    })
    lines.push(`  },`)
  }

  // Headers
  const headers: Record<string, string> = {}
  request.headers.filter(h => h.enabled && h.key).forEach(h => {
    headers[h.key] = h.value
  })

  // Auth headers
  if (request.auth.type === 'bearer' && request.auth.token) {
    headers['Authorization'] = `Bearer ${request.auth.token}`
  } else if (request.auth.type === 'basic' && request.auth.username) {
    const credentials = btoa(`${request.auth.username}:${request.auth.password || ''}`)
    headers['Authorization'] = `Basic ${credentials}`
  } else if (request.auth.type === 'api-key' && request.auth.apiKeyName && request.auth.apiKeyValue) {
    if (request.auth.apiKeyLocation === 'query') {
      lines.push(`  params: {`)
      lines.push(`    ...params,`)
      lines.push(`    ${request.auth.apiKeyName}: '${escapeJs(request.auth.apiKeyValue)}'`)
      lines.push(`  },`)
    } else {
      headers[request.auth.apiKeyName] = request.auth.apiKeyValue
    }
  }

  if (Object.keys(headers).length > 0) {
    lines.push(`  headers: {`)
    Object.entries(headers).forEach(([key, value], index, arr) => {
      lines.push(`    '${key}': '${escapeJs(value)}'${index < arr.length - 1 ? ',' : ''}`)
    })
    lines.push(`  },`)
  }

  // Data/Body
  if (request.body.type === 'json' && request.body.content) {
    lines.push(`  data: ${request.body.content},`)
  } else if (request.body.type === 'x-www-form-urlencoded') {
    lines.push(`  data: new URLSearchParams({`)
    const formData = request.body.formData?.filter(f => f.enabled && f.key && f.type === 'text') || []
    formData.forEach((f, index, arr) => {
      lines.push(`    ${f.key}: '${escapeJs(f.value)}'${index < arr.length - 1 ? ',' : ''}`)
    })
    lines.push(`  }),`)
  } else if (request.body.type === 'form-data') {
    lines.push(`  data: new FormData(),`)
    lines.push(`  // Note: Add form fields manually`)
  } else if (request.body.type === 'raw' && request.body.content) {
    lines.push(`  data: \`${request.body.content.replace(/`/g, '\\`')}\`,`)
  }

  lines.push(`})`)
  lines.push(`.then(response => {`)
  lines.push(`  console.log(response.data);`)
  lines.push(`})`)
  lines.push(`.catch(error => {`)
  lines.push(`  console.error('Error:', error);`)
  lines.push(`});`)

  return lines.join('\n')
}

function generateJavascript(request: SavedRequest): string {
  const lines: string[] = []

  // 构建URL
  let url = request.url
  const enabledParams = request.params.filter(p => p.enabled && p.key)
  if (enabledParams.length > 0) {
    const searchParams = enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    url += (url.includes('?') ? '&' : '?') + searchParams
  }

  // Auth query param
  if (request.auth.type === 'api-key' && request.auth.apiKeyName && request.auth.apiKeyValue && request.auth.apiKeyLocation === 'query') {
    url += (url.includes('?') ? '&' : '?') + `${encodeURIComponent(request.auth.apiKeyName)}=${encodeURIComponent(request.auth.apiKeyValue)}`
  }

  lines.push(`const xhr = new XMLHttpRequest();`)
  lines.push(`xhr.open('${request.method}', '${url}', true);`)

  // Headers
  request.headers.filter(h => h.enabled && h.key).forEach(h => {
    lines.push(`xhr.setRequestHeader('${h.key}', '${escapeJs(h.value)}');`)
  })

  // Auth headers
  if (request.auth.type === 'bearer' && request.auth.token) {
    lines.push(`xhr.setRequestHeader('Authorization', 'Bearer ${escapeJs(request.auth.token)}');`)
  } else if (request.auth.type === 'basic' && request.auth.username) {
    lines.push(`xhr.setRequestHeader('Authorization', 'Basic ' + btoa('${escapeJs(request.auth.username)}:${escapeJs(request.auth.password || '')}'));`)
  } else if (request.auth.type === 'api-key' && request.auth.apiKeyName && request.auth.apiKeyValue && request.auth.apiKeyLocation !== 'query') {
    lines.push(`xhr.setRequestHeader('${escapeJs(request.auth.apiKeyName)}', '${escapeJs(request.auth.apiKeyValue)}');`)
  }

  lines.push(`xhr.onload = function() {`)
  lines.push(`  if (xhr.status >= 200 && xhr.status < 300) {`)
  lines.push(`    console.log(JSON.parse(xhr.responseText));`)
  lines.push(`  } else {`)
  lines.push(`    console.error('Error:', xhr.statusText);`)
  lines.push(`  }`)
  lines.push(`};`)
  lines.push(`xhr.onerror = function() {`)
  lines.push(`  console.error('Network error');`)
  lines.push(`};`)

  // Body
  if (request.body.type === 'json' && request.body.content) {
    lines.push(`xhr.setRequestHeader('Content-Type', 'application/json');`)
    lines.push(`xhr.send(JSON.stringify(${request.body.content}));`)
  } else if (request.body.type === 'x-www-form-urlencoded') {
    lines.push(`xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');`)
    const params = (request.body.formData || [])
      .filter(f => f.enabled && f.key && f.type === 'text')
      .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join('&')
    if (params) lines.push(`xhr.send('${params}');`)
    else lines.push(`xhr.send();`)
  } else if (request.body.type === 'raw' && request.body.content) {
    const contentType = request.body.rawType === 'xml' ? 'application/xml'
      : request.body.rawType === 'html' ? 'text/html'
      : request.body.rawType === 'javascript' ? 'application/javascript'
      : 'text/plain'
    lines.push(`xhr.setRequestHeader('Content-Type', '${contentType}');`)
    lines.push(`xhr.send(\`${request.body.content.replace(/`/g, '\\`')}\`);`)
  } else {
    lines.push(`xhr.send();`)
  }

  return lines.join('\n')
}

function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''")
}

function escapeJs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n')
}