import { useEffect, useState } from 'react'
import { Storage } from '@plasmohq/storage'

import './style.css'

// 导入示例图片 - 使用Plasmo的资源导入方式
import exampleImage from '~/assets/示例图片.png'

/**
 * 选项页面组件
 * 用于配置科大讯飞API密钥
 */
function IndexOptions() {
  const [apiPassword, setApiPassword] = useState('')
  const [model, setModel] = useState('lite')
  const [saved, setSaved] = useState(false)
  const [allowedDomains, setAllowedDomains] = useState<string[]>([])
  const [newDomain, setNewDomain] = useState('')
  const storage = new Storage()

  // 加载已保存的配置
  useEffect(() => {
    const loadConfig = async () => {
      const savedPassword = await storage.get<string>('sparkApiPassword')
      const savedModel = await storage.get<string>('sparkModel')
      const savedAllowedDomains = await storage.get<string[]>('allowedDomains')
      if (savedPassword) {
        setApiPassword(savedPassword)
      }
      if (savedModel) {
        setModel(savedModel)
      }
      if (savedAllowedDomains) {
        setAllowedDomains(savedAllowedDomains)
      }
    }
    loadConfig()
  }, [])

  /**
   * 保存配置
   */
  const handleSave = async () => {
    try {
      await storage.set('sparkApiPassword', apiPassword)
      await storage.set('sparkModel', model)
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
   * 添加域名到白名单
   */
  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      alert('请输入域名')
      return
    }

    // 验证域名格式（简单验证）
    const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^localhost$|^127\.0\.0\.1$/
    if (!domainPattern.test(newDomain.trim())) {
      alert('请输入有效的域名（例如：example.com）')
      return
    }

    // 默认允许的域名不需要添加
    const defaultAllowedDomains = ["localhost", "127.0.0.1"]
    if (defaultAllowedDomains.some(d => newDomain.trim() === d || newDomain.trim().startsWith(d + ":"))) {
      alert('localhost 和 127.0.0.1 是默认允许的域名，无需手动添加')
      setNewDomain('')
      return
    }

    // 检查是否已存在
    if (allowedDomains.includes(newDomain.trim())) {
      alert('该域名已在白名单中')
      setNewDomain('')
      return
    }

    try {
      const newAllowedDomains = [...allowedDomains, newDomain.trim()]
      await storage.set('allowedDomains', newAllowedDomains)
      setAllowedDomains(newAllowedDomains)
      setNewDomain('')
    } catch (error) {
      console.error('添加域名失败:', error)
      alert('添加域名失败，请重试')
    }
  }

  /**
   * 从白名单移除域名
   */
  const handleRemoveDomain = async (domain: string) => {
    // 默认允许的域名不能移除
    const defaultAllowedDomains = ["localhost", "127.0.0.1"]
    if (defaultAllowedDomains.some(d => domain === d || domain.startsWith(d + ":"))) {
      alert('localhost 和 127.0.0.1 是默认允许的域名，不能移除')
      return
    }

    try {
      const newAllowedDomains = allowedDomains.filter(d => d !== domain)
      await storage.set('allowedDomains', newAllowedDomains)
      setAllowedDomains(newAllowedDomains)
    } catch (error) {
      console.error('移除域名失败:', error)
      alert('移除域名失败，请重试')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '40px 20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '8px',
            color: '#262626',
          }}
        >
          表单自动填充助手 - 配置
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: '#8c8c8c',
            marginBottom: '32px',
          }}
        >
          配置科大讯飞API密钥，用于生成表单模拟数据。所有配置仅保存在浏览器本地，不会上传到任何服务器。
        </p>

        {/* 示例图片显示区域 */}
        <div
          style={{
            marginBottom: '32px',
            padding: '16px',
            backgroundColor: '#f0f5ff',
            borderRadius: '8px',
            border: '1px solid #adc6ff',
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '12px',
              color: '#262626',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            📷 示例图片：如何获取APIPassword
          </h3>
          <p
            style={{
              fontSize: '13px',
              color: '#595959',
              marginBottom: '12px',
            }}
          >
            下图展示了在科大讯飞控制台中如何找到并复制APIPassword：
          </p>
          <div
            style={{
              textAlign: 'center',
              padding: '12px',
              backgroundColor: '#fff',
              borderRadius: '4px',
              border: '1px solid #d9d9d9',
            }}
          >
            <img
              src={exampleImage}
              alt="APIPassword获取示例"
              style={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
              onError={(e) => {
                console.error('图片加载失败:', e)
                const img = e.target as HTMLImageElement
                // 尝试使用chrome.runtime.getURL作为备用方案
                const fallbackSrc = chrome.runtime.getURL('assets/示例图片.png')
                if (img.src !== fallbackSrc) {
                  img.src = fallbackSrc
                } else {
                  img.style.display = 'none'
                  const parent = img.parentElement
                  if (parent) {
                    parent.innerHTML = '<p style="color: #ff4d4f; text-align: center; padding: 20px;">图片加载失败，请检查文件是否存在</p>'
                  }
                }
              }}
            />
          </div>
          <p
            style={{
              fontSize: '12px',
              color: '#8c8c8c',
              marginTop: '12px',
              marginBottom: 0,
              textAlign: 'center',
            }}
          >
            在控制台页面右侧找到"HTTP服务接口认证信息" → "鉴权信息" → "APIPassword"，点击复制按钮
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '8px',
              color: '#262626',
            }}
          >
            API密钥 (APIPassword)
            <span style={{ color: '#ff4d4f', marginLeft: '4px' }}>*</span>
          </label>
          <input
            type="password"
            value={apiPassword}
            onChange={(e) => setApiPassword(e.target.value)}
            placeholder="请输入科大讯飞API密钥"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <p
            style={{
              fontSize: '12px',
              color: '#8c8c8c',
              marginTop: '4px',
            }}
          >
            从科大讯飞控制台获取APIPassword，直接填入即可（不需要Bearer前缀）
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '8px',
              color: '#262626',
            }}
          >
            模型版本
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
              backgroundColor: '#fff',
            }}
          >
            <option value="lite">lite (推荐)</option>
            <option value="pro">pro</option>
            <option value="pro-128k">pro-128k</option>
            <option value="max">max</option>
            <option value="max-32k">max-32k</option>
            <option value="4.0-ultra">4.0-ultra</option>
          </select>
          <p
            style={{
              fontSize: '12px',
              color: '#8c8c8c',
              marginTop: '4px',
            }}
          >
            选择使用的模型版本，lite版本性价比最高
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={!apiPassword}
          style={{
            width: '100%',
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

        {/* 域名白名单管理区域 */}
        <div
          style={{
            marginTop: '32px',
            padding: '20px',
            backgroundColor: '#f0f5ff',
            borderRadius: '8px',
            border: '1px solid #adc6ff',
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '12px',
              color: '#262626',
            }}
          >
            🌐 域名白名单管理
          </h3>
          <p
            style={{
              fontSize: '13px',
              color: '#595959',
              marginBottom: '16px',
              lineHeight: '1.6',
            }}
          >
            插件默认只在 <strong>localhost</strong> 和 <strong>127.0.0.1</strong> 上运行。
            <br />
            其他网站需要添加到白名单后才能使用插件功能。
          </p>

          {/* 默认允许的域名 */}
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#fff',
              borderRadius: '4px',
              border: '1px solid #d9d9d9',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#262626',
                marginBottom: '8px',
              }}
            >
              默认允许的域名（无需添加）：
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#52c41a',
                  fontWeight: 500,
                }}
              >
                localhost
              </span>
              <span
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#52c41a',
                  fontWeight: 500,
                }}
              >
                127.0.0.1
              </span>
            </div>
          </div>

          {/* 添加域名输入框 */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
                color: '#262626',
              }}
            >
              添加新域名到白名单
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddDomain()
                  }
                }}
                placeholder="例如：example.com"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={handleAddDomain}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#52c41a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
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
              >
                添加
              </button>
            </div>
            <p
              style={{
                fontSize: '11px',
                color: '#8c8c8c',
                marginTop: '4px',
              }}
            >
              输入域名后按 Enter 或点击"添加"按钮
            </p>
          </div>

          {/* 白名单域名列表 */}
          <div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#262626',
                marginBottom: '8px',
              }}
            >
              已添加到白名单的域名（{allowedDomains.length} 个）：
            </div>
            {allowedDomains.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #d9d9d9',
                  textAlign: 'center',
                  color: '#8c8c8c',
                  fontSize: '12px',
                }}
              >
                暂无已添加的域名
              </div>
            ) : (
              <div
                style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #d9d9d9',
                  padding: '8px',
                }}
              >
                {allowedDomains.map((domain) => (
                  <div
                    key={domain}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      marginBottom: '4px',
                      backgroundColor: '#fafafa',
                      borderRadius: '4px',
                      border: '1px solid #e8e8e8',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        color: '#262626',
                        flex: 1,
                      }}
                    >
                      {domain}
                    </span>
                    <button
                      onClick={() => handleRemoveDomain(domain)}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#ff4d4f',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'background-color 0.3s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#ff7875'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ff4d4f'
                      }}
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: '32px',
            padding: '16px',
            backgroundColor: '#f0f5ff',
            borderRadius: '4px',
            border: '1px solid #adc6ff',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#262626',
            }}
          >
            科大讯飞API配置说明
          </h3>
          <div
            style={{
              fontSize: '13px',
              color: '#595959',
              lineHeight: '1.8',
            }}
          >
            <p style={{ marginBottom: '12px' }}>
              <strong>第一步：注册账号</strong>
            </p>
            <ol
              style={{
                paddingLeft: '20px',
                marginBottom: '16px',
                marginTop: 0,
              }}
            >
              <li>访问 <a href="https://www.xfyun.cn/" target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>科大讯飞开放平台</a></li>
              <li>注册/登录账号</li>
              <li>完成实名认证（如需要）</li>
            </ol>

            <p style={{ marginBottom: '12px' }}>
              <strong>第二步：创建应用</strong>
            </p>
            <ol
              style={{
                paddingLeft: '20px',
                marginBottom: '16px',
                marginTop: 0,
              }}
            >
              <li>进入控制台，创建新应用</li>
              <li>选择"Spark API"服务</li>
              <li>开通相应版本的API服务（推荐开通lite版本）</li>
            </ol>

            <p style={{ marginBottom: '12px' }}>
              <strong>第三步：获取API密钥</strong>
            </p>
            <ol
              style={{
                paddingLeft: '20px',
                marginBottom: '16px',
                marginTop: 0,
              }}
            >
              <li>在应用详情页面，找到"HTTP服务接口认证信息"</li>
              <li>复制"APIPassword"的值</li>
              <li>将APIPassword粘贴到上方输入框（不需要Bearer前缀）</li>
            </ol>

            <p style={{ marginBottom: '12px' }}>
              <strong>第四步：配置插件</strong>
            </p>
            <ol
              style={{
                paddingLeft: '20px',
                marginBottom: 0,
                marginTop: 0,
              }}
            >
              <li>选择模型版本（推荐使用lite，性价比最高）</li>
              <li>点击"保存配置"按钮</li>
              <li>配置会自动保存到浏览器本地存储</li>
            </ol>
          </div>
        </div>

        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#f6ffed',
            borderRadius: '4px',
            border: '1px solid #b7eb8f',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#262626',
            }}
          >
            使用说明
          </h3>
          <ol
            style={{
              fontSize: '13px',
              color: '#595959',
              lineHeight: '1.8',
              paddingLeft: '20px',
              margin: 0,
            }}
          >
            <li>配置完成后，刷新任意包含表单的网页</li>
            <li>页面右上角会自动显示"自动填充"按钮</li>
            <li>点击按钮，插件会自动识别表单字段</li>
            <li>调用科大讯飞API生成符合场景的模拟数据</li>
            <li>自动填充到对应的表单字段中</li>
          </ol>
        </div>

        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#fff7e6',
            borderRadius: '4px',
            border: '1px solid #ffe58f',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#262626',
            }}
          >
            重要提示
          </h3>
          <ul
            style={{
              fontSize: '13px',
              color: '#595959',
              lineHeight: '1.8',
              paddingLeft: '20px',
              margin: 0,
            }}
          >
            <li>
              <strong style={{ color: '#fa8c16' }}>数据安全：</strong>
              API密钥和所有配置信息仅保存在浏览器本地存储中，不会上传到任何服务器，不会发送到后台，完全本地化处理
            </li>
            <li>
              <strong style={{ color: '#fa8c16' }}>隐私保护：</strong>
              请妥善保管您的API密钥，不要泄露给他人。如果更换浏览器或清除数据，需要重新配置
            </li>
            <li>
              <strong style={{ color: '#fa8c16' }}>费用说明：</strong>
              使用科大讯飞API会产生费用，请根据您的使用量选择合适的套餐。lite版本性价比最高，适合日常测试使用
            </li>
            <li>
              <strong style={{ color: '#fa8c16' }}>使用建议：</strong>
              插件会自动识别页面上的表单字段，根据字段的label、placeholder等信息生成合适的模拟数据。确保表单字段有清晰的标识可以获得更好的生成效果
            </li>
          </ul>
        </div>

        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#fff1f0',
            borderRadius: '4px',
            border: '1px solid #ffccc7',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#262626',
            }}
          >
            常见问题
          </h3>
          <div
            style={{
              fontSize: '13px',
              color: '#595959',
              lineHeight: '1.8',
            }}
          >
            <p style={{ marginBottom: '8px' }}>
              <strong>Q: 配置会保存到哪里？</strong>
            </p>
            <p style={{ marginBottom: '12px', paddingLeft: '16px' }}>
              A: 所有配置仅保存在浏览器本地存储（Chrome Extension Storage API），不会上传到任何服务器，不会发送到后台。即使插件开发者也无法访问您的配置信息。
            </p>

            <p style={{ marginBottom: '8px' }}>
              <strong>Q: 如何查看或修改配置？</strong>
            </p>
            <p style={{ marginBottom: '12px', paddingLeft: '16px' }}>
              A: 随时可以右键点击扩展图标，选择"选项"来查看或修改配置。修改后点击"保存配置"即可生效。
            </p>

            <p style={{ marginBottom: '8px' }}>
              <strong>Q: 更换浏览器后需要重新配置吗？</strong>
            </p>
            <p style={{ marginBottom: '12px', paddingLeft: '16px' }}>
              A: 是的，因为配置保存在浏览器本地，更换浏览器或清除浏览器数据后需要重新配置。
            </p>

            <p style={{ marginBottom: '8px' }}>
              <strong>Q: API密钥格式是什么？</strong>
            </p>
            <p style={{ marginBottom: 0, paddingLeft: '16px' }}>
              A: 直接复制科大讯飞控制台中的APIPassword值即可，不需要添加"Bearer"前缀，插件会自动处理。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexOptions

