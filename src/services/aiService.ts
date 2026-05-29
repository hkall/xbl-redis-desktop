import { AIConfig, AIProvider, AI_PROVIDER_CONFIGS, AIRequestParams, AIResponse, TableSchemaInfo, DatabaseTableInfo } from '@/store/aiStore'

// ============ SQL清理和提取 ============

// 从AI输出中提取纯SQL语句
export const extractPureSQL = (content: string): string => {
  let sql = content.trim()

  // 移除markdown代码块标记
  sql = sql.replace(/```sql\n?/gi, '').replace(/```mysql\n?/gi, '').replace(/```\n?/g, '')

  // 移除常见的解释文字前缀
  const prefixes = [
    /^(以下是|这是|生成的SQL|SQL语句|查询语句|结果为)[:：]?\s*/gm,
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|SHOW|DESCRIBE|EXPLAIN)/gm,
  ]

  // 提取SQL语句（从第一个SQL关键字开始）
  const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'WITH', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'TRUNCATE']
  const lines = sql.split('\n')
  let sqlStarted = false
  let sqlLines: string[] = []
  let commentLines: string[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    // 检查是否是SQL开始
    const isSqlStart = sqlKeywords.some(kw => trimmedLine.toUpperCase().startsWith(kw))
    // 检查是否是注释或说明
    const isComment = trimmedLine.startsWith('--') || trimmedLine.startsWith('#') || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')

    if (isSqlStart && !sqlStarted) {
      sqlStarted = true
      sqlLines.push(line)
    } else if (sqlStarted) {
      // SQL开始后，收集所有行（包括注释）
      sqlLines.push(line)
    } else if (isComment && !sqlStarted) {
      // SQL开始前的注释，可能是SQL的一部分（注释说明）
      commentLines.push(line)
    }
  }

  // 如果找到了SQL，返回SQL部分
  if (sqlLines.length > 0) {
    // 把前面的注释也加上
    return commentLines.concat(sqlLines).join('\n').trim()
  }

  // 如果没找到明确的SQL，返回清理后的内容
  return sql.trim()
}

// ============ SQL安全检测 ============

// 危险SQL关键词
const DANGEROUS_KEYWORDS = ['DROP', 'TRUNCATE', 'ALTER TABLE', 'GRANT', 'REVOKE']
const WRITE_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'CREATE']

// 检测SQL是否包含危险操作
export const detectDangerousSQL = (sql: string): { isDangerous: boolean; reason: string; level: 'high' | 'medium' | 'low' } => {
  const upperSql = sql.toUpperCase().trim()

  // 高危操作：DROP、TRUNCATE等不可逆操作
  for (const keyword of DANGEROUS_KEYWORDS) {
    if (upperSql.includes(keyword)) {
      return { isDangerous: true, reason: `包含不可逆操作: ${keyword}`, level: 'high' }
    }
  }

  // 中危操作：UPDATE/DELETE无WHERE条件
  if (upperSql.startsWith('UPDATE') || upperSql.startsWith('DELETE')) {
    if (!upperSql.includes('WHERE')) {
      return { isDangerous: true, reason: 'UPDATE/DELETE语句缺少WHERE条件，可能影响全表', level: 'medium' }
    }
  }

  // 低危：写操作提醒
  for (const keyword of WRITE_KEYWORDS) {
    if (upperSql.startsWith(keyword)) {
      return { isDangerous: false, reason: `写操作: ${keyword}，请确认后执行`, level: 'low' }
    }
  }

  return { isDangerous: false, reason: '', level: 'low' }
}

// 检测是否为写操作
export const isWriteOperation = (sql: string): boolean => {
  const upperSql = sql.toUpperCase().trim()
  return WRITE_KEYWORDS.some(keyword => upperSql.startsWith(keyword)) || DANGEROUS_KEYWORDS.some(keyword => upperSql.includes(keyword))
}

// ============ Schema上下文构建 ============

// 构建表结构描述文本
const buildSchemaDescription = (tableSchema?: TableSchemaInfo): string => {
  if (!tableSchema) return ''

  const columnsDesc = tableSchema.columns.map(col => {
    let desc = `  - ${col.name} (${col.type})`
    if (col.primaryKey) desc += ' [主键]'
    if (col.nullable === false) desc += ' [必填]'
    if (col.comment) desc += ` -- ${col.comment}`
    return desc
  }).join('\n')

  let result = `表名: ${tableSchema.tableName}`
  if (tableSchema.comment) result += ` (${tableSchema.comment})`
  result += `\n字段:\n${columnsDesc}`

  return result
}

// 构建示例数据描述
const buildSampleDataDescription = (sampleData?: Record<string, any>[]): string => {
  if (!sampleData || sampleData.length === 0) return ''

  const headers = Object.keys(sampleData[0])
  const rows = sampleData.slice(0, 3).map(row =>
    headers.map(h => String(row[h] ?? 'NULL').substring(0, 30)).join(', ')
  )

  return `示例数据(前${Math.min(3, sampleData.length)}行):\n  ${headers.join(', ')}\n  ${rows.join('\n  ')}`
}

// 构建数据库所有表的信息（用于意图匹配）
const buildDatabaseTablesDescription = (tables?: DatabaseTableInfo[]): string => {
  if (!tables || tables.length === 0) return ''

  // 按表名排序，最多显示30个表
  const displayTables = tables.slice(0, 30)
  const tableLines = displayTables.map(t => {
    let line = `- ${t.name}`
    if (t.comment) line += ` (${t.comment})`
    if (t.type && t.type !== 'TABLE') line += ` [${t.type}]`
    return line
  })

  return `当前数据库共有 ${tables.length} 个表:\n${tableLines.join('\n')}`
}

// 构建系统提示词（增强版）
const buildSystemPrompt = (featureType: AIRequestParams['featureType'], context?: AIRequestParams['context']): string => {
  const databaseType = context?.databaseType || 'MySQL'

  // 构建Schema上下文
  const schemaContext = buildSchemaDescription(context?.tableSchema)
  const sampleContext = buildSampleDataDescription(context?.sampleData)
  const allTablesContext = buildDatabaseTablesDescription(context?.databaseTables)
  const relatedTablesContext = context?.relatedTables?.length
    ? `可关联的表: ${context.relatedTables.join(', ')}`
    : ''

  switch (featureType) {
    case 'sql-generate':
      // 构建是否有表结构信息的提示
      const hasSchema = !!schemaContext
      const schemaHint = hasSchema
        ? `【当前选中表的结构】\n${schemaContext}\n\n请使用上面指定的表名和字段来生成SQL。`
        : ''

      // 构建数据库所有表的信息提示
      const tablesHint = allTablesContext
        ? `【当前数据库的所有表】\n${allTablesContext}\n\n【意图匹配规则 - 最高优先级】
1. 如果用户输入中包含 [指定表：xxx]，必须使用 xxx 作为查询表，不要选择其他表
2. 如果用户明确提到某个表名（如"查询sys_user表"），请使用该表名
3. 根据用户的描述关键词，从表注释中匹配最合适的表：
   - "用户信息" → 找注释含"用户"的表
   - "订单数据" → 找注释含"订单"或"order"的表
4. 如果表名本身包含关键词，可作为次选方案
5. 如果实在无法确定，优先选择名字最相关的表

【输出要求 - 必须遵守】
- 第一行必须是注释：-- 根据描述匹配到表：表名(匹配原因)
- 第二行开始输出纯SQL语句（不要markdown代码块）
- SQL末尾添加 LIMIT 100（除非用户指定其他限制）
- 示例：
  -- 根据描述匹配到表：sys_user(用户信息表，注释包含"用户")
  SELECT * FROM sys_user LIMIT 100;`
        : ''

      return `你是一个专业的SQL助手。根据用户描述生成可执行的SQL语句。

数据库类型: ${databaseType}

【输出格式要求 - 必须遵守】
- 第一行用注释说明选择的表及原因（格式：-- 根据描述匹配到表：表名(原因)）
- 第二行开始输出纯SQL语句
- 不要使用markdown代码块格式（不要三个反引号）
- SQL默认添加 LIMIT 100 限制

【安全规则】
- 严禁生成 DROP、TRUNCATE 等不可逆操作
- UPDATE/DELETE 语句必须包含 WHERE 条件

【SQL规则】
- 使用标准SQL格式，适当换行和缩进
- 表名和字段名使用反引号包裹
- 符合${databaseType}语法规范

${schemaHint}
${tablesHint}
${relatedTablesContext ? `\n【可关联查询的其他表】\n${relatedTablesContext}` : ''}
${sampleContext ? `\n${sampleContext}` : ''}

${context?.conversationHistory?.length ? `【对话历史】\n${context.conversationHistory.map(h => `${h.role}: ${h.content}${h.sql ? `\nSQL: ${h.sql}` : ''}`).join('\n')}` : ''}`

    case 'sql-explain':
      return `你是一个专业的SQL解释助手，帮助用户理解SQL语句的含义。

【解释规则】
1. 用简洁易懂的中文解释SQL语句的功能
2. 解释每个关键字的作用（SELECT、WHERE、JOIN、GROUP BY等）
3. 说明查询结果会返回什么数据
4. 如果有复杂子查询或连接，分别解释各部分
5. 对于新手，类比日常场景帮助理解
6. 格式清晰，使用分段和列表`

    case 'sql-analyze':
      return `你是资深数据库优化专家，为开发者提供专业的SQL分析报告。

数据库类型: ${databaseType}

【分析报告要求】
报告需包含以下模块，每个模块都要详尽专业：

1. **SQL语义解析**
   - 语句类型识别（SELECT/INSERT/UPDATE/DELETE等）
   - 涉及的表和字段
   - 查询条件和过滤逻辑
   - 排序、分组、聚合等操作
   - 执行流程分解（FROM→WHERE→GROUP→HAVING→SELECT→ORDER→LIMIT）

2. **性能评估（0-100分）**
   评分标准：
   - 90-100分：优秀，有合适索引、字段精准、LIMIT合理
   - 70-89分：良好，有轻微问题如SELECT *但有小LIMIT
   - 50-69分：一般，缺少索引或存在中等问题
   - 0-49分：需优化，存在高危问题

3. **问题诊断清单**
   按严重程度分类：
   - 🔴高危（必须修复）：
     * WHERE/JOIN字段无索引 → 全表扫描
     * LIKE '%keyword%' 前缀模糊匹配
     * 函数包裹索引字段（如WHERE DATE(col)='2024-01-01'）
     * UPDATE/DELETE无WHERE条件
     * 笛卡尔积（多表无JOIN条件）
     * 大表无LIMIT限制
   - 🟡中危（建议修复）：
     * SELECT * 返回全部字段
     * NOT IN 子查询（改用NOT EXISTS）
     * OR条件可能阻断索引
     * 深分页（LIMIT 10000, 10）
     * 子查询嵌套过深
   - 🟢低危（可优化）：
     * 重复字段查询
     * 冗余DISTINCT/ORDER BY
     * JOIN顺序可优化
     * 未使用覆盖索引

4. **索引优化方案**
   为每个WHERE条件和JOIN字段提供：
   - 具体CREATE INDEX语句
   - 复合索引建议（考虑查询顺序）
   - 索引类型建议（普通/唯一/全文）

5. **SQL重写建议**
   针对问题提供优化后的SQL：
   - 消除SELECT *，列出必要字段
   - NOT IN → NOT EXISTS / LEFT JOIN IS NULL
   * 函数索引 → 范围查询改写
   * OR → UNION ALL / IN
   * 添加合理的LIMIT
   * 子查询 → JOIN

6. **安全风险检查**
   - SQL注入风险点（动态拼接、未转义）
   - 危险操作（DROP/TRUNCATE/ALTER）
   - 权限风险（无WHERE的批量操作）
   - 数据泄露风险（大结果集无限制）

7. **最佳实践建议**
   根据分析结果给出针对性建议

【输出格式】严格JSON：
{
  "summary": "一句话概括SQL功能",
  "statementType": "SELECT|INSERT|UPDATE|DELETE",
  "tables": ["涉及的表"],
  "columns": ["涉及的字段"],
  "executionFlow": ["FROM table", "WHERE condition", "SELECT columns", ...],
  "performanceScore": 85,
  "performanceLevel": "优秀|良好|一般|需优化",
  "issues": [
    {
      "severity": "high|medium|low",
      "category": "index|scan|join|security|syntax",
      "description": "问题描述",
      "impact": "影响说明",
      "suggestion": "解决建议"
    }
  ],
  "indexSuggestions": [
    {
      "table": "表名",
      "columns": ["字段"],
      "sql": "CREATE INDEX idx_xxx ON table(col)",
      "reason": "索引原因"
    }
  ],
  "rewrittenSQL": "优化后的完整SQL",
  "optimizationTips": ["最佳实践建议"],
  "securityIssues": [
    {
      "severity": "high|medium|low",
      "type": "injection|dangerous|permission|leak",
      "description": "风险描述",
      "solution": "解决方案"
    }
  ],
  "bestPractices": ["建议1", "建议2"]
}

直接输出JSON，不要包含任何其他文字或解释。`

    case 'data-generate':
      return `你是一个测试数据生成助手。根据表结构生成INSERT语句。

数据库类型: ${databaseType}

【输出格式要求 - 必须遵守】
- 只输出纯INSERT语句，不要包含任何解释或说明
- 不要使用markdown代码块格式（不要写三个反引号加sql）
- 不要在SQL前加任何前缀文字
- 直接返回可以立即执行的INSERT语句

【生成规则】
- 生成3-5条测试数据
- 数据要符合字段类型和约束（主键、必填等）
- 数据要看起来真实合理：
  姓名：真实的中国人姓名
  邮箱：合理的邮箱格式如 test@example.com
  电话：中国手机号格式如 13812345678
  时间：合理的日期格式
- 使用批量INSERT格式: INSERT INTO table (cols) VALUES (...), (...), (...);

${schemaContext ? `【目标表结构】\n${schemaContext}` : '请根据描述推测合适的表结构'}`

    default:
      return '你是一个数据库助手，帮助用户处理SQL相关问题。'
  }
}

// 构建用户提示词（增强版）
const buildUserPrompt = (params: AIRequestParams): string => {
  const { featureType, prompt, context } = params

  switch (featureType) {
    case 'sql-generate':
      let userPrompt = `请根据以下描述生成SQL语句:\n${prompt}`

      // 如果有执行错误，附加修复请求
      if (context?.executionError) {
        userPrompt = `上次生成的SQL执行出错，请修复:\n\n错误信息: ${context.executionError}\n\n原SQL:\n${context.existingSql}\n\n请分析错误原因并给出修正后的SQL。`
      }

      return userPrompt

    case 'sql-explain':
      return `请解释以下SQL语句的含义，用通俗易懂的语言:\n\n${context?.existingSql || prompt}`

    case 'sql-analyze':
      return `分析此SQL，返回JSON:\n\n${context?.existingSql || prompt}`

    case 'data-generate':
      return `请为以下表生成测试数据:\n${prompt}`

    default:
      return prompt
  }
}

// 通过IPC发送请求（绕过浏览器CORS）
const sendRequest = async (
  url: string,
  headers: Record<string, string>,
  body: any,
  timeout: number = 120000
): Promise<{ success: boolean; data?: any; error?: string; latency?: number }> => {
  try {
    // 检查是否有Electron API
    if (window.electronAPI?.aiRequest) {
      const result = await window.electronAPI.aiRequest({
        url,
        method: 'POST',
        headers,
        body,
        timeout,
      })
      return result
    }

    // 如果没有Electron API（纯浏览器环境），使用fetch
    const startTime = Date.now()
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const latency = Date.now() - startTime

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { message: response.statusText }
      }
      return {
        success: false,
        error: errorData.error?.message || errorData.error_msg || `请求失败 (${response.status})`,
        latency,
      }
    }

    const data = await response.json()
    return { success: true, data, latency }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
    }
  }
}

// OpenAI兼容API调用（适用于OpenAI、DeepSeek、智谱、阿里等）
const callOpenAICompatible = async (config: AIConfig, systemPrompt: string, userPrompt: string): Promise<AIResponse> => {
  const baseUrl = config.baseUrl || AI_PROVIDER_CONFIGS[config.provider].defaultBaseUrl

  // 智能拼接URL
  // 对于自定义类型，假设用户输入的就是完整endpoint，不做修改
  // 对于其他预设提供商，按照标准格式拼接
  let url = baseUrl
  if (config.provider !== 'custom') {
    if (!baseUrl.includes('/chat/completions')) {
      url = baseUrl.replace(/\/$/, '') + '/chat/completions'
    }
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.apiKey}`,
  }

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 8000,
  }

  console.log('[AI Service] 发送请求到:', url, '模型:', config.model)

  const result = await sendRequest(url, headers, body, config.timeout || 120000)

  console.log('[AI Service] 响应耗时:', result.latency, 'ms')

  if (!result.success) {
    return { success: false, error: result.error, latency: result.latency }
  }

  const content = result.data?.choices?.[0]?.message?.content
  if (!content) {
    return { success: false, error: 'API返回内容为空', latency: result.latency }
  }

  return { success: true, content, latency: result.latency }
}

// Anthropic Claude API调用
const callAnthropic = async (config: AIConfig, systemPrompt: string, userPrompt: string): Promise<AIResponse> => {
  const baseUrl = config.baseUrl || AI_PROVIDER_CONFIGS.anthropic.defaultBaseUrl
  const url = `${baseUrl}/v1/messages`

  const headers: Record<string, string> = {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  }

  const body = {
    model: config.model,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  }

  const result = await sendRequest(url, headers, body, config.timeout || 120000)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const content = result.data?.content?.[0]?.text
  if (!content) {
    return { success: false, error: 'API返回内容为空' }
  }

  return { success: true, content }
}

// Google Gemini API调用
const callGoogle = async (config: AIConfig, systemPrompt: string, userPrompt: string): Promise<AIResponse> => {
  const baseUrl = config.baseUrl || AI_PROVIDER_CONFIGS.google.defaultBaseUrl
  const url = `${baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`

  const body = {
    contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
  }

  const result = await sendRequest(url, {}, body)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const content = result.data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) {
    return { success: false, error: 'API返回内容为空' }
  }

  return { success: true, content }
}

// Azure OpenAI API调用
const callAzure = async (config: AIConfig, systemPrompt: string, userPrompt: string): Promise<AIResponse> => {
  if (!config.baseUrl) {
    return { success: false, error: 'Azure需要配置部署地址' }
  }

  const url = `${config.baseUrl}/openai/deployments/${config.model}/chat/completions?api-version=2024-02-15-preview`

  const headers: Record<string, string> = {
    'api-key': config.apiKey,
  }

  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  }

  const result = await sendRequest(url, headers, body, config.timeout || 120000)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const content = result.data?.choices?.[0]?.message?.content
  if (!content) {
    return { success: false, error: 'API返回内容为空' }
  }

  return { success: true, content }
}

// 百度文心API调用
const callBaidu = async (config: AIConfig, systemPrompt: string, userPrompt: string): Promise<AIResponse> => {
  const baseUrl = config.baseUrl || AI_PROVIDER_CONFIGS.baidu.defaultBaseUrl
  const url = `${baseUrl}/chat/${config.model}?access_token=${config.apiKey}`

  const body = {
    messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }],
  }

  const result = await sendRequest(url, {}, body)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const content = result.data?.result
  if (!content) {
    return { success: false, error: 'API返回内容为空' }
  }

  return { success: true, content }
}

// 主调用函数
export const callAI = async (config: AIConfig, params: AIRequestParams): Promise<AIResponse> => {
  if (!config.enabled) {
    return { success: false, error: 'AI功能未启用' }
  }

  if (!config.apiKey) {
    return { success: false, error: '未配置API密钥' }
  }

  if (!config.model) {
    return { success: false, error: '未配置模型' }
  }

  const systemPrompt = buildSystemPrompt(params.featureType, params.context)
  const userPrompt = buildUserPrompt(params)

  // 根据提供商选择不同的API调用方式
  let response: AIResponse
  switch (config.provider) {
    case 'anthropic':
      response = await callAnthropic(config, systemPrompt, userPrompt)
      break

    case 'google':
      response = await callGoogle(config, systemPrompt, userPrompt)
      break

    case 'azure':
      response = await callAzure(config, systemPrompt, userPrompt)
      break

    case 'baidu':
      response = await callBaidu(config, systemPrompt, userPrompt)
      break

    // OpenAI兼容格式（OpenAI、DeepSeek、智谱、阿里、自定义）
    case 'openai':
    case 'deepseek':
    case 'zhipu':
    case 'alibaba':
    case 'custom':
      response = await callOpenAICompatible(config, systemPrompt, userPrompt)
      break

    default:
      return { success: false, error: '不支持的AI提供商' }
  }

  // 处理返回结果：对于SQL生成和数据生成，提取纯SQL
  if (response.success && response.content) {
    if (params.featureType === 'sql-generate' || params.featureType === 'data-generate') {
      const pureSQL = extractPureSQL(response.content)
      // 如果提取后的SQL与原内容不同，使用提取后的SQL
      if (pureSQL !== response.content) {
        response.content = pureSQL
      }
    }
  }

  return response
}

// 获取提供商配置
export const getProviderConfig = (provider: AIProvider) => {
  return AI_PROVIDER_CONFIGS[provider]
}

// 测试连通性 - 发送简单请求验证配置
export const testConnection = async (config: AIConfig): Promise<{ success: boolean; message: string; latency?: number }> => {
  if (!config.apiKey) {
    return { success: false, message: '未配置API密钥' }
  }

  if (!config.model) {
    return { success: false, message: '未配置模型' }
  }

  if (config.provider === 'azure' && !config.baseUrl) {
    return { success: false, message: 'Azure需要配置部署地址' }
  }

  if (config.provider === 'custom' && !config.baseUrl) {
    return { success: false, message: '自定义配置需要API地址' }
  }

  // 根据提供商选择不同的测试方式
  switch (config.provider) {
    case 'anthropic':
      return testAnthropic(config)

    case 'google':
      return testGoogle(config)

    case 'azure':
      return testAzure(config)

    case 'baidu':
      return testBaidu(config)

    case 'openai':
    case 'deepseek':
    case 'zhipu':
    case 'alibaba':
    case 'custom':
      return testOpenAICompatible(config)

    default:
      return { success: false, message: '不支持的AI提供商' }
  }
}

// OpenAI兼容格式测试
const testOpenAICompatible = async (config: AIConfig): Promise<{ success: boolean; message: string; latency?: number }> => {
  const baseUrl = config.baseUrl || AI_PROVIDER_CONFIGS[config.provider].defaultBaseUrl

  // 智能拼接URL：自定义类型直接使用用户配置的URL
  let url = baseUrl
  if (config.provider !== 'custom') {
    if (!baseUrl.includes('/chat/completions')) {
      url = baseUrl.replace(/\/$/, '') + '/chat/completions'
    }
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.apiKey}`,
  }

  const body = {
    model: config.model,
    messages: [{ role: 'user', content: '请回复OK两个字' }],
    max_tokens: 10,
  }

  const result = await sendRequest(url, headers, body, config.timeout || 120000)

  if (!result.success) {
    return { success: false, message: result.error || '请求失败', latency: result.latency }
  }

  if (result.data?.choices?.[0]?.message?.content) {
    return { success: true, message: `连接成功，模型: ${config.model}`, latency: result.latency }
  }

  return { success: false, message: '响应格式异常', latency: result.latency }
}

// Anthropic测试
const testAnthropic = async (config: AIConfig): Promise<{ success: boolean; message: string; latency?: number }> => {
  const baseUrl = config.baseUrl || AI_PROVIDER_CONFIGS.anthropic.defaultBaseUrl
  const url = `${baseUrl}/v1/messages`

  const headers: Record<string, string> = {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  }

  const body = {
    model: config.model,
    max_tokens: 10,
    messages: [{ role: 'user', content: '请回复OK两个字' }],
  }

  const result = await sendRequest(url, headers, body, config.timeout || 120000)

  if (!result.success) {
    return { success: false, message: result.error || '请求失败', latency: result.latency }
  }

  if (result.data?.content?.[0]?.text) {
    return { success: true, message: `连接成功，模型: ${config.model}`, latency: result.latency }
  }

  return { success: false, message: '响应格式异常', latency: result.latency }
}

// Google Gemini测试
const testGoogle = async (config: AIConfig): Promise<{ success: boolean; message: string; latency?: number }> => {
  const baseUrl = config.baseUrl || AI_PROVIDER_CONFIGS.google.defaultBaseUrl
  const url = `${baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`

  const body = {
    contents: [{ parts: [{ text: '请回复OK两个字' }] }],
    generationConfig: { maxOutputTokens: 10 },
  }

  const result = await sendRequest(url, {}, body)

  if (!result.success) {
    return { success: false, message: result.error || '请求失败', latency: result.latency }
  }

  if (result.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return { success: true, message: `连接成功，模型: ${config.model}`, latency: result.latency }
  }

  return { success: false, message: '响应格式异常', latency: result.latency }
}

// Azure测试
const testAzure = async (config: AIConfig): Promise<{ success: boolean; message: string; latency?: number }> => {
  const url = `${config.baseUrl}/openai/deployments/${config.model}/chat/completions?api-version=2024-02-15-preview`

  const headers: Record<string, string> = {
    'api-key': config.apiKey,
  }

  const body = {
    messages: [{ role: 'user', content: '请回复OK两个字' }],
    max_tokens: 10,
  }

  const result = await sendRequest(url, headers, body, config.timeout || 120000)

  if (!result.success) {
    return { success: false, message: result.error || '请求失败', latency: result.latency }
  }

  if (result.data?.choices?.[0]?.message?.content) {
    return { success: true, message: `连接成功，部署: ${config.model}`, latency: result.latency }
  }

  return { success: false, message: '响应格式异常', latency: result.latency }
}

// 百度测试
const testBaidu = async (config: AIConfig): Promise<{ success: boolean; message: string; latency?: number }> => {
  const baseUrl = config.baseUrl || AI_PROVIDER_CONFIGS.baidu.defaultBaseUrl
  const url = `${baseUrl}/chat/${config.model}?access_token=${config.apiKey}`

  const body = {
    messages: [{ role: 'user', content: '请回复OK两个字' }],
  }

  const result = await sendRequest(url, {}, body)

  if (!result.success) {
    return { success: false, message: result.error || '请求失败', latency: result.latency }
  }

  if (result.data?.result) {
    return { success: true, message: `连接成功，模型: ${config.model}`, latency: result.latency }
  }

  return { success: false, message: '响应格式异常', latency: result.latency }
}