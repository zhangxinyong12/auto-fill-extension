# 修复 Chrome Web Store 拒绝问题

## 已修复的问题

### ✅ 1. 移除未使用的 activeTab 权限

已从 `package.json` 的 manifest 配置中移除了 `activeTab` 权限，因为代码中并未使用该权限。

**修改内容：**
- 从 `permissions` 数组中移除了 `"activeTab"`
- 保留了 `"storage"` 和 `"tabs"` 权限（这些是实际使用的）

**下一步：**
1. 重新构建扩展：运行 `pnpm build` 或 `npm run build`
2. 打包扩展：运行 `pnpm package` 或 `npm run package`
3. 在 Chrome Web Store 开发者中心上传新版本

---

## 待处理的问题

### ⚠️ 2. 添加隐私政策链接

**问题：** Chrome Web Store 要求在"隐私权"标签页中提供公开可访问的隐私政策链接。

**解决方案：**

#### 方案 A：使用 GitHub Pages（推荐）

1. **将隐私政策文件推送到 GitHub 仓库**
   ```bash
   git add PRIVACY_POLICY.md
   git commit -m "Add privacy policy"
   git push
   ```

2. **启用 GitHub Pages**
   - 进入 GitHub 仓库设置
   - 找到 "Pages" 设置
   - 选择主分支（main/master）作为源
   - 保存后，GitHub 会提供一个 URL，例如：`https://yourusername.github.io/repo-name/PRIVACY_POLICY.html`

3. **将 Markdown 转换为 HTML**（如果需要）
   - 可以使用在线工具将 Markdown 转换为 HTML
   - 或者使用 GitHub 的原始文件链接：`https://raw.githubusercontent.com/yourusername/repo-name/main/PRIVACY_POLICY.md`
   - 但更好的方式是使用 GitHub Pages 渲染的 HTML 版本

#### 方案 B：使用 GitHub Gist

1. **创建 Gist**
   - 访问 https://gist.github.com
   - 将 `PRIVACY_POLICY.md` 的内容粘贴进去
   - 创建 Gist（可以是公开的或私有的，但链接需要公开可访问）
   - 获取 Gist 的 URL，例如：`https://gist.github.com/yourusername/gist-id`

2. **使用 Gist 的原始文件链接**
   - 格式：`https://gist.githubusercontent.com/yourusername/gist-id/raw/PRIVACY_POLICY.md`

#### 方案 C：使用其他托管服务

- **Netlify Drop**：拖拽 HTML 文件即可获得链接
- **Vercel**：部署静态网站
- **其他静态网站托管服务**

---

## 在 Chrome Web Store 中添加隐私政策链接

1. **登录 Chrome Web Store 开发者中心**
   - 访问：https://chrome.google.com/webstore/devconsole

2. **进入扩展的"隐私权"标签页**
   - 选择你的扩展
   - 点击左侧菜单中的"隐私权"（Privacy）

3. **填写隐私权规范**
   - 在"隐私权政策链接"字段中，输入你托管的隐私政策 URL
   - 确保链接是公开可访问的（不需要登录即可查看）

4. **填写其他必填字段**
   - 参考 `CHROME_WEB_STORE_PRIVACY.md` 文件中的内容
   - 填写"单一用途说明"
   - 填写"使用远程代码的理由"
   - 填写"使用主机权限的理由"
   - 填写"使用 storage 权限的理由"
   - 填写"数据使用情况确认"

5. **保存并重新提交**
   - 保存所有更改
   - 返回"版本"页面
   - 点击"提请审核"

---

## 验证清单

在重新提交之前，请确认：

- [x] ✅ 已从 manifest 中移除 `activeTab` 权限
- [ ] ⚠️ 已创建公开可访问的隐私政策链接
- [ ] ⚠️ 已在 Chrome Web Store 开发者中心的"隐私权"标签页中添加隐私政策链接
- [ ] ⚠️ 已填写所有隐私权规范字段
- [ ] ⚠️ 已重新构建和打包扩展
- [ ] ⚠️ 已上传新版本到 Chrome Web Store
- [ ] ⚠️ 已重新提交审核

---

## 注意事项

1. **隐私政策链接必须是公开可访问的**
   - 不需要登录即可查看
   - 必须是 HTTPS 链接（如果可能）
   - 链接必须稳定，不会频繁变更

2. **隐私政策内容必须准确**
   - 确保隐私政策内容与实际扩展行为一致
   - 如果扩展功能发生变化，需要同步更新隐私政策

3. **重新构建扩展**
   - 修改 `package.json` 后，必须重新构建扩展
   - 使用 `pnpm build` 或 `npm run build` 构建
   - 使用 `pnpm package` 或 `npm run package` 打包

---

## 需要帮助？

如果遇到问题，可以：
1. 查看 Chrome Web Store 开发者文档
2. 参考 `CHROME_WEB_STORE_PRIVACY.md` 文件中的详细说明
3. 检查 Chrome Web Store 开发者中心的帮助文档

