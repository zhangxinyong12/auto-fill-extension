/**
 * 图标生成脚本
 * 从 icon.svg 生成不同尺寸的 PNG 图标文件
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// 需要生成的图标尺寸
// 包含谷歌商店要求的128x128和512x512尺寸
const sizes = [16, 32, 48, 64, 128, 512]

// 输出目录
const outputDir = path.join(__dirname, '.plasmo', 'gen-assets')

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// 输入文件路径
const inputFile = path.join(__dirname, 'icon.svg')

// 检查输入文件是否存在
if (!fs.existsSync(inputFile)) {
  console.error('错误: 找不到 icon.svg 文件')
  process.exit(1)
}

// 生成所有尺寸的图标
async function generateIcons() {
  console.log('开始生成图标文件...')
  
  for (const size of sizes) {
    const outputFile = path.join(outputDir, `icon${size}.plasmo.png`)
    
    try {
      await sharp(inputFile)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3 // 使用高质量缩放算法
        })
        .png({
          quality: 100, // 最高质量
          compressionLevel: 9
        })
        .toFile(outputFile)
      
      console.log(`✓ 已生成: ${outputFile} (${size}x${size})`)
    } catch (error) {
      console.error(`✗ 生成失败 (${size}x${size}):`, error.message)
    }
  }
  
  // 额外生成谷歌商店专用的512x512图标到assets目录
  const storeIconPath = path.join(__dirname, 'assets', 'icon-512.png')
  try {
    await sharp(inputFile)
      .resize(512, 512, {
        kernel: sharp.kernel.lanczos3
      })
      .png({
        quality: 100,
        compressionLevel: 9
      })
      .toFile(storeIconPath)
    
    console.log(`✓ 已生成谷歌商店图标: ${storeIconPath} (512x512)`)
  } catch (error) {
    console.error(`✗ 生成谷歌商店图标失败:`, error.message)
  }
  
  // 生成128x128图标到assets目录（插件必需）
  const pluginIconPath = path.join(__dirname, 'assets', 'icon-128.png')
  try {
    await sharp(inputFile)
      .resize(128, 128, {
        kernel: sharp.kernel.lanczos3
      })
      .png({
        quality: 100,
        compressionLevel: 9
      })
      .toFile(pluginIconPath)
    
    console.log(`✓ 已生成插件图标: ${pluginIconPath} (128x128)`)
  } catch (error) {
    console.error(`✗ 生成插件图标失败:`, error.message)
  }
  
  console.log('\n图标生成完成!')
  console.log('📦 谷歌商店发布说明:')
  console.log('   - 使用 assets/icon-512.png (512x512) 作为商店展示图标')
  console.log('   - 使用 assets/icon-128.png (128x128) 作为插件图标')
}

generateIcons().catch(console.error)

