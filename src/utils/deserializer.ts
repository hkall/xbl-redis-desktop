export const DESERIALIZATION_FORMATS = {
  auto: 'Auto Detect',
  json: 'JSON',
  base64: 'Base64',
  hex: 'Hex',
  url: 'URL Encoded',
  raw: 'Raw Text',
} as const

export type DeserializationFormat = keyof typeof DESERIALIZATION_FORMATS

export interface DeserializationOption {
  value: DeserializationFormat
  label: string
}

// Auto-detect format based on content
export function detectFormat(data: string): DeserializationFormat {
  const trimmed = data.trim()

  // Check for JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // Not valid JSON
    }
  }

  // Check for URL encoded
  if (/%[0-9A-F]{2}/i.test(trimmed)) {
    return 'url'
  }

  // Check for Hex (even number of hex chars, no spaces or with spaces)
  const hexNoSpaces = trimmed.replace(/\s/g, '')
  if (/^[0-9A-Fa-f]+$/.test(hexNoSpaces) && hexNoSpaces.length % 2 === 0 && hexNoSpaces.length > 0) {
    return 'hex'
  }

  // Check for Base64 (alphanumeric + + / =, length multiple of 4)
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length % 4 === 0 && trimmed.length > 0) {
    return 'base64'
  }

  // Default to raw text
  return 'raw'
}

export function isLikelyBinary(data: string): boolean {
  // Count non-printable characters
  let nonPrintable = 0
  for (let i = 0; i < Math.min(data.length, 1000); i++) {
    const code = data.charCodeAt(i)
    // Check for control characters except newline, tab, carriage return
    if (code < 32 && code !== 10 && code !== 13 && code !== 9) {
      nonPrintable++
    }
    // Check for high-byte characters that might indicate UTF-8 binary
    if (code > 127) {
      // Could be UTF-8, count but not as strong signal
    }
  }
  return nonPrintable > data.length * 0.1
}

// Deserialization functions
export function deserializeData(data: string, format: DeserializationFormat): {
  success: boolean
  data: any
  error?: string
} {
  try {
    switch (format) {
      case 'json':
        try {
          const parsed = JSON.parse(data)
          return { success: true, data: parsed }
        } catch (e) {
          return {
            success: false,
            data: data,
            error: 'Invalid JSON format'
          }
        }

      case 'base64':
        try {
          // Convert base64 to Uint8Array, then decode as UTF-8
          const binaryString = atob(data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          const decoder = new TextDecoder('utf-8')
          return { success: true, data: decoder.decode(bytes) }
        } catch {
          return { success: true, data: data } // Return as is if decode fails
        }

      case 'hex':
        try {
          const cleaned = data.replace(/\s/g, '')
          // Check if valid hex
          if (!/^[0-9A-Fa-f]+$/.test(cleaned)) {
            throw new Error('Invalid hex format')
          }
          // Convert hex string to Uint8Array, then decode as UTF-8
          const bytes = new Uint8Array(cleaned.length / 2)
          for (let i = 0; i < cleaned.length; i += 2) {
            bytes[i / 2] = parseInt(cleaned.substr(i, 2), 16)
          }
          const decoder = new TextDecoder('utf-8')
          return { success: true, data: decoder.decode(bytes) }
        } catch {
          return { success: true, data: data } // Return as is if decode fails
        }

      case 'url':
        try {
          const decoded = decodeURIComponent(data)
          return { success: true, data: decoded }
        } catch {
          return { success: true, data: data } // Return as is if decode fails
        }

      case 'auto':
        const detected = detectFormat(data)
        return deserializeData(data, detected)

      case 'raw':
      default:
        return { success: true, data: data }
    }
  } catch (error) {
    return {
      success: false,
      data: data,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function getDeserializationOptions(): DeserializationOption[] {
  return Object.entries(DESERIALIZATION_FORMATS).map(([value, label]) => ({
    value: value as DeserializationFormat,
    label,
  }))
}

// Custom JSON stringify with proper handling
export function customStringify(obj: any, indent: number = 2): string {
  return JSON.stringify(obj, (_key, val) => {
    if (typeof val === 'bigint') {
      return val.toString()
    }
    if (val === undefined) {
      return null
    }
    return val
  }, indent)
}

// Format data for display
export function formatDataForDisplay(data: any, _format: DeserializationFormat): string {
  if (data === null || data === undefined) {
    return ''
  }

  if (typeof data === 'string') {
    return data
  }

  // Use custom stringify with 2-space indentation for objects
  try {
    return customStringify(data, 2)
  } catch {
    return String(data)
  }
}