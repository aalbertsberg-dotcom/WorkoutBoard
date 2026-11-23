// Native branding for WorkSet Option B. Never changes the PWA logo.
import sharp from 'sharp'
import path from 'node:path'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
const platform=process.argv[2]
if(!['android','ios'].includes(platform))throw Error('Expected android or ios')
const root=process.cwd()
const mark=await readFile(path.join(root,'assets/native/workset-option-b-mark.svg'))
const write=async(p,data)=>{await mkdir(path.dirname(p),{recursive:true});await writeFile(p,data)}
const render=(input,n)=>sharp(input,{density:256}).resize(n,n).png().toBuffer()
const bg=Buffer.from([
'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">',
'<defs><radialGradient id="b"><stop stop-color="#17243b"/><stop offset="1" stop-color="#07101f"/></radialGradient></defs>',
'<rect width="1024" height="1024" fill="url(#b)"/>',
'<rect x="25" y="25" width="974" height="974" rx="218" fill="none" stroke="#a8f329" stroke-width="10"/></svg>'
].join(''))
const icon=await sharp(bg).composite([{input:await render(mark,944),left:40,top:40}]).png().toBuffer()
const clearCanvas=(n)=>sharp({create:{width:n,height:n,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
const foreground=await clearCanvas(432).composite([{input:await render(mark,348),left:42,top:42}]).png().toBuffer()
const splashIcon=await clearCanvas(512).composite([{input:await render(mark,348),left:82,top:82}]).png().toBuffer()
const splashBackground=Buffer.from([
'<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732">',
'<defs><radialGradient id="b"><stop stop-color="#16243a"/><stop offset="1" stop-color="#07101f"/></radialGradient>',
'<linearGradient id="w"><stop stop-color="#478500"/><stop offset="1" stop-color="#b1f428"/></linearGradient></defs>',
'<rect width="2732" height="2732" fill="url(#b)"/>',
'<path d="M0 2690 Q1430 2500 2732 2330 L2732 2480 Q1270 2640 0 2732 Z" fill="url(#w)"/>',
'<text x="1366" y="1810" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="206" font-weight="900" font-style="italic" fill="#f5f8ff">',
'Work<tspan fill="#b2f32b">Set</tspan></text></svg>'
].join(''))
const splash=await sharp(splashBackground).composite([{input:await render(mark,850),left:941,top:690}]).png().toBuffer()
if(platform==='android'){
 const res=path.join(root,'android/app/src/main/res')
 for(const [density,size] of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})){
  const raster=await sharp(icon).resize(size,size).png().toBuffer()
  await write(path.join(res,'mipmap-'+density,'ic_launcher.png'),raster)
  await write(path.join(res,'mipmap-'+density,'ic_launcher_round.png'),raster)
 }
 await write(path.join(res,'drawable-nodpi','workset_launcher_foreground.png'),foreground)
 await write(path.join(res,'drawable-nodpi','workset_splash_logo.png'),splashIcon)
 await write(path.join(res,'values','workset_brand_colors.xml'),
  '<resources><color name="workset_icon_background">#07101f</color></resources>\n')
 const launcher='<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">'+
  '<background android:drawable="@color/workset_icon_background"/>'+
  '<foreground android:drawable="@drawable/workset_launcher_foreground"/></adaptive-icon>'
 for(const name of ['ic_launcher.xml','ic_launcher_round.xml'])
  await write(path.join(res,'mipmap-anydpi-v26',name),launcher)
 const sf=path.join(res,'values','styles.xml')
 let styles=await readFile(sf,'utf8')
 const match=styles.match(/<style\s+name="AppTheme.NoActionBarLaunch"[^>]*>[\s\S]*?<\/style>/)
 if(!match)throw Error('Capacitor Android launch style missing')
 let content=match[0]
 for(const [key,val] of Object.entries({
  windowSplashScreenBackground:'@color/workset_icon_background',
  windowSplashScreenAnimatedIcon:'@drawable/workset_splash_logo'
 })){
  const needle=new RegExp('<item\\s+name="'+key+'">[^<]*<\\/item>')
  const node='<item name="'+key+'">'+val+'</item>'
  content=needle.test(content)?content.replace(needle,node):content.replace('</style>',' '+node+'</style>')
 }
 await write(sf,styles.replace(match[0],content))
 const info=await sharp(path.join(res,'mipmap-xxxhdpi','ic_launcher.png')).metadata()
 if(info.width!==192||info.height!==192)throw Error('Android launcher image validation failed')
 console.log('Applied Option B: Android launcher, adaptive icon, and OS splash')
}else{
 const assets=path.join(root,'ios/App/App/Assets.xcassets')
 const app=path.join(assets,'AppIcon.appiconset')
 const images=JSON.parse(await readFile(path.join(app,'Contents.json'),'utf8')).images||[]
 let count=0
 for(const item of images){
  if(!item.filename)continue
  const size=Math.round(Number(String(item.size||'1024x1024').split('x')[0])*Number(String(item.scale||'1x').replace('x','')))
  if(!Number.isFinite(size)||size<16||size>2048)throw Error('Invalid iOS icon size')
  await write(path.join(app,item.filename),await sharp(icon).resize(size,size).png().toBuffer())
  count++
 }
 if(!count)throw Error('iOS icon manifest has no filenames')
 const splashDir=path.join(assets,'Splash.imageset')
 const splashImages=JSON.parse(await readFile(path.join(splashDir,'Contents.json'),'utf8')).images||[]
 let splashes=0
 for(const item of splashImages)if(item.filename){
  await write(path.join(splashDir,item.filename),splash)
  splashes++
 }
 if(!splashes)throw Error('iOS splash manifest has no filenames')
 console.log('Applied Option B: '+count+' iOS app icons, '+splashes+' splash images')
}
