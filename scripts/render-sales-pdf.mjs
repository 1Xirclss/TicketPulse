import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const input = process.argv[2] || 'test-results/ventas-filtradas.pdf';
const output = process.argv[3] || 'test-results/pdf-review';
fs.mkdirSync(output,{recursive:true});
const task = getDocument({ data: new Uint8Array(fs.readFileSync(input)), useSystemFonts: false, standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts').replaceAll('\\', '/') + '/' });
const pdf = await task.promise;
let extracted = '';
for(let index=1;index<=pdf.numPages;index++){
  const page=await pdf.getPage(index);const viewport=page.getViewport({scale:1.5});
  const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
  await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;
  fs.writeFileSync(path.join(output,'pagina-'+index+'.png'),canvas.toBuffer('image/png'));
  extracted += (await page.getTextContent()).items.map(item=>item.str).join(' ')+'\n';
}
fs.writeFileSync(path.join(output,'texto.txt'),extracted);
console.info('PDF revisable:',pdf.numPages,'página(s).');
await task.destroy();
