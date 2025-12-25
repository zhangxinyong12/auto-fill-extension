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

    // 获取自定义提示词
    const customSystemPrompt = await storage.get<string>("customSystemPrompt")
    const customUserPrompt = await storage.get<string>("customUserPrompt")

    // 构建提示词（如果使用自定义用户提示词，需要替换 {fields} 占位符）
    let userPrompt: string
    if (customUserPrompt && customUserPrompt.trim()) {
      // 使用自定义用户提示词，替换 {fields} 占位符
      const defaultPrompt = buildPrompt(fields)
      // 如果自定义提示词中包含 {fields}，则替换；否则直接使用自定义提示词
      userPrompt = customUserPrompt.includes("{fields}")
        ? customUserPrompt.replace("{fields}", defaultPrompt)
        : customUserPrompt
    } else {
      // 使用默认提示词
      userPrompt = buildPrompt(fields)
    }

    console.log("构建的提示词:", userPrompt)
    console.log("表单字段信息:", fields)

    // 默认系统提示词
    const defaultSystemPrompt =
      "你是一个专业的表单数据生成助手。你必须严格按照JSON格式返回结果，不要使用markdown代码块包裹。\n\n【核心要求 - 违反将导致失败】\n1. 根据表单字段的label（字段名称）理解字段含义，然后生成对应的真实模拟数据\n2. 绝对禁止返回label文本本身，必须生成真实的模拟数据\n3. 绝对禁止返回placeholder文本，必须生成真实的模拟数据\n4. 绝对禁止返回任何说明性文字，如'随机生成的中文姓名'、'随机日期（例如：2023-06-20）'、'请输入XXX'等\n5. 绝对禁止返回示例性文字，如'例如：XXX'、'随机XXX'等\n6. 必须直接返回真实数据，例如：如果label是'客户简称'，必须返回'北京科技'，绝对不能返回'客户简称'、'请输入客户简称'、'随机生成的公司简称'等\n7. 如果label是'姓名'，必须返回'李明'，绝对不能返回'姓名'、'请输入姓名'、'随机生成的中文姓名'等\n8. 如果label是'日期'，必须返回'2023-06-20'，绝对不能返回'随机日期（例如：2023-06-20）'、'请输入日期'等\n9. 如果字段是bankName（开户银行），必须返回'中国工商银行'、'中国建设银行'等真实银行名称，绝对不能返回'请输入开户银行'、'开户银行'等placeholder或label文本\n10. 如果字段是accountNumber（银行账号），必须返回16-19位数字的银行账号（如：'6222021234567890123'），绝对不能返回手机号，也不能返回'请输入银行账号'等placeholder文本\n11. 如果字段是taxNumber（税号），必须返回18位统一社会信用代码或15位纳税人识别号（如：'91110000123456789X'），绝对不能返回'请输入税号'、'税号'等placeholder或label文本\n12. 所有返回的值都必须是真实的模拟数据，不能是字段名称、提示文本、说明性文字或示例性文字"

    // 构建请求体
    const requestBody = {
      model: "lite", // 固定使用 lite 模型
      messages: [
        {
          role: "system",
          content:
            customSystemPrompt && customSystemPrompt.trim()
              ? customSystemPrompt.trim()
              : defaultSystemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 4096,
      top_k: 6,
      temperature: 0.4, // 降低温度值，确保严格遵循指令，生成真实数据而非说明性文字
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
      throw new Error(
        `JSON解析失败: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`
      )
    }

    // 检查解析后的数据是否为空
    if (
      !formData ||
      typeof formData !== "object" ||
      Object.keys(formData).length === 0
    ) {
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

  prompt += `【重要说明 - 必须严格遵守】\n`
  // prompt += `1. label（字段名称）只是用来理解字段含义的，绝对不能作为返回值\n`
  // prompt += `2. placeholder（提示信息）只是告诉用户应该输入什么，绝对不能作为返回值\n`
  // prompt += `3. 你必须根据字段的label（字段名称）来理解字段的含义，然后生成对应的真实模拟数据\n`
  // prompt += `4. 绝对禁止返回label文本本身，例如：如果label是"客户简称"，绝对不能返回"客户简称"，必须生成"北京科技"、"上海贸易"这样的真实公司简称\n`
  // prompt += `5. 绝对禁止返回placeholder文本，例如：绝对不能返回"请输入客户简称"，必须生成"北京科技"、"上海贸易"这样的真实公司简称\n`
  // prompt += `6. 所有返回的值都必须是真实的模拟数据，不能是字段名称、提示文本或任何说明性文字\n`
  // prompt += `7. 如果label是"姓名"，必须生成"李明"、"王芳"这样的真实姓名，绝对不能返回"姓名"或"请输入姓名"\n`
  // prompt += `8. 如果label是"手机号"，必须生成"13812345678"这样的真实手机号，绝对不能返回"手机号"或"请输入手机号"\n\n`

  prompt += `【表单字段信息】\n`
  // fields.forEach((field, index) => {
  //   // 确定字段的唯一标识（优先使用id，其次name，最后使用field1、field2等）
  //   const fieldKey = field.id || field.name || `field${index + 1}`

  //   // 根据id、name和label智能推断字段含义
  //   let fieldDescription = ""
  //   const idOrName = field.id || field.name || ""

  //   // 根据id/name推断字段含义（更准确）
  //   if (
  //     idOrName.includes("invoiceTitle") ||
  //     idOrName.includes("invoice_title")
  //   ) {
  //     fieldDescription = "发票抬头（公司全称，如：北京科技有限公司）"
  //   } else if (
  //     idOrName.includes("totalPaymentAmount") ||
  //     idOrName.includes("paymentAmount") ||
  //     idOrName.includes("amount")
  //   ) {
  //     fieldDescription = "回款金额（数字，如：5000.00）"
  //   } else if (idOrName.includes("paymentDate") || idOrName.includes("date")) {
  //     fieldDescription = "回款日期（日期格式：YYYY-MM-DD，如：2023-06-20）"
  //   } else if (
  //     idOrName.includes("bankName") ||
  //     idOrName.includes("bank_name") ||
  //     idOrName.includes("开户银行")
  //   ) {
  //     fieldDescription =
  //       "开户银行（真实银行名称，如：中国工商银行、中国建设银行、中国农业银行）"
  //   } else if (
  //     idOrName.includes("accountNumber") ||
  //     idOrName.includes("account_number") ||
  //     idOrName.includes("银行账号") ||
  //     idOrName.includes("账号")
  //   ) {
  //     fieldDescription = "银行账号（16-19位数字，如：6222021234567890123）"
  //   } else if (
  //     idOrName.includes("taxNumber") ||
  //     idOrName.includes("tax_number") ||
  //     idOrName.includes("税号") ||
  //     idOrName.includes("纳税人识别号")
  //   ) {
  //     fieldDescription =
  //       "税号（18位统一社会信用代码或15位纳税人识别号，如：91110000123456789X）"
  //   } else if (
  //     idOrName.includes("taxTitle") ||
  //     idOrName.includes("tax_title") ||
  //     idOrName.includes("发票抬头")
  //   ) {
  //     fieldDescription = "发票抬头（公司全称，如：北京科技有限公司）"
  //   } else if (idOrName.includes("name") && !idOrName.includes("company")) {
  //     fieldDescription = "姓名（中文姓名，如：李明、王芳）"
  //   } else if (idOrName.includes("phone") || idOrName.includes("mobile")) {
  //     fieldDescription = "手机号（11位数字，如：13812345678）"
  //   } else if (idOrName.includes("email")) {
  //     fieldDescription = "邮箱地址（如：zhang@example.com）"
  //   } else if (idOrName.includes("address")) {
  //     fieldDescription = "地址（如：北京市朝阳区建国路1号）"
  //   } else if (
  //     field.label.includes("开户银行") ||
  //     field.label.includes("银行名称")
  //   ) {
  //     fieldDescription =
  //       "开户银行（真实银行名称，如：中国工商银行、中国建设银行、中国农业银行）"
  //   } else if (
  //     field.label.includes("银行账号") ||
  //     field.label.includes("账号") ||
  //     (field.label.includes("账户") && !field.label.includes("开户"))
  //   ) {
  //     fieldDescription = "银行账号（16-19位数字，如：6222021234567890123）"
  //   } else if (
  //     field.label.includes("税号") ||
  //     field.label.includes("纳税人识别号") ||
  //     field.label.includes("统一社会信用代码")
  //   ) {
  //     fieldDescription =
  //       "税号（18位统一社会信用代码或15位纳税人识别号，如：91110000123456789X）"
  //   } else if (
  //     field.label.includes("发票抬头") ||
  //     field.label.includes("抬头")
  //   ) {
  //     fieldDescription = "发票抬头（公司全称，如：北京科技有限公司）"
  //   } else if (
  //     field.label.includes("金额") ||
  //     field.label.includes("价格") ||
  //     field.label.includes("费用")
  //   ) {
  //     fieldDescription = "金额（数字，如：5000.00）"
  //   } else if (field.label.includes("日期")) {
  //     fieldDescription = "日期（格式：YYYY-MM-DD，如：2023-06-20）"
  //   } else if (field.label.includes("姓名") || field.label.includes("名字")) {
  //     fieldDescription = "姓名（中文姓名，如：李明、王芳）"
  //   } else if (field.label.includes("手机") || field.label.includes("电话")) {
  //     fieldDescription = "手机号（11位数字，如：13812345678）"
  //   } else if (field.label.includes("邮箱") || field.label.includes("邮件")) {
  //     fieldDescription = "邮箱地址（如：zhang@example.com）"
  //   } else if (field.label.includes("地址")) {
  //     fieldDescription = "地址（如：北京市朝阳区建国路1号）"
  //   } else if (field.label.includes("发票")) {
  //     fieldDescription =
  //       "发票相关信息（如：发票抬头返回公司名称，发票内容返回服务项目名称）"
  //   } else {
  //     fieldDescription = `根据字段含义生成的真实数据（绝对不能返回"${field.label}"或placeholder文本）`
  //   }

  //   prompt += `${index + 1}. 字段标识：${fieldKey}\n`
  //   prompt += `   - 字段名称（label）：${field.label}\n`
  //   prompt += `   - 字段类型：${field.type}\n`
  //   if (field.id) {
  //     prompt += `   - id属性：${field.id}\n`
  //   }
  //   if (field.name) {
  //     prompt += `   - name属性：${field.name}\n`
  //   }
  //   if (field.placeholder) {
  //     prompt += `   - 提示信息（placeholder）：${field.placeholder} 【⚠️ 警告：这是提示文本，绝对不能作为返回值！】\n`
  //   }
  //   if (field.required) {
  //     prompt += `   - 必填：是\n`
  //   }
  //   prompt += `   - 字段含义：${fieldDescription}\n`
  //   prompt += `   - 需要生成：${fieldDescription.replace(
  //     /（.*?）/g,
  //     ""
  //   )}，绝对不能返回"${field.label}"、"${
  //     field.placeholder || ""
  //   }"或任何提示性文字\n`
  //   prompt += `\n`
  // })

  prompt += `【返回格式要求】\n`
  prompt += `你必须返回纯JSON格式的响应。不要使用markdown代码块（不要用\`\`\`json或\`\`\`包裹），不要添加任何文字说明，直接返回JSON对象。\n\n`

  prompt += `【JSON结构 - 必须直接返回真实数据】\n`
  prompt += `返回的JSON格式如下，注意：所有值都必须是真实的模拟数据，不能是说明性文字：\n`
  prompt += `【重要】JSON的key必须使用字段的id或name属性，确保与表单字段一一对应！\n`
  prompt += `{\n`
  const fieldKeys: string[] = []
  fields.forEach((field, index) => {
    // 优先使用id，其次name，最后使用field1、field2等
    const key = field.id || field.name || `field${index + 1}`
    fieldKeys.push(key)

    // 根据id/name和label智能推断应该生成什么数据
    const idOrName = field.id || field.name || ""
    let dataDescription = ""

    // // 优先根据id/name推断（更准确）
    // if (
    //   idOrName.includes("invoiceTitle") ||
    //   idOrName.includes("invoice_title")
    // ) {
    //   dataDescription = "发票抬头（公司全称，如：北京科技有限公司）"
    // } else if (
    //   idOrName.includes("totalPaymentAmount") ||
    //   idOrName.includes("paymentAmount") ||
    //   idOrName.includes("amount")
    // ) {
    //   dataDescription = "回款金额（数字，如：5000.00）"
    // } else if (idOrName.includes("paymentDate") || idOrName.includes("date")) {
    //   dataDescription = "回款日期（日期格式：YYYY-MM-DD，如：2023-06-20）"
    // } else if (
    //   idOrName.includes("bankName") ||
    //   idOrName.includes("bank_name") ||
    //   idOrName.includes("开户银行")
    // ) {
    //   dataDescription =
    //     "开户银行（真实银行名称，如：中国工商银行、中国建设银行、中国农业银行）"
    // } else if (
    //   idOrName.includes("accountNumber") ||
    //   idOrName.includes("account_number") ||
    //   idOrName.includes("银行账号") ||
    //   idOrName.includes("账号")
    // ) {
    //   dataDescription = "银行账号（16-19位数字，如：6222021234567890123）"
    // } else if (
    //   idOrName.includes("taxNumber") ||
    //   idOrName.includes("tax_number") ||
    //   idOrName.includes("税号") ||
    //   idOrName.includes("纳税人识别号")
    // ) {
    //   dataDescription =
    //     "税号（18位统一社会信用代码或15位纳税人识别号，如：91110000123456789X）"
    // } else if (
    //   idOrName.includes("taxTitle") ||
    //   idOrName.includes("tax_title") ||
    //   idOrName.includes("发票抬头")
    // ) {
    //   dataDescription = "发票抬头（公司全称，如：北京科技有限公司）"
    // } else if (idOrName.includes("name") && !idOrName.includes("company")) {
    //   dataDescription = "姓名（中文姓名，如：李明、王芳）"
    // } else if (idOrName.includes("phone") || idOrName.includes("mobile")) {
    //   dataDescription = "手机号（11位数字，如：13812345678）"
    // } else if (idOrName.includes("email")) {
    //   dataDescription = "邮箱地址（如：zhang@example.com）"
    // } else if (idOrName.includes("address")) {
    //   dataDescription = "地址（如：北京市朝阳区建国路1号）"
    // } else if (
    //   field.label.includes("开户银行") ||
    //   field.label.includes("银行名称")
    // ) {
    //   dataDescription =
    //     "开户银行（真实银行名称，如：中国工商银行、中国建设银行、中国农业银行）"
    // } else if (
    //   field.label.includes("银行账号") ||
    //   field.label.includes("账号") ||
    //   (field.label.includes("账户") && !field.label.includes("开户"))
    // ) {
    //   dataDescription = "银行账号（16-19位数字，如：6222021234567890123）"
    // } else if (
    //   field.label.includes("税号") ||
    //   field.label.includes("纳税人识别号") ||
    //   field.label.includes("统一社会信用代码")
    // ) {
    //   dataDescription =
    //     "税号（18位统一社会信用代码或15位纳税人识别号，如：91110000123456789X）"
    // } else if (
    //   field.label.includes("发票抬头") ||
    //   field.label.includes("抬头")
    // ) {
    //   dataDescription = "发票抬头（公司全称，如：北京科技有限公司）"
    // } else if (
    //   field.label.includes("金额") ||
    //   field.label.includes("价格") ||
    //   field.label.includes("费用") ||
    //   field.label.includes("回款金额")
    // ) {
    //   dataDescription = "金额（数字，如：5000.00）"
    // } else if (
    //   field.label.includes("日期") ||
    //   field.label.includes("回款日期")
    // ) {
    //   dataDescription = "日期（格式：YYYY-MM-DD，如：2023-06-20）"
    // } else if (field.label.includes("姓名") || field.label.includes("名字")) {
    //   dataDescription = "姓名（中文姓名，如：李明、王芳）"
    // } else if (field.label.includes("手机") || field.label.includes("电话")) {
    //   dataDescription = "手机号（11位数字，如：13812345678）"
    // } else if (field.label.includes("邮箱") || field.label.includes("邮件")) {
    //   dataDescription = "邮箱地址（如：zhang@example.com）"
    // } else if (field.label.includes("地址")) {
    //   dataDescription = "地址（如：北京市朝阳区建国路1号）"
    // } else if (field.label.includes("发票")) {
    //   dataDescription =
    //     "发票相关信息（如：发票抬头返回公司名称，发票内容返回服务项目名称）"
    // } else {
    //   dataDescription = "根据字段含义生成的真实数据"
    // }

    prompt += `  "${key}": <这里必须返回真实的${dataDescription.replace(
      /（.*?）/g,
      ""
    )}，绝对不能返回"${field.label}"、"${
      field.placeholder || ""
    }"、"${dataDescription}"或任何说明性文字>,\n`
  })
  prompt += `}\n\n`

  // prompt += `【错误示例 - 绝对不能这样做】\n`
  // prompt += `错误1：返回说明性文字\n`
  // prompt += `  "field1": "随机生成的中文姓名"  ❌ 错误\n`
  // prompt += `  "field1": "李明"  ✅ 正确\n\n`
  // prompt += `错误2：返回示例性文字\n`
  // prompt += `  "field2": "随机日期（例如：2023-06-20）"  ❌ 错误\n`
  // prompt += `  "field2": "2023-06-20"  ✅ 正确\n\n`
  // prompt += `错误3：返回label或placeholder\n`
  // prompt += `  "field3": "发票抬头"  ❌ 错误\n`
  // prompt += `  "field3": "北京科技有限公司"  ✅ 正确\n\n`
  // prompt += `错误4：返回提示性文字或placeholder\n`
  // prompt += `  "totalPaymentAmount": "请输入申请开票金额"  ❌ 错误（这是placeholder文本）\n`
  // prompt += `  "totalPaymentAmount": "5000.00"  ✅ 正确\n\n`
  // prompt += `错误5：返回placeholder文本\n`
  // prompt += `  "paymentDate": "请选择回款日期"  ❌ 错误（这是placeholder文本）\n`
  // prompt += `  "paymentDate": "2023-06-20"  ✅ 正确\n\n`
  // prompt += `错误6：返回placeholder文本（银行相关字段）\n`
  // prompt += `  "bankName": "请输入开户银行"  ❌ 错误（这是placeholder文本）\n`
  // prompt += `  "bankName": "中国工商银行"  ✅ 正确\n\n`
  // prompt += `错误7：返回placeholder文本（税号字段）\n`
  // prompt += `  "taxNumber": "请输入税号"  ❌ 错误（这是placeholder文本）\n`
  // prompt += `  "taxNumber": "91110000123456789X"  ✅ 正确\n\n`
  // prompt += `错误8：字段类型混淆\n`
  // prompt += `  "accountNumber": "13812345678"  ❌ 错误（这是手机号，不是银行账号）\n`
  // prompt += `  "accountNumber": "6222021234567890123"  ✅ 正确（银行账号是16-19位数字）\n\n`

  // prompt += `【生成规则 - 严格遵守】\n`
  // prompt += `1. 根据字段的label和type生成符合实际场景的真实模拟数据\n`
  // prompt += `2. **绝对禁止：不能返回label文本、placeholder文本、说明性文字（如"随机生成XXX"）、示例性文字（如"例如：XXX"），只能返回真实的模拟数据**\n`
  // prompt += `3. **重要：每次生成的数据必须完全不同，要有随机性和多样性**\n`
  // prompt += `4. **关键：所有值都必须是可直接使用的真实数据，不能包含任何解释、说明或示例性文字**\n`
  // prompt += `5. 如果label是'姓名'，必须返回'李明'、'王芳'这样的真实姓名，绝对不能返回'姓名'、'请输入姓名'、'随机生成的中文姓名'等\n`
  // prompt += `6. 如果是手机号字段，直接返回随机的11位手机号（如：13812345678），不能返回'随机手机号'、'请输入手机号'等\n`
  // prompt += `7. 如果是邮箱字段，直接返回随机的有效邮箱地址（如：zhang@example.com），不能返回'随机邮箱'、'请输入邮箱'等\n`
  // prompt += `8. 如果是日期字段，直接返回YYYY-MM-DD格式的日期（如：2023-06-20），不能返回'随机日期（例如：2023-06-20）'、'请输入日期'等\n`
  // prompt += `9. 如果是数字字段，直接返回数字（如：1000.50），不能返回'随机数字'、'请输入金额'等\n`
  // prompt += `10. 如果是文本字段，直接返回有意义的文本内容，不能返回'随机文本'、'请输入XXX'等\n`
  // prompt += `11. 如果是公司名称字段，直接返回公司名称（如：北京科技有限公司），不能返回'公司名称'、'请输入公司名称'等\n`
  // prompt += `12. 如果是地址字段，直接返回地址（如：北京市朝阳区建国路1号），不能返回'地址'、'请输入地址'等\n`
  // prompt += `13. 如果是发票相关字段，直接返回发票信息（如：发票抬头返回'北京科技有限公司'，发票描述返回'技术服务费'），不能返回'发票抬头'、'发票描述'等label文本\n`
  // prompt += `14. 如果是开户银行字段（bankName），直接返回真实银行名称（如：'中国工商银行'、'中国建设银行'、'中国农业银行'、'中国银行'、'招商银行'等），绝对不能返回'请输入开户银行'、'开户银行'等placeholder或label文本\n`
  // prompt += `15. 如果是银行账号字段（accountNumber），直接返回16-19位数字的银行账号（如：'6222021234567890123'），绝对不能返回手机号或其他类型数据，也不能返回'请输入银行账号'、'银行账号'等placeholder或label文本\n`
  // prompt += `16. 如果是税号字段（taxNumber），直接返回18位统一社会信用代码或15位纳税人识别号（如：'91110000123456789X'、'123456789012345'），绝对不能返回'请输入税号'、'税号'等placeholder或label文本\n`
  // prompt += `17. 所有数据要符合中国实际情况，但每次都要有变化\n`
  // prompt += `18. **JSON的key必须使用字段的id属性（优先），如果没有id则使用name属性，都没有则使用field1、field2等**\n`
  // prompt += `19. **绝对禁止返回placeholder文本，例如：如果placeholder是"请输入申请开票金额"，绝对不能返回"请输入申请开票金额"，必须返回"5000.00"这样的真实金额**\n`
  // prompt += `20. **绝对禁止返回placeholder文本，例如：如果placeholder是"请输入开户银行"，绝对不能返回"请输入开户银行"，必须返回"中国工商银行"这样的真实银行名称**\n`
  // prompt += `21. **绝对禁止返回placeholder文本，例如：如果placeholder是"请输入税号"，绝对不能返回"请输入税号"，必须返回"91110000123456789X"这样的真实税号**\n`
  // prompt += `22. **禁止重复使用相同的数据，每次调用都要生成全新的随机数据**\n`
  // prompt += `23. 所有返回的值都必须是真实的模拟数据，根据这些字段组合，猜测业务场景，并生成符合业务场景的模拟数据\n`
  // prompt += `24. **最后强调：返回的JSON中，每个值都必须是可直接使用的真实数据，绝对不能包含"随机生成"、"例如"、"请输入"、"请选择"等任何说明性或提示性文字**\n`
  // prompt += `25. **特别提醒：如果字段有placeholder属性，placeholder只是提示用户应该输入什么，绝对不能作为返回值！必须根据字段的id、name和label推断字段含义，生成对应的真实数据**\n`
  // prompt += `26. **字段类型必须准确匹配：accountNumber（银行账号）必须返回16-19位数字，不能返回手机号；bankName（开户银行）必须返回真实银行名称；taxNumber（税号）必须返回18位或15位税号**\n`
  prompt += `字段的值请根据label自动推导出来符合语义的mock数据，真实的数据，根据全部的label，整体分析推导出来模拟数据，不要是XXXXX等这些模糊数据。`
  return prompt
}

/**
 * 从内容中提取JSON字符串
 * 专门处理markdown代码块包裹的JSON格式（接口固定返回markdown格式）
 * @param content 原始内容，可能包含 ```json ... ``` 格式的markdown代码块
 * @returns 提取的JSON字符串
 */
function extractJsonFromContent(content: string): string {
  if (!content || typeof content !== "string") {
    throw new Error("内容为空或格式错误")
  }

  const trimmedContent = content.trim()

  // 方法1：优先使用简单正则提取markdown代码块中的JSON
  // 使用 /```(json)?(.*)```/s 正则表达式，s标志允许.匹配换行符
  // 注意：在JavaScript中，如果环境不支持s标志，使用[\s\S]代替.
  try {
    // 尝试使用s标志（ES2018+支持）
    const simpleRegex = /```(json)?([\s\S]*?)```/
    const match = simpleRegex.exec(trimmedContent)

    if (match && match[2]) {
      // 提取代码块中的内容
      let extracted = match[2].trim()

      // 清理提取的内容
      extracted = cleanJsonString(extracted)

      // 尝试解析JSON
      try {
        const parsed = JSON.parse(extracted)
        // 验证解析结果是否为对象
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          console.log("成功使用简单正则从markdown代码块提取JSON")
          return extracted
        }
      } catch (parseError) {
        // 解析失败，继续使用复杂逻辑
        console.log("简单正则提取的内容无法解析为JSON，使用复杂逻辑")
      }
    } else {
      // 没有匹配到代码块，尝试直接解析整个内容
      try {
        const parsed = JSON.parse(trimmedContent)
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          console.log("成功直接解析内容为JSON")
          return trimmedContent
        }
      } catch (parseError) {
        // 直接解析失败，继续使用复杂逻辑
        console.log("直接解析失败，使用复杂逻辑提取")
      }
    }
  } catch (error) {
    // 简单方法出错，继续使用复杂逻辑
    console.log("简单正则提取出错，使用复杂逻辑:", error)
  }

  // 方法2：如果简单正则提取失败，使用复杂的提取逻辑
  // 匹配多种markdown代码块格式：
  // - ```json\n{...}\n```
  // - ```json\n{...}```
  // - ```\n{...}\n```
  // - ```{...}```
  // 使用非贪婪匹配，但确保匹配到完整的代码块
  const codeBlockPatterns = [
    // 匹配 ```json 开头，``` 结尾的代码块（最严格）
    /```json\s*\n([\s\S]*?)\n```/,
    // 匹配 ```json 开头，``` 结尾（可能没有换行）
    /```json\s*([\s\S]*?)```/,
    // 匹配 ``` 开头，``` 结尾的代码块（通用格式）
    /```\s*\n([\s\S]*?)\n```/,
    // 匹配 ``` 开头，``` 结尾（可能没有换行）
    /```\s*([\s\S]*?)```/,
  ]

  for (const pattern of codeBlockPatterns) {
    const match = trimmedContent.match(pattern)
    if (match && match[1]) {
      let extracted = match[1].trim()

      // 清理提取的内容
      extracted = cleanJsonString(extracted)

      // 验证并返回
      if (isValidJson(extracted)) {
        console.log("成功从markdown代码块提取JSON（复杂逻辑）")
        return extracted
      }
    }
  }

  // 方法2：如果代码块提取失败，尝试直接查找JSON对象
  // 查找第一个 { 到匹配的 } 之间的内容
  const firstBraceIndex = trimmedContent.indexOf("{")
  if (firstBraceIndex !== -1) {
    const jsonString = extractJsonObject(trimmedContent, firstBraceIndex)
    if (jsonString) {
      const cleaned = cleanJsonString(jsonString)
      if (isValidJson(cleaned)) {
        console.log("成功从内容中提取JSON对象")
        return cleaned
      }
    }
  }

  // 方法3：最后尝试清理整个内容后解析
  // 移除所有可能的markdown标记
  let cleaned = trimmedContent
    // 移除代码块开始标记（支持多种格式）
    .replace(/^```(?:json)?\s*/gm, "")
    .replace(/^```\s*/gm, "")
    // 移除代码块结束标记
    .replace(/```\s*$/gm, "")
    .replace(/```$/gm, "")
    // 移除尾随逗号（JSON不允许尾随逗号）
    .replace(/,(\s*[}\]])/g, "$1")
    .trim()

  // 再次尝试提取JSON对象
  const braceIndex = cleaned.indexOf("{")
  if (braceIndex !== -1) {
    const jsonString = extractJsonObject(cleaned, braceIndex)
    if (jsonString) {
      const finalCleaned = cleanJsonString(jsonString)
      if (isValidJson(finalCleaned)) {
        console.log("成功从清理后的内容中提取JSON")
        return finalCleaned
      }
    }
  }

  // 如果所有方法都失败，抛出错误
  console.error("所有JSON提取方法都失败")
  console.error("原始内容:", trimmedContent)
  throw new Error("无法从内容中提取有效的JSON，请检查返回格式是否正确")
}

/**
 * 清理JSON字符串，移除常见的格式问题
 * @param jsonString JSON字符串
 * @returns 清理后的JSON字符串
 */
function cleanJsonString(jsonString: string): string {
  if (!jsonString || typeof jsonString !== "string") {
    return ""
  }

  let cleaned = jsonString.trim()

  // 移除尾随逗号（JSON不允许尾随逗号）
  // 匹配 ,} 或 ,] 的情况
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1")

  // 移除可能的BOM标记
  cleaned = cleaned.replace(/^\uFEFF/, "")

  // 确保以 { 开头，} 结尾
  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }

  return cleaned.trim()
}

/**
 * 验证字符串是否为有效的JSON
 * @param jsonString 待验证的字符串
 * @returns 是否为有效的JSON
 */
function isValidJson(jsonString: string): boolean {
  if (!jsonString || typeof jsonString !== "string") {
    return false
  }

  // 基本格式检查：必须以 { 开头，} 结尾
  const trimmed = jsonString.trim()
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return false
  }

  // 尝试解析JSON
  try {
    const parsed = JSON.parse(trimmed)
    // 确保解析后是对象且不为空
    return (
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    )
  } catch (e) {
    return false
  }
}

/**
 * 从字符串中提取完整的JSON对象
 * 从指定的起始位置开始，找到匹配的 { } 对
 * @param content 内容字符串
 * @param startIndex 起始位置（第一个 { 的位置）
 * @returns 提取的JSON字符串，如果失败返回null
 */
function extractJsonObject(content: string, startIndex: number): string | null {
  if (startIndex < 0 || startIndex >= content.length) {
    return null
  }

  let braceCount = 0
  let jsonEndIndex = -1
  let inString = false
  let escapeNext = false

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i]

    // 处理转义字符
    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === "\\") {
      escapeNext = true
      continue
    }

    // 处理字符串内的引号
    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }

    // 在字符串外才处理大括号
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

  // 如果找到了匹配的结束位置
  if (jsonEndIndex !== -1) {
    return content.substring(startIndex, jsonEndIndex + 1)
  }

  return null
}
