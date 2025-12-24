/**
 * 图标生成脚本
 * 从 icon.svg 生成不同尺寸的 PNG 图标文件
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// 需要生成的图标尺寸
const sizes = [16, 32, 48, 64, 128]

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
        .resize(size, size)
        .png()
        .toFile(outputFile)
      
      console.log(`✓ 已生成: ${outputFile}`)
    } catch (error) {
      console.error(`✗ 生成失败 (${size}x${size}):`, error.message)
    }
  }
  
  console.log('图标生成完成!')
}

generateIcons().catch(console.error)

