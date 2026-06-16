const Jimp = require('jimp')
const pngToIco = require('png-to-ico')
const fs = require('fs')
const path = require('path')

const src     = path.join(__dirname, 'assets', 'logo.jpeg')
const pngOut  = path.join(__dirname, 'assets', 'icon-circle.png')
const icoOut  = path.join(__dirname, 'assets', 'icon.ico')

async function run() {
  const size   = 256
  const radius = size / 2
  const cx     = radius
  const cy     = radius

  const img = await Jimp.read(src)

  // Recorta ao centro para preencher um quadrado perfeito
  img.cover(size, size)

  // Aplica máscara circular — pixels fora do círculo ficam transparentes
  img.scan(0, 0, size, size, function (x, y, idx) {
    const dx = x - cx
    const dy = y - cy
    if (dx * dx + dy * dy > radius * radius) {
      this.bitmap.data[idx + 3] = 0
    }
  })

  await img.writeAsync(pngOut)
  console.log('icon-circle.png criado.')

  const buf = await pngToIco(pngOut)
  fs.writeFileSync(icoOut, buf)
  console.log('icon.ico gerado com máscara circular!')
}

run().catch(console.error)
