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
  
  // 创建存储实例，用于读取和保存配置
  const storage = new Storage()

  /**
   * 组件挂载时加载已保存的配置
   * 从浏览器本地存储中读取之前保存的APIPassword
   */
  useEffect(() => {
    const loadConfig = async () => {
      // 从存储中获取APIPassword
      const savedPassword = await storage.get<string>('sparkApiPassword')
      
      // 如果存在已保存的配置，则填充到表单中
      if (savedPassword) {
        setApiPassword(savedPassword)
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

