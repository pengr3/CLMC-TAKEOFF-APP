import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, copyFile, rm, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { pdfDecoderOptions } from '@renderer/lib/pdf-decoder-options'

const require = createRequire(import.meta.url)
const scratch: string[] = []
afterEach(async () => {
  await Promise.all(
    scratch.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('offline PDF decoder resources', () => {
  it('resolves a trailing-slash decoder base beside the renderer in file and dev URLs', () => {
    expect(pdfDecoderOptions('file:///C:/CLMC/resources/app.asar/out/renderer/index.html')).toEqual(
      {
        wasmUrl: 'file:///C:/CLMC/resources/app.asar/out/renderer/pdfjs/wasm/'
      }
    )
    expect(pdfDecoderOptions('http://localhost:5173/')).toEqual({
      wasmUrl: 'http://localhost:5173/pdfjs/wasm/'
    })
  })

  it('decodes actual JPX colored pixels with staged local assets; missing options paints blank', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'clmc-pdf-codecs-'))
    scratch.push(directory)
    const supplied = resolve('node_modules/pdfjs-dist/wasm')
    const staged = join(directory, 'pdfjs/wasm')
    await mkdir(staged, { recursive: true })
    for (const name of ['openjpeg.wasm', 'openjpeg_nowasm_fallback.js'])
      await copyFile(join(supplied, name), join(staged, name))
    const options = pdfDecoderOptions(pathToFileURL(join(directory, 'index.html')).href)
    // PDF.js's Node factory expects an OS path; the renderer uses the same URL via XHR.
    const localPath = fileURLToPath(options.wasmUrl).replaceAll('\\', '/')
    const program = `
      const fs=require('node:fs');
      const canvas=require('@napi-rs/canvas');
      Object.assign(globalThis,{DOMMatrix:canvas.DOMMatrix,ImageData:canvas.ImageData,Path2D:canvas.Path2D});
      if(!Map.prototype.getOrInsertComputed)Object.defineProperty(Map.prototype,'getOrInsertComputed',{
        value:function(key,create){if(this.has(key))return this.get(key);const value=create(key);this.set(key,value);return value;}
      });
      const messages=[];console.warn=(...args)=>messages.push(args.join(' '));console.log=(...args)=>messages.push(args.join(' '));
      (async()=>{
        const pdfjs=await import(${JSON.stringify(pathToFileURL(require.resolve('pdfjs-dist/build/pdf.mjs')).href)});
        const options=JSON.parse(process.argv[1]);
        const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(${JSON.stringify(resolve('src/tests/fixtures/jpeg2000-checker.pdf'))})),...options}).promise;
        const page=await doc.getPage(1), viewport=page.getViewport({scale:4});
        const target=canvas.createCanvas(viewport.width,viewport.height), context=target.getContext('2d');
        await page.render({canvas:target,canvasContext:context,viewport}).promise;
        const pixels=context.getImageData(0,0,target.width,target.height).data;
        let red=0,blue=0,nonWhite=0;
        for(let i=0;i<pixels.length;i+=4){
          if(pixels[i]>150&&pixels[i+1]<70&&pixels[i+2]<70)red++;
          if(pixels[i+2]>150&&pixels[i]<70&&pixels[i+1]<90)blue++;
          if(Math.min(pixels[i],pixels[i+1],pixels[i+2])<245)nonWhite++;
        }
        await doc.destroy();process.stdout.write(JSON.stringify({red,blue,nonWhite,messages}));
      })().catch(error=>{process.stderr.write(String(error));process.exitCode=1});
    `
    const render = (parameters: {
      wasmUrl?: string
    }): {
      red: number
      blue: number
      nonWhite: number
      messages: string[]
    } => {
      const result = spawnSync(process.execPath, ['-e', program, JSON.stringify(parameters)], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15_000
      })
      expect(result.status, result.stderr + result.stdout).toBe(0)
      return JSON.parse(result.stdout)
    }
    const missing = render({})
    expect(missing.nonWhite).toBe(0)
    expect(missing.messages.join('\n')).toContain('wasmUrl')
    const decoded = render({ wasmUrl: localPath })
    expect(decoded.red).toBeGreaterThan(3000)
    expect(decoded.blue).toBeGreaterThan(3000)
    expect(decoded.nonWhite).toBeGreaterThan(15000)
    expect(decoded.messages.join('\n')).not.toMatch(/OpenJPEG failed|JpxImage#|Ensure.*wasmUrl/)
  }, 20_000)

  it('permits WASM compilation without enabling general string evaluation', async () => {
    const html = await readFile(resolve('src/renderer/index.html'), 'utf8')
    expect(html).toContain("script-src 'self' 'wasm-unsafe-eval'")
    expect(html).not.toContain("'unsafe-eval'")
  })
})
