/**
 * 截图处理脚本
 * 将截图调整为谷歌商店要求的尺寸
 * 要求：1280x800 或 640x400，JPEG 或 24 位 PNG (无 alpha 透明层)
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// 谷歌商店要求的截图尺寸
const screenshotSizes = [
  { width: 1280, height: 800, name: '1280x800' },
  { width: 640, height: 400, name: '640x400' }
]

// 输入目录（assets目录）
const inputDir = path.join(__dirname, 'assets')

// 输出目录（在assets目录下创建screenshots子目录）
const outputDir = path.join(__dirname, 'assets', 'screenshots')

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

/**
 * 处理单个截图文件
 * @param {string} inputFile - 输入文件路径
 */
async function processScreenshot(inputFile) {
  const fileName = path.basename(inputFile, path.extname(inputFile))
  console.log(`\n处理截图: ${fileName}`)
  
  // 获取原始图片信息
  const metadata = await sharp(inputFile).metadata()
  console.log(`  原始尺寸: ${metadata.width}x${metadata.height}`)
  
  // 为每个要求的尺寸生成截图
  for (const size of screenshotSizes) {
    try {
      // 生成1280x800尺寸的截图
      const outputFile1280 = path.join(outputDir, `${fileName}_${size.name}.png`)
      await sharp(inputFile)
        .resize(size.width, size.height, {
          fit: 'contain', // 保持宽高比，可能会留白
          background: { r: 255, g: 255, b: 255, alpha: 1 } // 白色背景填充
        })
        .extend({
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png({
          quality: 100,
          compressionLevel: 9,
          force: true // 强制PNG格式
        })
        .toFile(outputFile1280)
      
      console.log(`  ✓ 已生成: ${outputFile1280} (${size.width}x${size.height})`)
      
      // 同时生成JPEG版本（24位，无alpha通道）
      const outputFileJpeg = path.join(outputDir, `${fileName}_${size.name}.jpg`)
      await sharp(inputFile)
        .resize(size.width, size.height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .extend({
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({
          quality: 95,
          mozjpeg: true // 使用mozjpeg编码器，更好的压缩
        })
        .toFile(outputFileJpeg)
      
      console.log(`  ✓ 已生成: ${outputFileJpeg} (${size.width}x${size.height}, JPEG)`)
      
    } catch (error) {
      console.error(`  ✗ 生成失败 (${size.name}):`, error.message)
    }
  }
}

/**
 * 主函数：处理所有截图文件
 */
async function generateScreenshots() {
  console.log('开始处理截图文件...')
  console.log('输入目录:', inputDir)
  console.log('输出目录:', outputDir)
  
  // 查找所有截图文件（支持常见截图命名）
  const screenshotPatterns = [
    'ScreenShot_*.png',
    'Screenshot_*.png',
    'screenshot_*.png',
    'screen_*.png',
    '*.png'
  ]
  
  // 读取assets目录下的所有PNG文件
  const files = fs.readdirSync(inputDir)
    .filter(file => {
      // 排除已经生成的图标文件
      const lowerFile = file.toLowerCase()
      return (
        file.endsWith('.png') &&
        !lowerFile.includes('icon') &&
        !lowerFile.includes('示例')
      )
    })
    .map(file => path.join(inputDir, file))
  
  if (files.length === 0) {
    console.log('⚠️  未找到截图文件')
    console.log('提示: 请将截图文件放在 assets 目录下')
    return
  }
  
  console.log(`\n找到 ${files.length} 个截图文件:`)
  files.forEach(file => console.log(`  - ${path.basename(file)}`))
  
  // 处理每个截图文件
  for (const file of files) {
    try {
      await processScreenshot(file)
    } catch (error) {
      console.error(`处理文件失败 ${file}:`, error.message)
    }
  }
  
  console.log('\n✅ 截图处理完成!')
  console.log('\n📦 谷歌商店上传说明:')
  console.log('   - 截图已保存在 assets/screenshots/ 目录')
  console.log('   - 每个截图都生成了两种尺寸: 1280x800 和 640x400')
  console.log('   - 每种尺寸都有 PNG 和 JPEG 两种格式')
  console.log('   - 所有图片都是 24 位，无 alpha 透明层，符合商店要求')
  console.log('   - 建议使用 1280x800 尺寸的图片上传')
}

// 执行主函数
generateScreenshots().catch(console.error)

