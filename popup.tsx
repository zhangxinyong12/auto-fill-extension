import { useEffect, useState } from 'react'
import { Storage } from '@plasmohq/storage'

import './style.css'

/**
 * Popup 弹窗组件
 * 用于配置科大讯飞API认证信息（APIPassword）
 * 参考 article-api 项目的配置方式
 * 模型固定使用 lite 版本
 */
function IndexPopup() {
  // 状态管理：API密钥（APIPassword）、保存状态
  const [apiPassword, setApiPassword] = useState('')
  const [saved, setSaved] = useState(false)
  // 插件启用状态
  const [pluginEnabled, setPluginEnabled] = useState(true)
  // 当前网站域名
  const [currentDomain, setCurrentDomain] = useState<string>('')
  // 当前网站是否被禁用
  const [currentDomainDisabled, setCurrentDomainDisabled] = useState(false)
  
  // 创建存储实例，用于读取和保存配置
  const storage = new Storage()

  /**
   * 组件挂载时加载已保存的配置
   * 从浏览器本地存储中读取之前保存的APIPassword和启用状态
   */
  useEffect(() => {
    const loadConfig = async () => {
      // 从存储中获取APIPassword
      const savedPassword = await storage.get<string>('sparkApiPassword')
      
      // 如果存在已保存的配置，则填充到表单中
      if (savedPassword) {
        setApiPassword(savedPassword)
      }

      // 加载插件启用状态（默认为true，即启用）
      const enabled = await storage.get<boolean>('pluginEnabled')
      setPluginEnabled(enabled !== false) // 如果为undefined，默认为true

      // 获取当前标签页的域名
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tabs[0] && tabs[0].url) {
          const url = new URL(tabs[0].url)
          const domain = url.hostname
          setCurrentDomain(domain)

          // 检查当前域名是否被禁用
          const disabledDomains = await storage.get<string[]>('disabledDomains')
          if (disabledDomains && disabledDomains.includes(domain)) {
            setCurrentDomainDisabled(true)
          } else {
            setCurrentDomainDisabled(false)
          }
        }
      } catch (error) {
        console.error('获取当前域名失败:', error)
      }
    }
    loadConfig()
  }, [])

  /**
   * 保存配置到浏览器本地存储
   * 将用户输入的APIPassword保存到 Storage API
   * 模型固定使用 'lite'，不需要用户选择
   */
  const handleSave = async () => {
    try {
      // 保存APIPassword到存储
      await storage.set('sparkApiPassword', apiPassword)
      // 固定保存模型版本为 'lite'
      await storage.set('sparkModel', 'lite')
      
      // 显示保存成功提示
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
      }, 2000)
    } catch (error) {
      console.error('保存配置失败:', error)
      alert('保存配置失败，请重试')
    }
  }

  /**
   * 打开示例图片
   * 打开options页面显示示例图片，帮助用户了解如何获取APIPassword
   */
  const handleViewExample = () => {
    // 打开options页面，图片会在options页面中显示
    chrome.runtime.openOptionsPage()
  }

  /**
   * 切换全局插件启用/禁用状态
   */
  const handleTogglePlugin = async () => {
    try {
      const newState = !pluginEnabled
      await storage.set('pluginEnabled', newState)
      setPluginEnabled(newState)
    } catch (error) {
      console.error('切换插件启用状态失败:', error)
      alert('操作失败，请重试')
    }
  }

  /**
   * 切换当前网站的启用/禁用状态
   */
  const handleToggleCurrentDomain = async () => {
    try {
      if (!currentDomain) {
        alert('无法获取当前网站域名')
        return
      }

      const disabledDomains = await storage.get<string[]>('disabledDomains') || []
      const isCurrentlyDisabled = disabledDomains.includes(currentDomain)

      let newDisabledDomains: string[]
      if (isCurrentlyDisabled) {
        // 如果当前已禁用，则从列表中移除（启用）
        newDisabledDomains = disabledDomains.filter(d => d !== currentDomain)
        setCurrentDomainDisabled(false)
      } else {
        // 如果当前未禁用，则添加到列表中（禁用）
        newDisabledDomains = [...disabledDomains, currentDomain]
        setCurrentDomainDisabled(true)
      }

      await storage.set('disabledDomains', newDisabledDomains)
    } catch (error) {
      console.error('切换网站启用状态失败:', error)
      alert('操作失败，请重试')
    }
  }

  return (
    <div
      style={{
        width: '400px',
        minHeight: '500px',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#fff',
      }}
    >
      {/* 标题区域 */}
      <h1
        style={{
          fontSize: '20px',
          fontWeight: 600,
          marginBottom: '8px',
          color: '#262626',
        }}
      >
        表单自动填充助手
      </h1>
      <p
        style={{
          fontSize: '12px',
          color: '#8c8c8c',
          marginBottom: '24px',
        }}
      >
        配置科大讯飞API认证信息，用于生成表单模拟数据（使用 lite 模型）
      </p>

      {/* API认证信息输入框 */}
      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '8px',
            color: '#262626',
          }}
        >
          APIPassword（认证信息）
          <span style={{ color: '#ff4d4f', marginLeft: '4px' }}>*</span>
        </label>
        <input
          type="password"
          value={apiPassword}
          onChange={(e) => setApiPassword(e.target.value)}
          placeholder="请输入APIPassword"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        />
        <p
          style={{
            fontSize: '11px',
            color: '#8c8c8c',
            marginTop: '4px',
          }}
        >
          从科大讯飞控制台获取APIPassword，直接填入即可（不需要Bearer前缀）
        </p>
      </div>

      {/* 模型信息显示 */}
      <div
        style={{
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: '#f6ffed',
          borderRadius: '4px',
          border: '1px solid #b7eb8f',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            color: '#595959',
            lineHeight: '1.6',
          }}
        >
          <strong style={{ color: '#262626' }}>模型版本：</strong>
          <span style={{ color: '#52c41a', fontWeight: 500 }}>lite</span>
          <br />
          <span style={{ fontSize: '11px', color: '#8c8c8c' }}>
            已固定使用 lite 模型，性价比最高
          </span>
        </div>
      </div>

      {/* 操作按钮区域 */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={!apiPassword}
          style={{
            flex: 1,
            padding: '10px 16px',
            backgroundColor: apiPassword ? '#1890ff' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: apiPassword ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.3s',
          }}
          onMouseEnter={(e) => {
            if (apiPassword) {
              e.currentTarget.style.backgroundColor = '#40a9ff'
            }
          }}
          onMouseLeave={(e) => {
            if (apiPassword) {
              e.currentTarget.style.backgroundColor = '#1890ff'
            }
          }}
        >
          {saved ? '保存成功！' : '保存配置'}
        </button>

        {/* 查看示例图片按钮 */}
        <button
          onClick={handleViewExample}
          style={{
            padding: '10px 16px',
            backgroundColor: '#52c41a',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.3s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#73d13d'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#52c41a'
          }}
          title="查看如何获取APIPassword的示例图片"
        >
          📷 查看示例
        </button>
      </div>

      {/* 插件启用/禁用控制区域 */}
      <div
        style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#fafafa',
          borderRadius: '4px',
          border: '1px solid #d9d9d9',
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            color: '#262626',
          }}
        >
          插件控制
        </h3>

        {/* 全局启用/禁用开关 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            padding: '8px 0',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#262626',
                marginBottom: '4px',
              }}
            >
              全局启用/禁用
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#8c8c8c',
              }}
            >
              控制整个插件是否启用
            </div>
          </div>
          <label
            style={{
              position: 'relative',
              display: 'inline-block',
              width: '44px',
              height: '22px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={pluginEnabled}
              onChange={handleTogglePlugin}
              style={{
                opacity: 0,
                width: 0,
                height: 0,
              }}
            />
            <span
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: pluginEnabled ? '#1890ff' : '#ccc',
                borderRadius: '22px',
                transition: 'background-color 0.3s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: pluginEnabled ? '22px' : '2px',
                  bottom: '2px',
                  backgroundColor: '#fff',
                  borderRadius: '50%',
                  transition: 'left 0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              />
            </span>
          </label>
        </div>

        {/* 当前网站启用/禁用开关 */}
        {currentDomain && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderTop: '1px solid #e8e8e8',
              paddingTop: '12px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#262626',
                  marginBottom: '4px',
                }}
              >
                当前网站：{currentDomain}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: currentDomainDisabled ? '#ff4d4f' : '#52c41a',
                }}
              >
                {currentDomainDisabled ? '已禁用' : '已启用'}
              </div>
            </div>
            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '44px',
                height: '22px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={!currentDomainDisabled}
                onChange={handleToggleCurrentDomain}
                disabled={!pluginEnabled}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: !currentDomainDisabled ? '#1890ff' : '#ccc',
                  borderRadius: '22px',
                  transition: 'background-color 0.3s',
                  opacity: pluginEnabled ? 1 : 0.5,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: !currentDomainDisabled ? '22px' : '2px',
                    bottom: '2px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    transition: 'left 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </span>
            </label>
          </div>
        )}
      </div>

      {/* 配置说明 */}
      <div
        style={{
          padding: '12px',
          backgroundColor: '#f0f5ff',
          borderRadius: '4px',
          border: '1px solid #adc6ff',
          fontSize: '12px',
          lineHeight: '1.6',
        }}
      >
        <h3
          style={{
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '8px',
            color: '#262626',
          }}
        >
          如何获取APIPassword
        </h3>
        <div
          style={{
            backgroundColor: '#fff',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '10px',
            border: '1px solid #d9d9d9',
          }}
        >
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: '11px',
              color: '#595959',
              fontWeight: 500,
            }}
          >
            📍 <strong>关键位置：</strong>
          </p>
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: '11px',
              color: '#595959',
              paddingLeft: '20px',
            }}
          >
            在控制台页面右侧找到 <strong>"HTTP服务接口认证信息"</strong> 部分
          </p>
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: '11px',
              color: '#595959',
              paddingLeft: '20px',
            }}
          >
            在 <strong>"鉴权信息"</strong> 子部分中，找到 <strong>"APIPassword"</strong> 字段
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              color: '#ff4d4f',
              paddingLeft: '20px',
              fontWeight: 500,
            }}
          >
            ⚠️ 点击APIPassword值旁边的"复制"按钮，然后粘贴到上方输入框
          </p>
        </div>
        <ol
          style={{
            paddingLeft: '18px',
            margin: '0 0 8px 0',
            color: '#595959',
            fontSize: '11px',
            lineHeight: '1.8',
          }}
        >
          <li>
            访问{' '}
            <a
              href="https://console.xfyun.cn/services/cbm"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1890ff' }}
            >
              科大讯飞控制台
            </a>
          </li>
          <li>注册/登录账号，完成实名认证（如需要）</li>
          <li>在左侧菜单选择 <strong>"星火认知大模型"</strong> → <strong>"Spark Lite"</strong></li>
          <li>在页面右侧找到 <strong>"HTTP服务接口认证信息"</strong> 部分</li>
          <li>
            在 <strong>"鉴权信息"</strong> 子部分中，找到 <strong>"APIPassword"</strong> 字段
          </li>
          <li>
            <strong>点击APIPassword值旁边的"复制"按钮</strong>（不要手动复制，使用复制按钮）
          </li>
          <li>将复制的APIPassword粘贴到上方输入框（不需要Bearer前缀）</li>
          <li>点击"保存配置"按钮完成配置</li>
        </ol>
        <div
          style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: '#fff7e6',
            borderRadius: '4px',
            border: '1px solid #ffe58f',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              color: '#595959',
              lineHeight: '1.6',
            }}
          >
            <strong style={{ color: '#fa8c16' }}>💡 重要提示：</strong>
            <br />
            • APIPassword值通常以"NtU"开头，部分字符会被隐藏显示（如：NtU****kDw）
            <br />
            • 直接复制完整的APIPassword值即可，不需要添加"Bearer"前缀
            <br />
            • 所有配置仅保存在浏览器本地，不会上传到任何服务器
            <br />
            • 接口地址：https://spark-api-open.xf-yun.com/v1/chat/completions
          </p>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup

