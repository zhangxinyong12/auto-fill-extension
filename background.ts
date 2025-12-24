import { Storage } from "@plasmohq/storage"

/**
 * Background Service Worker
 * 用于处理跨域API调用，避免CORS问题
 * 监听来自content script的消息，代为调用科大讯飞API
 */

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 处理API调用请求
  if (request.action === "generateFormData") {
    handleGenerateFormData(request.fields)
      .then((data) => {
        sendResponse({ success: true, data })
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message || "API调用失败",
        })
      })
    // 返回true表示异步响应
    return true
  }
})

/**
 * 处理表单数据生成请求
 * @param fields 表单字段列表
 * @returns 生成的表单数据
 */
async function handleGenerateFormData(fields: any[]) {
  try {
    if (!fields || !Array.isArray(fields)) {
      throw new Error("表单字段数据无效")
    }

    // 从存储中获取APIPassword
    const storage = new Storage()
    const apiPassword = await storage.get<string>("sparkApiPassword")

    if (!apiPassword) {
      throw new Error("请先配置APIPassword")
    }

    // 构建提示词
    const prompt = buildPrompt(fields)
    console.log("构建的提示词:", prompt)
    console.log("表单字段信息:", fields)

    // 构建请求体
    const requestBody = {
      model: "lite", // 固定使用 lite 模型
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的表单数据生成助手。你必须严格按照JSON格式返回结果，不要使用markdown代码块包裹。根据表单字段的label（字段名称）生成真实的模拟数据，绝对不要返回placeholder文本。例如：如果label是'客户简称'，生成'北京科技'这样的真实数据，而不是'请输入客户简称'这样的提示文本。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 4096,
      top_k: 6,
      temperature: 1.5, // 提高温度值，增加随机性和多样性
      stream: false,
      response_format: { type: "json_object" },
    }

    // 调用科大讯飞API
    // 接口地址：https://spark-api-open.xf-yun.com/v1/chat/completions
    // Background service worker不受CORS限制
    const response = await fetch(
      "https://spark-api-open.xf-yun.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiPassword}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `API调用失败: ${errorData.error?.message || response.statusText}`
      )
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0]) {
      throw new Error("API返回数据格式错误")
    }

    const generatedContent = data.choices[0].message?.content || ""

    if (!generatedContent) {
      throw new Error("API未返回有效内容")
    }

    console.log("API返回的原始内容:", generatedContent)

    // 解析JSON内容
    const jsonContent = extractJsonFromContent(generatedContent)
    console.log("提取的JSON内容:", jsonContent)

    let formData: any
    try {
      formData = JSON.parse(jsonContent)
    } catch (parseError) {
      console.error("JSON解析失败:", parseError)
      console.error("尝试解析的内容:", jsonContent)
      throw new Error(`JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
    }

    // 检查解析后的数据是否为空
    if (!formData || typeof formData !== "object" || Object.keys(formData).length === 0) {
      console.error("解析后的数据为空:", formData)
      throw new Error("API返回的数据为空，请检查表单字段是否正确识别")
    }

    console.log("解析后的表单数据:", formData)

    // 返回生成的表单数据
    return formData
  } catch (error: any) {
    console.error("Background API调用失败:", error)
    throw error
  }
}

/**
 * 构建提示词
 * @param fields 表单字段列表
 * @returns 提示词字符串
 */
function buildPrompt(fields: any[]): string {
  let prompt = `你是一个专业的表单数据生成助手。请根据以下表单字段的label（字段名称）生成真实的模拟数据，并以JSON格式返回结果。\n\n`

  prompt += `【重要说明】\n`
  prompt += `1. placeholder（提示信息）只是告诉用户应该输入什么，不是你生成的数据\n`
  prompt += `2. 你必须根据字段的label（字段名称）来理解字段的含义，然后生成对应的真实数据\n`
  prompt += `3. 绝对不要返回placeholder文本，要返回真实的模拟数据\n`
  prompt += `4. 例如：如果label是"客户简称"，你应该生成"北京科技"、"上海贸易"这样的真实公司简称，而不是"请输入客户简称"\n\n`

  prompt += `【表单字段信息】\n`
  fields.forEach((field, index) => {
    prompt += `${index + 1}. 字段名称（label）：${field.label}\n`
    prompt += `   - 字段类型：${field.type}\n`
    if (field.name) {
      prompt += `   - name属性：${field.name}\n`
    }
    if (field.placeholder) {
      prompt += `   - 提示信息（仅作参考，不要使用）：${field.placeholder}\n`
    }
    if (field.required) {
      prompt += `   - 必填：是\n`
    }
    prompt += `   - 需要生成：根据"${field.label}"这个字段名称，生成对应的真实模拟数据\n`
    prompt += `\n`
  })

  prompt += `【返回格式要求】\n`
  prompt += `你必须返回纯JSON格式的响应。不要使用markdown代码块（不要用\`\`\`json或\`\`\`包裹），不要添加任何文字说明，直接返回JSON对象。\n\n`

  prompt += `JSON结构说明：\n`
  prompt += `{\n`
  const fieldKeys: string[] = []
  fields.forEach((field, index) => {
    const key = field.name || field.id || `field${index + 1}`
    fieldKeys.push(key)
    // 根据label给出具体的生成示例
    let example = ''
    if (field.label.includes('姓名') || field.label.includes('名字')) {
      example = '例如："李明"、"王芳"'
    } else if (field.label.includes('公司') || field.label.includes('企业')) {
      example = '例如："北京科技有限公司"、"上海贸易有限公司"'
    } else if (field.label.includes('简称') || field.label.includes('缩写')) {
      example = '例如："北京科技"、"上海贸易"'
    } else if (field.label.includes('手机') || field.label.includes('电话')) {
      example = '例如："13812345678"、"15987654321"'
    } else if (field.label.includes('邮箱') || field.label.includes('邮件')) {
      example = '例如："zhang@example.com"、"li@company.cn"'
    } else if (field.label.includes('日期')) {
      example = '例如："2020-01-15"、"2023-06-20"'
    } else if (field.label.includes('地址')) {
      example = '例如："北京市朝阳区建国路1号"、"上海市浦东新区世纪大道100号"'
    } else {
      example = '根据字段含义生成合适的真实数据'
    }
    prompt += `  "${key}": "${example}",\n`
  })
  prompt += `}\n\n`
  
  // 强调必须返回所有字段
  prompt += `【重要】你必须返回包含以下所有字段的JSON对象：${fieldKeys.join(', ')}\n`
  prompt += `每个字段都必须有对应的真实数据值，不能为空，不能是placeholder文本。\n\n`

  prompt += `【生成规则】\n`
  prompt += `1. 根据字段的label和type生成符合实际场景的模拟数据\n`
  prompt += `2. **重要：每次生成的数据必须完全不同，要有随机性和多样性**\n`
  prompt += `3. 如果是姓名字段，生成随机的中文姓名（使用不同的姓氏：李、王、张、刘、陈、杨、赵、黄、周、吴、徐、孙、马、朱、胡、郭、何、高、林、罗、郑、梁、谢、宋、唐、许、韩、冯、邓、曹、彭、曾、肖、田、董、袁、潘、于、蒋、蔡、余、杜、叶、程、苏、魏、吕、丁、任、沈、姚、卢、姜、崔、钟、谭、陆、汪、范、金、石、廖、贾、夏、韦、付、方、白、邹、孟、熊、秦、邱、江、尹、薛、闫、段、雷、侯、龙、史、陶、黎、贺、顾、毛、郝、龚、邵、万、钱、严、覃、武、戴、莫、孔、向、汤等，名字也要多样化）\n`
  prompt += `4. 如果是手机号字段，生成随机的11位手机号（以1开头，第二位为3、4、5、6、7、8、9，后9位随机）\n`
  prompt += `5. 如果是邮箱字段，生成随机的有效邮箱地址（使用不同的用户名和域名）\n`
  prompt += `6. 如果是日期字段，生成随机的YYYY-MM-DD格式日期（在合理范围内随机选择）\n`
  prompt += `7. 如果是数字字段，生成随机的合理数字（在合理范围内变化）\n`
  prompt += `8. 如果是文本字段，生成随机的有意义文本内容（每次都要不同）\n`
  prompt += `9. 如果是公司名称字段，生成随机的公司名称（使用不同的行业、地区、公司类型）\n`
  prompt += `10. 如果是地址字段，生成随机的中国地址（使用不同的省市区、街道）\n`
  prompt += `11. 所有数据要符合中国实际情况，但每次都要有变化\n`
  prompt += `12. JSON的key使用字段的name属性，如果没有name则使用id，都没有则使用field1、field2等\n`
  prompt += `13. **禁止重复使用相同的数据，每次调用都要生成全新的随机数据**\n`

  return prompt
}

/**
 * 从内容中提取JSON字符串
 * 处理markdown代码块包裹的情况
 * @param content 原始内容
 * @returns 提取的JSON字符串
 */
function extractJsonFromContent(content: string): string {
  if (!content || typeof content !== "string") {
    throw new Error("内容为空或格式错误")
  }

  const trimmedContent = content.trim()

  // 优先尝试提取markdown代码块中的JSON
  // 匹配 ```json ... ``` 或 ``` ... ``` 格式
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/
  const codeBlockMatch = trimmedContent.match(codeBlockRegex)
  if (codeBlockMatch && codeBlockMatch[1]) {
    const extracted = codeBlockMatch[1].trim()
    // 移除可能的尾随逗号（JSON不允许尾随逗号）
    const cleaned = extracted.replace(/,(\s*[}\]])/g, '$1')
    if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
      try {
        // 验证是否是有效的JSON
        JSON.parse(cleaned)
        return cleaned
      } catch (e) {
        console.warn("从代码块提取的JSON解析失败，尝试其他方法:", e)
        // 继续尝试其他方法
      }
    }
  }

  // 尝试提取第一个完整的JSON对象（处理没有代码块包裹的情况）
  const firstBraceIndex = trimmedContent.indexOf("{")
  if (firstBraceIndex !== -1) {
    let braceCount = 0
    let jsonEndIndex = -1
    let inString = false
    let escapeNext = false

    for (let i = firstBraceIndex; i < trimmedContent.length; i++) {
      const char = trimmedContent[i]

      if (escapeNext) {
        escapeNext = false
        continue
      }

      if (char === "\\") {
        escapeNext = true
        continue
      }

      if (char === '"' && !escapeNext) {
        inString = !inString
        continue
      }

      if (!inString) {
        if (char === "{") {
          braceCount++
        } else if (char === "}") {
          braceCount--
          if (braceCount === 0) {
            jsonEndIndex = i
            break
          }
        }
      }
    }

    if (jsonEndIndex !== -1) {
      let extracted = trimmedContent
        .substring(firstBraceIndex, jsonEndIndex + 1)
        .trim()
      
      // 移除可能的尾随逗号
      extracted = extracted.replace(/,(\s*[}\]])/g, '$1')
      
      if (extracted.startsWith("{") && extracted.endsWith("}")) {
        try {
          // 验证是否是有效的JSON
          JSON.parse(extracted)
          return extracted
        } catch (e) {
          console.warn("提取的JSON解析失败:", e)
          // 继续尝试清理
        }
      }
    }
  }

  // 如果以上方法都失败，尝试清理后返回
  // 移除可能的markdown标记和尾随逗号
  let cleaned = trimmedContent
    // 移除代码块标记
    .replace(/```(?:json)?\s*/g, '')
    .replace(/```\s*/g, '')
    // 移除尾随逗号
    .replace(/,(\s*[}\]])/g, '$1')
    .trim()

  // 最后尝试解析清理后的内容
  try {
    JSON.parse(cleaned)
    return cleaned
  } catch (e) {
    console.error("所有JSON提取方法都失败，原始内容:", trimmedContent)
    throw new Error(`无法从内容中提取有效的JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
}

