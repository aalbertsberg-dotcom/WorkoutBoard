import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

await mkdir('public', { recursive:true })

const source='public/icon.svg'
const outputs=[
  [32,'public/workset-icon-32.png'],
  [180,'public/workset-icon-180.png'],
  [192,'public/workset-icon-192.png'],
  [512,'public/workset-icon-512.png'],
  [512,'public/workset-icon-maskable-512.png'],
]

await Promise.all(outputs.map(([size,path])=>
  sharp(source,{density:256})
    .resize(size,size)
    .png({compressionLevel:9,palette:true,quality:100})
    .toFile(path)
))

console.log('Generated Workset brand icons.')
