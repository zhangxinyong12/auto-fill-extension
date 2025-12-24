/**
 * 表单工具函数
 * 用于识别和操作页面表单元素
 */

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
 * 查找当前活动的弹窗（modal）元素
 * 通过检查定位属性（position: fixed/absolute）和 z-index 来判断
 * @returns 弹窗元素，如果没有弹窗则返回null
 */
function findActiveModal(): HTMLElement | null {
  try {
    // 查找所有可能的弹窗元素
    // 弹窗通常具有以下特征：
    // 1. position: fixed 或 absolute
    // 2. 较高的 z-index（通常 >= 1000）
    // 3. 可见（display !== 'none', visibility !== 'hidden'）
    // 4. 可能包含 role="dialog" 或常见的弹窗类名

    const allElements = document.querySelectorAll("*")
    const candidateModals: Array<{ element: HTMLElement; zIndex: number }> = []

    for (const element of allElements) {
      try {
        const htmlElement = element as HTMLElement

        // 跳过我们的自动填充按钮本身（避免误判）
        if (
          htmlElement.getAttribute("data-plasmo-inline") ||
          htmlElement.closest("[data-plasmo-inline]")
        ) {
          continue
        }

        const style = window.getComputedStyle(htmlElement)

        // 跳过不可见的元素
        if (style.display === "none" || style.visibility === "hidden") {
          continue
        }

        // 检查定位属性
        const position = style.position
        if (position !== "fixed" && position !== "absolute") {
          continue
        }

        // 检查 z-index（弹窗通常有较高的 z-index，至少 >= 1000）
        const zIndex = parseInt(style.zIndex, 10)

        // 如果 z-index 小于 1000，需要额外的标识来确认是弹窗
        if (isNaN(zIndex) || zIndex < 1000) {
          // 检查是否有 role="dialog" 或其他弹窗标识
          const hasDialogRole = htmlElement.getAttribute("role") === "dialog"

          // 安全地获取 className（可能是字符串或 DOMTokenList）
          const className = htmlElement.className
          let classNameStr = ""
          if (typeof className === "string") {
            classNameStr = className
          } else if (
            className &&
            typeof className === "object" &&
            "toString" in className
          ) {
            classNameStr = String(className)
          }

          const hasModalClass =
            classNameStr.includes("modal") ||
            classNameStr.includes("dialog") ||
            classNameStr.includes("popup") ||
            classNameStr.includes("overlay")

          // 如果没有弹窗标识，且 z-index 小于 1000，跳过
          if (!hasDialogRole && !hasModalClass) {
            continue
          }
        }

        // 检查元素是否包含表单元素（弹窗通常包含表单）
        const hasFormElements = htmlElement.querySelector(
          "input, textarea, select"
        )
        if (!hasFormElements) {
          // 如果没有表单元素，可能不是我们要找的弹窗，跳过
          continue
        }

        // 检查元素尺寸（弹窗通常不会太小）
        const rect = htmlElement.getBoundingClientRect()
        if (rect.width < 200 || rect.height < 100) {
          continue
        }

        // 这是一个候选弹窗
        candidateModals.push({
          element: htmlElement,
          zIndex: zIndex || 0,
        })
      } catch (err) {
        // 跳过出错的元素，继续处理下一个
        continue
      }
    }

    // 如果没有找到候选弹窗，返回 null
    if (candidateModals.length === 0) {
      return null
    }

    // 按 z-index 降序排序，返回 z-index 最高的弹窗
    candidateModals.sort((a, b) => b.zIndex - a.zIndex)

    // 返回 z-index 最高的弹窗
    return candidateModals[0].element
  } catch (error) {
    // 如果检测过程出错，返回 null，这样会在整个页面搜索表单
    console.warn("弹窗检测出错:", error)
    return null
  }
}

/**
 * 获取表单字段信息
 * 如果页面有打开的弹窗，只检查弹窗内的表单元素
 * @returns 表单字段列表
 */
export function getFormFields(): FormField[] {
  const fields: FormField[] = []

  // 查找活动的弹窗
  const activeModal = findActiveModal()

  // 确定搜索范围：如果有弹窗，只在弹窗内搜索；否则在整个页面搜索
  const searchRoot = activeModal || document

  // 获取搜索范围内的所有表单元素
  const formElements = searchRoot.querySelectorAll(
    "input, textarea, select"
  ) as NodeListOf<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>

  formElements.forEach((element) => {
    // 跳过隐藏元素和按钮（textarea没有type属性，需要特殊处理）
    if (element.tagName !== "TEXTAREA" && element.tagName !== "SELECT") {
      const inputElement = element as HTMLInputElement
      if (
        inputElement.type === "hidden" ||
        inputElement.type === "submit" ||
        inputElement.type === "button" ||
        inputElement.type === "reset" ||
        inputElement.type === "radio" // 跳过radio按钮，通常不需要自动填充
      ) {
        return
      }
    }

    // 跳过已禁用的元素
    if (element.disabled) {
      return
    }

    // 获取label - 只通过label[for]属性关联，简化逻辑
    let label = ""
    const id = element.id
    const name = element.name

    // 只通过label[for]属性查找label，忽略其他复杂结构
    // 在搜索范围内查找label（如果是在弹窗内，只在弹窗内查找）
    if (id) {
      const labelElement = searchRoot.querySelector(`label[for="${id}"]`)
      if (labelElement) {
        // 只获取label元素的文本内容，清理掉可能的图标、按钮等子元素
        label = labelElement.textContent?.trim() || ""
        // 移除可能的必填标记（如*号）
        label = label.replace(/\s*\*+\s*/, "").trim()
      }
    }

    // 如果通过for属性没找到label，优先使用id或name，最后才使用placeholder
    // 因为placeholder是提示文本，不应该作为字段标识
    if (!label) {
      // 优先使用id或name作为label（如果它们有语义）
      if (id && id.length > 0 && !id.match(/^:r\d+:$/)) {
        // id有值且不是radio按钮的id格式（如:r2:），使用id
        label = id
      } else if (name && name.length > 0 && !name.match(/^:r\d+:$/)) {
        // name有值且不是radio按钮的name格式，使用name
        label = name
      } else {
        // HTMLSelectElement 没有 placeholder 属性，需要类型判断
        const placeholder =
          element.tagName === "SELECT"
            ? undefined
            : (element as HTMLInputElement | HTMLTextAreaElement).placeholder
        // 如果placeholder存在且不是纯提示文本（如"请输入"），可以使用
        if (placeholder && placeholder.length > 0) {
          label = placeholder
        } else {
          // 最后才使用type或默认值
          label = element.type || "未命名字段"
        }
      }
    }

    // 过滤掉无意义的label（如单个字符、纯类型名等）
    // 如果label是"text"、"input"等无意义的文本，且没有id和name，则跳过该字段
    if (
      (!id || id.match(/^:r\d+:$/)) &&
      (!name || name.match(/^:r\d+:$/)) &&
      (label === "text" ||
        label === "input" ||
        label === "未命名字段" ||
        label.length <= 1)
    ) {
      return
    }

    // 获取字段类型
    let fieldType = element.type || "text"
    if (element.tagName === "TEXTAREA") {
      fieldType = "textarea"
    } else if (element.tagName === "SELECT") {
      fieldType = "select"
    }

    // 检查是否必填
    const required =
      element.hasAttribute("required") ||
      element.getAttribute("aria-required") === "true"

    // HTMLSelectElement 没有 placeholder 属性，需要类型判断
    const placeholder =
      element.tagName === "SELECT"
        ? undefined
        : (element as HTMLInputElement | HTMLTextAreaElement).placeholder ||
          undefined

    fields.push({
      label: label,
      type: fieldType,
      name: name || undefined,
      id: id || undefined,
      placeholder: placeholder,
      required: required,
    })
  })

  return fields
}

/**
 * 填充表单数据
 * 如果页面有打开的弹窗，只填充弹窗内的表单元素
 * @param data 表单数据对象，key为字段的name或id
 */
export function fillFormData(data: Record<string, any>): void {
  // 查找活动的弹窗
  const activeModal = findActiveModal()

  // 确定搜索范围：如果有弹窗，只在弹窗内搜索；否则在整个页面搜索
  const searchRoot = activeModal || document

  // 获取搜索范围内的所有表单元素
  const formElements = searchRoot.querySelectorAll(
    "input, textarea, select"
  ) as NodeListOf<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>

  // 创建一个映射，用于通过label查找字段
  const labelToFieldMap: Record<string, string> = {}
  formElements.forEach((element) => {
    // 跳过隐藏元素和按钮（textarea没有type属性，需要特殊处理）
    if (element.tagName !== "TEXTAREA" && element.tagName !== "SELECT") {
      const inputElement = element as HTMLInputElement
      if (
        inputElement.type === "hidden" ||
        inputElement.type === "submit" ||
        inputElement.type === "button" ||
        inputElement.type === "reset"
      ) {
        return
      }
    }

    // 跳过已禁用的元素
    if (element.disabled) {
      return
    }

    // 获取字段的label - 只通过label[for]属性关联
    let label = ""
    const id = element.id
    const name = element.name

    // 只通过label[for]属性查找label（在搜索范围内查找）
    if (id) {
      const labelElement = searchRoot.querySelector(`label[for="${id}"]`)
      if (labelElement) {
        label = labelElement.textContent?.trim() || ""
        // 移除可能的必填标记（如*号）
        label = label.replace(/\s*\*+\s*/, "").trim()
      }
    }

    // 如果没找到label，使用placeholder（HTMLSelectElement 没有 placeholder 属性）
    if (!label) {
      const placeholder =
        element.tagName === "SELECT"
          ? undefined
          : (element as HTMLInputElement | HTMLTextAreaElement).placeholder
      label = placeholder || ""
    }

    // 建立label到字段标识的映射
    if (label) {
      const fieldKey = name || id || ""
      if (fieldKey) {
        labelToFieldMap[label] = fieldKey
      }
    }
  })

  formElements.forEach((element) => {
    // 跳过隐藏元素和按钮（textarea没有type属性，需要特殊处理）
    if (element.tagName !== "TEXTAREA" && element.tagName !== "SELECT") {
      const inputElement = element as HTMLInputElement
      if (
        inputElement.type === "hidden" ||
        inputElement.type === "submit" ||
        inputElement.type === "button" ||
        inputElement.type === "reset"
      ) {
        return
      }
    }

    // 跳过已禁用的元素
    if (element.disabled) {
      return
    }

    // 尝试通过name匹配
    let value: any = null
    if (element.name && data[element.name] !== undefined) {
      value = data[element.name]
    }
    // 如果name没匹配到，尝试通过id匹配
    else if (element.id && data[element.id] !== undefined) {
      value = data[element.id]
    }
    // 如果都没匹配到，尝试通过label匹配
    else {
      // 获取当前字段的label - 只通过label[for]属性关联（在搜索范围内查找）
      let label = ""
      if (element.id) {
        const labelElement = searchRoot.querySelector(
          `label[for="${element.id}"]`
        )
        if (labelElement) {
          label = labelElement.textContent?.trim() || ""
          // 移除可能的必填标记（如*号）
          label = label.replace(/\s*\*+\s*/, "").trim()
        }
      }
      if (!label) {
        // HTMLSelectElement 没有 placeholder 属性，需要类型判断
        const placeholder =
          element.tagName === "SELECT"
            ? undefined
            : (element as HTMLInputElement | HTMLTextAreaElement).placeholder
        label = placeholder || ""
      }

      // 通过label查找对应的数据key
      if (label && labelToFieldMap[label]) {
        const dataKey = labelToFieldMap[label]
        if (data[dataKey] !== undefined) {
          value = data[dataKey]
        }
      }

      // 如果还是没找到，尝试直接通过label作为key查找
      if (value === null && label && data[label] !== undefined) {
        value = data[label]
      }
    }

    if (value !== null && value !== undefined) {
      // 根据元素类型填充值
      if (element.tagName === "SELECT") {
        const selectElement = element as HTMLSelectElement
        // 尝试通过value匹配
        const option = Array.from(selectElement.options).find(
          (opt) => opt.value === String(value)
        )
        if (option) {
          selectElement.value = option.value
        } else {
          // 如果value不匹配，尝试通过文本匹配
          const optionByText = Array.from(selectElement.options).find(
            (opt) => opt.text === String(value)
          )
          if (optionByText) {
            selectElement.value = optionByText.value
          }
        }
        // 触发change事件
        const changeEvent = new Event("change", { bubbles: true })
        selectElement.dispatchEvent(changeEvent)
      } else if (element.tagName === "TEXTAREA") {
        // textarea元素
        const textareaElement = element as HTMLTextAreaElement
        textareaElement.value = String(value)
        // 触发事件
        const inputEvent = new Event("input", { bubbles: true })
        const changeEvent = new Event("change", { bubbles: true })
        textareaElement.dispatchEvent(inputEvent)
        textareaElement.dispatchEvent(changeEvent)
      } else if (element.tagName === "INPUT") {
        const inputElement = element as HTMLInputElement

        // 跳过文件输入框（无法通过脚本设置值）
        if (inputElement.type === "file") {
          return
        }

        if (inputElement.type === "checkbox") {
          inputElement.checked = Boolean(value)
          const changeEvent = new Event("change", { bubbles: true })
          inputElement.dispatchEvent(changeEvent)
        } else if (inputElement.type === "radio") {
          if (inputElement.value === String(value)) {
            inputElement.checked = true
            const changeEvent = new Event("change", { bubbles: true })
            inputElement.dispatchEvent(changeEvent)
          }
        } else {
          // 检查是否是 Ant Design 日期选择器
          const isAntDatePicker =
            inputElement.closest(".ant-picker") ||
            inputElement.closest(".ant-calendar-picker") ||
            inputElement.classList.contains("ant-picker-input") ||
            inputElement.parentElement?.classList.contains("ant-picker-input")

          // 检查是否是 Ant Design Select 组件（不是原生select）
          const isAntSelect =
            inputElement.closest(".ant-select") &&
            !inputElement.closest("select")

          if (isAntDatePicker) {
            // Ant Design 日期选择器处理
            try {
              // 设置input的值
              inputElement.value = String(value)

              // 触发原生事件
              const inputEvent = new Event("input", {
                bubbles: true,
                cancelable: true,
              })
              const changeEvent = new Event("change", {
                bubbles: true,
                cancelable: true,
              })
              inputElement.dispatchEvent(inputEvent)
              inputElement.dispatchEvent(changeEvent)

              // 触发 React 合成事件（Ant Design 使用 React）
              const reactInputEvent = new Event("input", {
                bubbles: true,
                cancelable: true,
              })
              Object.defineProperty(reactInputEvent, "target", {
                value: inputElement,
                enumerable: true,
              })
              inputElement.dispatchEvent(reactInputEvent)

              // 尝试通过 focus/blur 触发 Ant Design 的更新
              inputElement.focus()

              // 延迟触发 blur，确保值已设置
              setTimeout(() => {
                inputElement.blur()
                // 再次触发 change 事件
                const finalChangeEvent = new Event("change", {
                  bubbles: true,
                  cancelable: true,
                })
                inputElement.dispatchEvent(finalChangeEvent)
              }, 50)
            } catch (error) {
              console.warn("填充日期选择器失败:", error)
            }
          } else if (isAntSelect) {
            // Ant Design Select 组件处理（非原生select）
            try {
              const selectContainer = inputElement.closest(".ant-select")
              if (selectContainer) {
                // 先尝试通过点击下拉框来打开选项列表
                const selectSelector = selectContainer.querySelector(
                  ".ant-select-selector"
                ) as HTMLElement
                if (selectSelector) {
                  // 点击打开下拉框
                  selectSelector.click()

                  // 延迟查找并选择选项
                  setTimeout(() => {
                    // 查找所有选项
                    const options = document.querySelectorAll(
                      ".ant-select-item-option"
                    )
                    let found = false

                    for (const option of options) {
                      const optionText = option.textContent?.trim() || ""
                      const optionValue =
                        option.getAttribute("title") || optionText

                      // 尝试匹配值或文本
                      if (
                        optionText === String(value) ||
                        optionValue === String(value) ||
                        optionText.includes(String(value)) ||
                        String(value).includes(optionText)
                      ) {
                        // 点击选项
                        const optionElement = option as HTMLElement
                        optionElement.click()
                        found = true
                        break
                      }
                    }

                    // 如果没找到匹配的选项，关闭下拉框
                    if (!found) {
                      // 点击外部区域关闭下拉框
                      document.body.click()
                    }
                  }, 200)
                } else {
                  // 如果没有选择器，直接设置input的值
                  inputElement.value = String(value)
                  const inputEvent = new Event("input", {
                    bubbles: true,
                    cancelable: true,
                  })
                  const changeEvent = new Event("change", {
                    bubbles: true,
                    cancelable: true,
                  })
                  inputElement.dispatchEvent(inputEvent)
                  inputElement.dispatchEvent(changeEvent)
                }
              }
            } catch (error) {
              console.warn("填充 Ant Design Select 失败:", error)
            }
          } else {
            // 普通input（text, email, number, date等）
            inputElement.value = String(value)
            // 触发input和change事件
            const inputEvent = new Event("input", {
              bubbles: true,
              cancelable: true,
            })
            const changeEvent = new Event("change", {
              bubbles: true,
              cancelable: true,
            })
            inputElement.dispatchEvent(inputEvent)
            inputElement.dispatchEvent(changeEvent)
          }
        }
      }
    }
  })
}

/**
 * 检查页面是否有表单元素
 * 只做简单检查，不涉及弹窗检测（弹窗检测在用户点击按钮时进行）
 * @returns 是否有表单元素
 */
export function hasFormElements(): boolean {
  // 简单检查整个页面是否有表单元素
  // 不进行弹窗检测，因为只有在用户点击按钮时才需要判断弹窗
  const formElements = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'
  )
  return formElements.length > 0
}
