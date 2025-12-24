import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState, useRef } from "react"
import { Storage } from "@plasmohq/storage"

import { getFormFields, fillFormData, hasFormElements } from "./lib/form-utils"
import "./style.css"

/**
 * 内容脚本配置
 * 在所有页面上运行
 */
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
}

/**
 * 自动填充按钮组件
 * 在页面上显示一个浮动按钮，点击后自动填充表单
 */
function AutoFillButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showButton, setShowButton] = useState(false)
  const [position, setPosition] = useState<{
    top: number
    left: number | "auto"
    right: number | "auto"
  }>({
    top: 20,
    left: "auto",
    right: 14,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true) // 插件是否启用
  const storage = new Storage()
  const buttonContainerRef = useRef<HTMLDivElement>(null)

  // 检查插件是否被禁用
  useEffect(() => {
    const checkEnabled = async () => {
      try {
        // 检查全局禁用状态（默认为true，即启用）
        const pluginEnabled = await storage.get<boolean>("pluginEnabled")
        if (pluginEnabled === false) {
          setIsEnabled(false)
          return
        }

        // 检查当前域名是否被禁用
        const currentDomain = window.location.hostname
        const disabledDomains = await storage.get<string[]>("disabledDomains")
        if (disabledDomains && disabledDomains.includes(currentDomain)) {
          setIsEnabled(false)
          return
        }

        // 如果都没有禁用，则启用
        setIsEnabled(true)
      } catch (error) {
        console.error("检查插件启用状态失败:", error)
        // 出错时默认启用
        setIsEnabled(true)
      }
    }

    // 初始检查
    checkEnabled()

    // 监听chrome.storage变化，实时更新启用状态
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      // 只监听local存储区域的变化
      if (areaName === "local") {
        // 如果pluginEnabled或disabledDomains发生变化，重新检查
        if (changes.pluginEnabled || changes.disabledDomains) {
          checkEnabled()
        }
      }
    }

    // 添加存储变化监听器
    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      // 清理监听器
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  // 检查页面是否有表单元素
  useEffect(() => {
    let isFilling = false // 标记是否正在填充表单

    const checkForm = () => {
      // 如果插件被禁用，不显示按钮
      if (!isEnabled) {
        setShowButton(false)
        return
      }

      // 如果正在填充表单，跳过检查，避免重新渲染
      if (isFilling) {
        return
      }
      const hasForm = hasFormElements()
      setShowButton(hasForm)
    }

    // 初始检查
    checkForm()

    // 监听DOM变化，动态显示/隐藏按钮
    // 使用防抖，避免频繁检查
    let checkTimeout: NodeJS.Timeout
    const observer = new MutationObserver(() => {
      clearTimeout(checkTimeout)
      checkTimeout = setTimeout(checkForm, 300) // 300ms防抖
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // 暴露填充状态标记，供填充函数使用
    ;(window as any).__autoFillIsFilling = (filling: boolean) => {
      isFilling = filling
    }

    return () => {
      observer.disconnect()
      clearTimeout(checkTimeout)
      delete (window as any).__autoFillIsFilling
    }
  }, [isEnabled]) // 依赖isEnabled，当启用状态变化时重新检查

  // 加载保存的按钮位置（只在组件首次挂载时加载一次）
  useEffect(() => {
    const loadPosition = async () => {
      try {
        const savedPosition = await storage.get<{
          top: number
          left: number | string
          right: number | string
        }>("buttonPosition")
        if (savedPosition) {
          setPosition({
            top: savedPosition.top,
            left:
              savedPosition.left === "auto"
                ? "auto"
                : typeof savedPosition.left === "number"
                ? savedPosition.left
                : Number(savedPosition.left),
            right:
              savedPosition.right === "auto"
                ? "auto"
                : typeof savedPosition.right === "number"
                ? savedPosition.right
                : Number(savedPosition.right),
          })
        }
      } catch (error) {
        console.error("加载按钮位置失败:", error)
      }
    }
    loadPosition()
    // 移除 storage 依赖，只在组件挂载时加载一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 监听窗口大小变化，自动调整按钮位置
  useEffect(() => {
    // 检查并调整按钮位置，确保按钮始终在可视区域内
    const adjustPositionToViewport = () => {
      // 如果按钮容器还没有渲染，直接返回
      if (!buttonContainerRef.current) return

      const buttonElement = buttonContainerRef.current
      const rect = buttonElement.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const buttonWidth = rect.width
      const buttonHeight = rect.height

      // 获取按钮当前的实际位置
      const currentLeft = rect.left
      const currentTop = rect.top

      // 检查是否需要调整位置
      let newLeft = currentLeft
      let newTop = currentTop
      let needAdjust = false

      // 检查右边界：如果按钮右边缘超出视口
      if (currentLeft + buttonWidth > viewportWidth) {
        newLeft = Math.max(0, viewportWidth - buttonWidth)
        needAdjust = true
      }
      // 检查左边界：如果按钮左边缘超出视口
      if (currentLeft < 0) {
        newLeft = 0
        needAdjust = true
      }
      // 检查下边界：如果按钮下边缘超出视口
      if (currentTop + buttonHeight > viewportHeight) {
        newTop = Math.max(0, viewportHeight - buttonHeight)
        needAdjust = true
      }
      // 检查上边界：如果按钮上边缘超出视口
      if (currentTop < 0) {
        newTop = 0
        needAdjust = true
      }

      // 如果需要调整，更新位置并保存
      if (needAdjust) {
        setPosition({
          top: newTop,
          left: newLeft,
          right: "auto",
        })
        // 保存调整后的位置
        storage
          .set("buttonPosition", {
            top: newTop,
            left: newLeft,
            right: "auto",
          })
          .catch((error) => {
            console.error("保存调整后的按钮位置失败:", error)
          })
      }
    }

    // 窗口大小变化时，检查并调整按钮位置（使用防抖，避免频繁调整）
    let resizeTimer: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        adjustPositionToViewport()
      }, 100) // 100ms 防抖
    }

    // 添加 resize 事件监听器
    window.addEventListener("resize", handleResize)

    // 组件挂载后也检查一次位置（延迟执行，确保按钮已渲染）
    const timer = setTimeout(() => {
      adjustPositionToViewport()
    }, 200)

    return () => {
      window.removeEventListener("resize", handleResize)
      clearTimeout(timer)
      clearTimeout(resizeTimer)
    }
  }, []) // 只在组件挂载时设置一次监听器

  // 处理拖拽开始
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 只在点击按钮容器区域时开始拖拽，点击按钮本身不拖拽
    const target = e.target as HTMLElement
    if (target.tagName === "BUTTON" || target.closest("button")) {
      return
    }

    e.preventDefault()
    setIsDragging(true)

    const buttonElement = e.currentTarget
    const rect = buttonElement.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const startLeft = rect.left
    const startTop = rect.top

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      let newLeft = startLeft + deltaX
      let newTop = startTop + deltaY

      // 限制在可视区域内
      const maxLeft = window.innerWidth - buttonElement.offsetWidth
      const maxTop = window.innerHeight - buttonElement.offsetHeight

      newLeft = Math.max(0, Math.min(newLeft, maxLeft))
      newTop = Math.max(0, Math.min(newTop, maxTop))

      setPosition({ top: newTop, left: newLeft, right: "auto" })
    }

    const handleMouseUp = async () => {
      setIsDragging(false)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)

      // 保存位置
      try {
        const rect = buttonElement.getBoundingClientRect()
        const maxLeft = window.innerWidth - buttonElement.offsetWidth
        const maxTop = window.innerHeight - buttonElement.offsetHeight

        const savedPosition = {
          top: Math.max(0, Math.min(rect.top, maxTop)),
          left: Math.max(0, Math.min(rect.left, maxLeft)),
          right: "auto" as const,
        }

        await storage.set("buttonPosition", savedPosition)
      } catch (error) {
        console.error("保存按钮位置失败:", error)
      }
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  /**
   * 处理自动填充
   */
  const handleAutoFill = async () => {
    try {
      setLoading(true)
      setError(null)

      // 检查是否已配置APIPassword
      const apiPassword = await storage.get<string>("sparkApiPassword")
      if (!apiPassword) {
        setError("请先点击扩展图标，在弹窗中配置APIPassword")
        setLoading(false)
        return
      }

      // 获取表单字段
      const fields = getFormFields()
      if (fields.length === 0) {
        setError("未找到可填充的表单字段")
        setLoading(false)
        return
      }

      console.log("检测到的表单字段:", fields)
      console.log("表单字段数量:", fields.length)

      if (fields.length === 0) {
        setError("未找到可填充的表单字段")
        setLoading(false)
        return
      }

      // 通过background service worker调用API，避免CORS问题
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "generateFormData",
            fields: fields,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error("消息发送失败:", chrome.runtime.lastError)
              reject(new Error(chrome.runtime.lastError.message))
              return
            }
            if (response && response.success) {
              console.log("Background返回的完整响应:", response)
              console.log("生成的表单数据:", response.data)
              if (!response.data || Object.keys(response.data).length === 0) {
                reject(new Error("API返回的数据为空，请检查控制台日志"))
                return
              }
              resolve(response)
            } else {
              console.error("API调用失败:", response)
              reject(new Error(response?.error || "API调用失败"))
            }
          }
        )
      })

      console.log("最终生成的表单数据:", response.data)
      console.log("数据键值对数量:", Object.keys(response.data || {}).length)

      // 标记开始填充，防止DOM变化触发重新渲染
      if ((window as any).__autoFillIsFilling) {
        ;(window as any).__autoFillIsFilling(true)
      }

      // 填充表单
      fillFormData(response.data)

      // 显示成功提示
      setError(null)

      // 延迟恢复状态，确保填充完成
      setTimeout(() => {
        setLoading(false)
        // 标记填充完成
        if ((window as any).__autoFillIsFilling) {
          ;(window as any).__autoFillIsFilling(false)
        }
      }, 500)
    } catch (err: any) {
      console.error("自动填充失败:", err)
      setError(err.message || "自动填充失败，请检查API配置")
      setLoading(false)
      // 标记填充完成（即使失败）
      if ((window as any).__autoFillIsFilling) {
        ;(window as any).__autoFillIsFilling(false)
      }
    }
  }

  // 如果没有表单元素，不显示按钮
  if (!showButton) {
    return null
  }

  return (
    <div
      ref={buttonContainerRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: position.left === "auto" ? "auto" : `${position.left}px`,
        right: position.right === "auto" ? "auto" : `${position.right}px`,
        zIndex: 999999,
        fontFamily: "system-ui, -apple-system, sans-serif",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          boxShadow: isDragging
            ? "0 4px 12px rgba(0,0,0,0.25)"
            : "0 2px 8px rgba(0,0,0,0.15)",
          padding: "12px 16px",
          width: "140px",
          maxWidth: "140px",
          minWidth: "140px",
          boxSizing: "border-box",
          transition: isDragging ? "none" : "box-shadow 0.2s",
        }}
      >
        <button
          onClick={handleAutoFill}
          disabled={loading}
          style={{
            width: "100%",
            padding: "8px 16px",
            backgroundColor: loading ? "#ccc" : "#1890ff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: 500,
            transition: "background-color 0.3s",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = "#40a9ff"
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = "#1890ff"
            }
          }}
        >
          {loading ? "生成中..." : "自动填充"}
        </button>

        {error && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "#fff2f0",
              border: "1px solid #ffccc7",
              borderRadius: "4px",
              color: "#ff4d4f",
              fontSize: "12px",
              lineHeight: "1.5",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

export default AutoFillButton
