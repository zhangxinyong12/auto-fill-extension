/**
 * 科大讯飞API调用模块
 * 用于调用科大讯飞大模型生成表单模拟数据
 */

/**
 * 科大讯飞API配置接口
 */
interface SparkApiConfig {
  apiPassword: string
  model?: string
}

/**
 * 表单字段信息接口
 */
export interface FormField {
  label: string
  type: string
  name?: string
  id?: string
  placeholder?: string
  required?: boolean
}

/**
 * 生成表单数据的请求参数
 */
interface GenerateFormDataParams {
  fields: FormField[]
}

/**
 * 生成表单数据的响应
 */
interface GenerateFormDataResponse {
  data: Record<string, string | number | boolean>
}

/**
 * 科大讯飞API调用类
 * 根据官方文档：https://www.xfyun.cn/doc/spark/HTTP%E8%B0%83%E7%94%A8%E6%96%87%E6%A1%A3.html
 * 接口地址：https://spark-api-open.xf-yun.com/v1/chat/completions
 * 认证方式：Bearer {APIPassword}
 */
class SparkApiService {
  /**
   * API基础地址
   * 根据官方文档：https://www.xfyun.cn/doc/spark/HTTP%E8%B0%83%E7%94%A8%E6%96%87%E6%A1%A3.html#_2-%E8%AF%B7%E6%B1%82%E5%9C%B0%E5%9D%80
   * 完整的接口地址为：https://spark-api-open.xf-yun.com/v1/chat/completions
   */
  private baseURL = "https://spark-api-open.xf-yun.com"

  /**
   * APIPassword认证信息
   * 从控制台对应版本页面的"HTTP服务接口认证信息"中获取
   */
  private apiPassword: string = ""

  /**
   * 模型版本
   * 固定使用 lite 模型（轻量级大语言模型，支持免费使用）
   * 支持的模型版本：lite、pro、pro-128k、max、max-32k、4.0-ultra
   */
  private model: string = "lite"

  /**
   * 设置API配置
   * @param config API配置
   */
  setConfig(config: SparkApiConfig) {
    this.apiPassword = config.apiPassword
    this.model = config.model || "lite"
  }

  /**
   * 生成认证头
   * 根据官方文档：https://www.xfyun.cn/doc/spark/HTTP%E8%B0%83%E7%94%A8%E6%96%87%E6%A1%A3.html
   * 认证格式: Bearer {APIPassword}
   * APIPassword需要从控制台对应版本页面的"HTTP服务接口认证信息"中获取
   * @returns 认证头字符串，格式为 "Bearer {APIPassword}"
   */
  private generateAuthHeader(): string {
    if (!this.apiPassword) {
      throw new Error("SPARK_API_PASSWORD 未配置，请从控制台获取APIPassword")
    }
    // 根据官方文档，使用 Bearer {APIPassword} 格式
    return `Bearer ${this.apiPassword}`
  }

  /**
   * 调用科大讯飞API生成表单数据
   * @param params 请求参数
   * @returns 生成的表单数据
   */
  async generateFormData(
    params: GenerateFormDataParams
  ): Promise<GenerateFormDataResponse> {
    if (!this.apiPassword) {
      throw new Error("请先配置科大讯飞APIPassword（从控制台获取）")
    }

    // 构建提示词
    const prompt = this.buildPrompt(params.fields)

    // 构建请求体
    const requestBody = {
      model: this.model,
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

    try {
      // 调用科大讯飞API
      // 接口地址：https://spark-api-open.xf-yun.com/v1/chat/completions
      // 根据官方文档：https://www.xfyun.cn/doc/spark/HTTP%E8%B0%83%E7%94%A8%E6%96%87%E6%A1%A3.html#_2-%E8%AF%B7%E6%B1%82%E5%9C%B0%E5%9D%80
      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: this.generateAuthHeader(), // Bearer {APIPassword}
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

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

      // 解析JSON内容
      const jsonContent = this.extractJsonFromContent(generatedContent)
      const formData = JSON.parse(jsonContent)

      return {
        data: formData,
      }
    } catch (error) {
      console.error("调用科大讯飞API失败:", error)
      throw error
    }
  }

  /**
   * 构建提示词
   * @param fields 表单字段列表
   * @returns 提示词字符串
   */
  private buildPrompt(fields: FormField[]): string {
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
    fields.forEach((field, index) => {
      const key = field.name || field.id || `field${index + 1}`
      // 根据label给出具体的生成示例
      let example = ""
      if (field.label.includes("姓名") || field.label.includes("名字")) {
        example = '例如："李明"、"王芳"'
      } else if (field.label.includes("公司") || field.label.includes("企业")) {
        example = '例如："北京科技有限公司"、"上海贸易有限公司"'
      } else if (field.label.includes("简称") || field.label.includes("缩写")) {
        example = '例如："北京科技"、"上海贸易"'
      } else if (field.label.includes("手机") || field.label.includes("电话")) {
        example = '例如："13812345678"、"15987654321"'
      } else if (field.label.includes("邮箱") || field.label.includes("邮件")) {
        example = '例如："zhang@example.com"、"li@company.cn"'
      } else if (field.label.includes("日期")) {
        example = '例如："2020-01-15"、"2023-06-20"'
      } else if (field.label.includes("地址")) {
        example = '例如："北京市朝阳区建国路1号"、"上海市浦东新区世纪大道100号"'
      } else {
        example = "根据字段含义生成合适的真实数据"
      }
      prompt += `  "${key}": "${example}",\n`
    })
    prompt += `}\n\n`

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
  private extractJsonFromContent(content: string): string {
    if (!content || typeof content !== "string") {
      throw new Error("内容为空或格式错误")
    }

    const trimmedContent = content.trim()

    // 尝试提取markdown代码块中的JSON
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/
    const codeBlockMatch = trimmedContent.match(codeBlockRegex)
    if (codeBlockMatch && codeBlockMatch[1]) {
      const extracted = codeBlockMatch[1].trim()
      if (extracted.startsWith("{") && extracted.endsWith("}")) {
        try {
          JSON.parse(extracted)
          return extracted
        } catch (e) {
          // 继续尝试其他方法
        }
      }
    }

    // 尝试提取第一个完整的JSON对象
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
        const extracted = trimmedContent
          .substring(firstBraceIndex, jsonEndIndex + 1)
          .trim()
        if (extracted.startsWith("{") && extracted.endsWith("}")) {
          try {
            JSON.parse(extracted)
            return extracted
          } catch (e) {
            // 继续
          }
        }
      }
    }

    // 返回清理后的原始内容
    return trimmedContent
  }
}

// 导出单例
export const sparkApiService = new SparkApiService()
