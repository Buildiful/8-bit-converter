/* 8-Bit Converter. All image decoding, pixel processing, and export happen locally. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fileInput = $('fileInput');
  const dropZone = $('dropZone');
  const originalImage = $('originalImage');
  const outputImage = $('outputImage');
  const convertBtn = $('convertBtn');
  const downloadBtn = $('downloadBtn');
  const detail = $('detail');
  const paletteSelect = $('palette');
  const dither = $('dither');
  const status = $('status');
  const MAX_FILE_BYTES = 35 * 1024 * 1024;
  const MAX_INPUT_PIXELS = 65_000_000;
  const MAX_OUTPUT_EDGE = 4096;
  const palettes = {
    classic: ['#000000','#0000aa','#00aa00','#00aaaa','#aa0000','#aa00aa','#aa5500','#aaaaaa','#555555','#5555ff','#55ff55','#55ffff','#ff5555','#ff55ff','#ffff55','#ffffff'],
    sunset: ['#274d73','#5585b8','#8bd0ea','#fce4a3','#f9acb2','#e07f9f','#d7b6e7','#9abfd5','#c5e6cc','#69b88a','#4c876f','#fff7e6'],
    gameboy: ['#0f380f','#306230','#8bac0f','#9bbc0f']
  };
  const rgbPalettes = Object.fromEntries(Object.entries(palettes).map(([key, colors]) => [key, colors.map(hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)))]));
  let file = null;
  let bitmap = null;
  let inputUrl = null;
  let outputUrl = null;
  let outputBlob = null;
  let busy = false;
  let revision = 0;

  const announce = (message, error = false) => { status.textContent = message; status.classList.toggle('error',error); };
  function cleanupBitmap() { if (bitmap && typeof bitmap.close === 'function') bitmap.close(); bitmap = null; }
  function clearOutput() {
    outputBlob = null;
    downloadBtn.disabled = true;
    outputImage.hidden = true;
    outputImage.removeAttribute('src');
    $('outputEmpty').hidden = false;
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = null;
  }
  function resetFile() {
    revision += 1;
    file = null;
    cleanupBitmap();
    clearOutput();
    convertBtn.disabled = true;
    originalImage.hidden = true;
    originalImage.removeAttribute('src');
    $('originalEmpty').hidden = false;
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    inputUrl = null;
    $('fileName').textContent = '';
  }
  async function decodeImage(blob) {
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(blob, {imageOrientation:'from-image'}); }
      catch (_err) { try { return await createImageBitmap(blob); } catch (_another) {} }
    }
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { URL.revokeObjectURL(url); }
  }
  async function selectFile(chosen) {
    const allowed = /^(image\/png|image\/jpeg|image\/webp)$/i.test(chosen?.type || '');
    if (!chosen || !allowed) { announce('Please use a PNG, JPG, or WebP image.',true); return; }
    if (chosen.size > MAX_FILE_BYTES) { announce('This file is too large (35 MB max).',true); return; }
    resetFile();
    const currentRevision = revision;
    announce('Opening image…');
    try {
      const decoded = await decodeImage(chosen);
      if (currentRevision !== revision) { decoded.close?.(); return; }
      const width = decoded.naturalWidth || decoded.width;
      const height = decoded.naturalHeight || decoded.height;
      if (!width || !height || width * height > MAX_INPUT_PIXELS) {
        decoded.close?.();
        throw new Error('Image dimensions are too large (65 megapixels max).');
      }
      bitmap = decoded;
      file = chosen;
      inputUrl = URL.createObjectURL(chosen);
      originalImage.src = inputUrl;
      originalImage.hidden = false;
      $('originalEmpty').hidden = true;
      $('fileName').textContent = `${chosen.name} · ${width} × ${height}`;
      convertBtn.disabled = false;
      announce('Ready to convert.');
    } catch (error) {
      if (currentRevision === revision) {
        resetFile();
        announce(error.message || 'Unable to read this image.',true);
      }
    }
  }
  fileInput.addEventListener('change', () => { if (fileInput.files?.[0]) void selectFile(fileInput.files[0]); fileInput.value = ''; });
  ['dragenter','dragover'].forEach(eventName => dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(eventName => dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', event => { const dropped = Array.from(event.dataTransfer?.files || [])[0]; if (dropped) void selectFile(dropped); });
  detail.addEventListener('input', () => { $('detailValue').textContent = detail.value + ' px'; });
  [detail,paletteSelect,dither].forEach(control => control.addEventListener('change', () => {
    if (outputBlob) { clearOutput(); announce('Settings changed. Convert again.'); }
  }));

  // RGB 3:3:2 quantization = exactly 256 possible colors, a standard 8-bit palette.
  function quantizeRGB(color) {
    return [Math.round(color[0] * 7 / 255) * (255 / 7), Math.round(color[1] * 7 / 255) * (255 / 7), Math.round(color[2] * 3 / 255) * (255 / 3)];
  }
  function nearest(color, palette) {
    let best = palette[0], dist = Infinity;
    for (const candidate of palette) {
      const r = color[0]-candidate[0], g = color[1]-candidate[1], b = color[2]-candidate[2];
      const d = r*r*.299 + g*g*.587 + b*b*.114;
      if (d < dist) { dist = d; best = candidate; }
    }
    return best;
  }
  function paletteMap(imageData, width, height, paletteName, doDither) {
    const data = imageData.data;
    const colors = paletteName === 'arcade' ? null : rgbPalettes[paletteName];
    if (!doDither) {
      for (let i=0;i<data.length;i+=4) {
        if (data[i+3] === 0) continue;
        const found = colors ? nearest([data[i],data[i+1],data[i+2]],colors) : quantizeRGB([data[i],data[i+1],data[i+2]]);
        data[i]=Math.round(found[0]); data[i+1]=Math.round(found[1]); data[i+2]=Math.round(found[2]);
      }
      return;
    }
    // Keep ordered retro color changes legible on photographs: full-strength
    // diffusion produces excessive speckling with four- and twelve-color palettes.
    const ditherStrength = paletteName === 'gameboy' ? 0.40 : paletteName === 'arcade' ? 0.68 : 0.52;
    const work = new Float32Array(width*height*3);
    for (let p=0;p<width*height;p++) { const i=p*4,k=p*3; work[k]=data[i];work[k+1]=data[i+1];work[k+2]=data[i+2]; }
    const spread = (x,y,err,factor) => {
      if (x < 0 || x >= width || y < 0 || y >= height || data[(y*width+x)*4+3] === 0) return;
      const i=(y*width+x)*3;
      for(let c=0;c<3;c++) work[i+c]+=err[c]*factor*ditherStrength;
    };
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const p=y*width+x,i=p*4,k=p*3;
      if(data[i+3]===0)continue;
      const old=[work[k],work[k+1],work[k+2]].map(v=>Math.max(0,Math.min(255,v)));
      const found=colors ? nearest(old,colors) : quantizeRGB(old);
      for(let c=0;c<3;c++) data[i+c]=Math.round(found[c]);
      const err=old.map((v,c)=>v-found[c]);
      spread(x+1,y,err,7/16);spread(x-1,y+1,err,3/16);spread(x,y+1,err,5/16);spread(x+1,y+1,err,1/16);
    }
  }

  function canvasOf(w,h) {
    const canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    return canvas;
  }
  function pngBlob(canvas) {
    return new Promise((resolve,reject)=>canvas.toBlob(b=>b ? resolve(b) : reject(new Error('Could not export PNG.')), 'image/png'));
  }
  async function convert() {
    if(!bitmap || !file || busy) return;
    busy=true;
    convertBtn.disabled=true;
    downloadBtn.disabled=true;
    announce('Converting pixels…');
    // Yield one frame so the busy state is visibly communicated before CPU work.
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    try {
      const originalWidth=bitmap.naturalWidth||bitmap.width;
      const originalHeight=bitmap.naturalHeight||bitmap.height;
      const scale=Math.min(1,MAX_OUTPUT_EDGE/Math.max(originalWidth,originalHeight));
      const finalWidth=Math.max(1,Math.round(originalWidth*scale));
      const finalHeight=Math.max(1,Math.round(originalHeight*scale));
      const lowScale=Math.min(1,Number(detail.value)/Math.max(finalWidth,finalHeight));
      const sampleW=Math.max(1,Math.round(finalWidth*lowScale));
      const sampleH=Math.max(1,Math.round(finalHeight*lowScale));
      const small=canvasOf(sampleW,sampleH);
      const ctx=small.getContext('2d',{willReadFrequently:true});
      if(!ctx) throw new Error('Your browser could not create a canvas.');
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.clearRect(0,0,sampleW,sampleH);
      ctx.drawImage(bitmap,0,0,sampleW,sampleH);
      const frame=ctx.getImageData(0,0,sampleW,sampleH);
      paletteMap(frame,sampleW,sampleH,paletteSelect.value,dither.checked);
      ctx.putImageData(frame,0,0);
      const full=canvasOf(finalWidth,finalHeight);
      const out=full.getContext('2d');
      if(!out) throw new Error('Your browser could not create an export canvas.');
      out.imageSmoothingEnabled=false;
      out.drawImage(small,0,0,sampleW,sampleH,0,0,finalWidth,finalHeight);
      const blob=await pngBlob(full);
      clearOutput();
      outputBlob=blob;
      outputUrl=URL.createObjectURL(blob);
      outputImage.src=outputUrl;
      outputImage.hidden=false;
      $('outputEmpty').hidden=true;
      downloadBtn.disabled=false;
      announce(`Done! ${finalWidth} × ${finalHeight} PNG ready.`);
      window.BuildifulAnalytics?.track('image_convert');
    } catch(error) {
      clearOutput();
      announce(error.message || 'Could not convert the image.',true);
    } finally { busy=false;convertBtn.disabled=!bitmap; }
  }
  convertBtn.addEventListener('click',()=>void convert());
  downloadBtn.addEventListener('click',()=>{
    if(!outputBlob || !outputUrl || !file)return;
    const base=file.name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9_\-. ]/gi,'_').slice(0,100)||'image';
    const anchor=document.createElement('a');
    anchor.href=outputUrl;
    anchor.download=base+'-8bit.png';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    announce('PNG download started.');
    window.BuildifulAnalytics?.track('image_download');
  });
  window.addEventListener('pagehide',()=>{
    cleanupBitmap();
    if(inputUrl)URL.revokeObjectURL(inputUrl);
    if(outputUrl)URL.revokeObjectURL(outputUrl);
  });
})();
