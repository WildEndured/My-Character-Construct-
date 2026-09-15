/* exporter.js — PNG / PSD / JSON / ZIP */
(function(global) {
  'use strict';

  const CANVAS_SIZE = 4096;
  const DPI = 300;
  const PPM = Math.round(DPI / 0.0254); // пикселей на метр

  // ============================================================
  //  CRC32 (для PNG)
  // ============================================================
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ============================================================
  //  PNG с pHYs (300 DPI)
  // ============================================================
  async function canvasToPngWithDpi(sourceCanvas, dpi = DPI) {
    // Получаем PNG-blob из canvas
    const blob = await new Promise(res => sourceCanvas.toBlob(res, 'image/png'));
    const buf = new Uint8Array(await blob.arrayBuffer());

    const ppm = Math.round(dpi / 0.0254);

    // Парсим PNG: signature(8) + IHDR chunk
    // IHDR: length(4) + type(4) + data(13) + crc(4) = 25 байт
    const ihdrEnd = 8 + 25;

    // Собираем pHYs chunk
    const physData = new Uint8Array(9);
    const dv = new DataView(physData.buffer);
    dv.setUint32(0, ppm, false);
    dv.setUint32(4, ppm, false);
    physData[8] = 1; // unit = meter

    const physType = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // "pHYs"
    const physLen = new Uint8Array([0, 0, 0, 9]);

    const crcInput = new Uint8Array(4 + 9);
    crcInput.set(physType, 0);
    crcInput.set(physData, 4);
    const crc = crc32(crcInput);
    const crcBytes = new Uint8Array(4);
    new DataView(crcBytes.buffer).setUint32(0, crc, false);

    // Собираем новый PNG
    const out = new Uint8Array(buf.length + 4 + 4 + 9 + 4);
    let off = 0;
    out.set(buf.slice(0, 8), off); off += 8;             // signature
    out.set(buf.slice(8, ihdrEnd), off); off += (ihdrEnd - 8); // IHDR
    out.set(physLen, off); off += 4;
    out.set(physType, off); off += 4;
    out.set(physData, off); off += 9;
    out.set(crcBytes, off); off += 4;
    out.set(buf.slice(ihdrEnd), off);                    // остальные чанки

    return new Blob([out], { type: 'image/png' });
  }

  // ============================================================
  //  Ресайз canvas под нужный размер
  // ============================================================
  function resizeCanvas(source, size) {
    if (size === source.width) return source;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(source, 0, 0, size, size);
    return c;
  }

  // ============================================================
  //  PSD (многослойный)
  // ============================================================
  /**
   * Генерирует PSD-файл из слоёв.
   * Формат: 8BPS, RGB, 8bit, RLE-сжатие, слои + composite preview.
   *
   * @param {Array<{name, canvas}>} layers — снизу вверх (первый = фон)
   * @param {number} width
   * @param {number} height
   * @returns {Blob}
   */
  async function buildPSD(layers, width, height) {
    const writer = new ByteWriter();

    // --- Header ---
    writer.writeString('8BPS');          // signature
    writer.writeUint16(1);               // version
    writer.writeBytes(new Uint8Array(6));// reserved
    writer.writeUint16(3);               // channels = RGB
    writer.writeUint32(height);
    writer.writeUint32(width);
    writer.writeUint16(8);               // depth
    writer.writeUint16(3);               // color mode = RGB

    // --- Color Mode Data ---
    writer.writeUint32(0);

    // --- Image Resources ---
    // Добавляем pHYs-аналог (resolution) в Image Resource Block (ID 1005)
    const resBlock = buildResolutionResource(DPI);
    writer.writeUint32(resBlock.length);
    writer.writeBytes(resBlock);

    // --- Layer and Mask Info ---
    const layerInfo = await buildLayerInfo(layers, width, height);
    writer.writeUint32(layerInfo.length);
    writer.writeBytes(layerInfo);

    // --- Image Data (composite preview, RLE) ---
    const composite = buildCompositeImageData(layers, width, height);
    writer.writeBytes(composite);

    return new Blob([writer.getBytes()], { type: 'image/vnd.adobe.photoshop' });
  }

  // PSD: Image Resource Block для разрешения
  function buildResolutionResource(dpi) {
    const w = new ByteWriter();
    w.writeString('8BIM');   // signature
    w.writeUint16(1005);     // resource ID: resolution info
    w.writeUint8(0);         // Pascal string name (пустое)
    w.writeUint8(0);         // padding до чётного

    const ppm = dpi / 0.0254; // пикселей на метр
    // ResolutionInfo: hRes (Fixed 16.16), hResUnit (1=inches), widthUnit, vRes, vResUnit, heightUnit
    const data = new ByteWriter();
    data.writeInt32(Math.round(ppm * 65536)); // hRes, Fixed 16.16 в пикс/дюйм? Нет — PSD требует пикс/дюйм
    // На самом деле PSD resolution — в пикселях на дюйм (Fixed 16.16)
    // Перезапишем корректно:
    const dataCorrect = new ByteWriter();
    dataCorrect.writeInt32(Math.round(dpi * 65536)); // hRes
    dataCorrect.writeUint16(1);                      // hResUnit = inches
    dataCorrect.writeUint16(1);                      // widthUnit = inches
    dataCorrect.writeInt32(Math.round(dpi * 65536)); // vRes
    dataCorrect.writeUint16(1);                      // vResUnit = inches
    dataCorrect.writeUint16(1);                      // heightUnit = inches

    const dataBytes = dataCorrect.getBytes();
    w.writeUint32(dataBytes.length);
    w.writeBytes(dataBytes);
    if (dataBytes.length % 2 === 1) w.writeUint8(0); // padding

    return w.getBytes();
  }

  async function buildLayerInfo(layers, width, height) {
    const w = new ByteWriter();

    // Layer info sub-block
    const layerInfoW = new ByteWriter();
    layerInfoW.writeInt16(layers.length); // layer count (можно отрицательное = первый alpha)

    // --- Layer records ---
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      await writeLayerRecord(layerInfoW, layer, i, layers.length, width, height);
    }

    // --- Channel image data для каждого слоя ---
    for (const layer of layers) {
      await writeChannelData(layerInfoW, layer, width, height);
    }

    // Layer info padding (до 4 байт)
    while (layerInfoW.length % 4 !== 0) layerInfoW.writeUint8(0);

    const layerInfoBytes = layerInfoW.getBytes();

    // Глобальная маска — 0
    const maskW = new ByteWriter();
    maskW.writeUint32(0);
    const maskBytes = maskW.getBytes();

    // Собираем: layerInfoLen(4) + layerInfo + maskLen(4) + mask + padding
    w.writeUint32(layerInfoBytes.length);
    w.writeBytes(layerInfoBytes);
    w.writeUint32(maskBytes.length);
    w.writeBytes(maskBytes);

    // Добить до чётного
    if (w.length % 2 === 1) w.writeUint8(0);

    return w.getBytes();
  }

  async function writeLayerRecord(w, layer, index, total, width, height) {
    // Layer rect: top, left, bottom, right
    w.writeInt32(0);        // top
    w.writeInt32(0);        // left
    w.writeInt32(height);   // bottom
    w.writeInt32(width);    // right

    // Channel count = 4 (RGBA)
    w.writeUint16(4);

    // Channel info (channel ID + data length)
    // Мы пока не знаем длину — запишем placeholder
    const channelInfoPos = w.length;
    for (let c = 0; c < 4; c++) {
      w.writeInt16(c === 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : -1); // 0=R,1=G,2=B,-1=A
      w.writeUint32(0); // placeholder для длины
    }

    // Blend mode signature '8BIM' + 'norm'
    w.writeString('8BIM');
    w.writeString('norm');

    // Opacity (0-255)
    w.writeUint8(255);

    // Clipping (0=base, 1=non-base)
    w.writeUint8(0);

    // Flags (bit 1 = visible)
    w.writeUint8(0);

    // Filler
    w.writeUint8(0);

    // Extra data length placeholder
    const extraLenPos = w.length;
    w.writeUint32(0);

    const extraStart = w.length;

    // Layer mask data — 0
    w.writeUint32(0);

    // Blending ranges — 0
    w.writeUint32(0);

    // Pascal string: layer name (с padding до 4 байт)
    const nameBytes = new TextEncoder().encode(layer.name || `Layer ${index + 1}`);
    w.writeUint8(Math.min(nameBytes.length, 255));
    w.writeBytes(nameBytes.slice(0, 255));
    while ((w.length - extraStart) % 4 !== 0) w.writeUint8(0);

    // Записываем реальную длину extra data
    const extraLen = w.length - extraStart;
    const finalBytes = w.getBytes();
    const dv = new DataView(finalBytes.buffer);
    dv.setUint32(extraLenPos, extraLen, false);
    w.bytes = finalBytes;

    // Сохраняем позицию channel info для последующего заполнения
    layer._channelInfoPos = channelInfoPos;
    layer._writerRef = w;
  }

  async function writeChannelData(w, layer, width, height) {
    // Извлекаем пиксели из canvas
    const canvas = layer.canvas;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, width, height).data;

    // Разделяем на каналы R, G, B, A
    const channels = [
      new Uint8Array(width * height),
      new Uint8Array(width * height),
      new Uint8Array(width * height),
      new Uint8Array(width * height),
    ];

    for (let i = 0, p = 0; i < imgData.length; i += 4, p++) {
      channels[0][p] = imgData[i];
      channels[1][p] = imgData[i + 1];
      channels[2][p] = imgData[i + 2];
      channels[3][p] = imgData[i + 3];
    }

    // Записываем каждый канал с RLE-сжатием
    const channelPositions = [];
    for (let c = 0; c < 4; c++) {
      const startPos = w.length;
      const rle = psdRleEncode(channels[c], width, height);
      w.writeUint16(0); // compression = RLE
      w.writeBytes(rle);
      const endPos = w.length;
      channelPositions.push({ start: startPos, length: endPos - startPos - 2 }); // без 2 байт compression
    }

    // Обновляем channel info в layer record
    const bytes = w.getBytes();
    const dv = new DataView(bytes.buffer);
    // Каждый channel info: 2 байта id + 4 байта length = 6 байт
    const basePos = layer._channelInfoPos;
    for (let c = 0; c < 4; c++) {
      dv.setUint32(basePos + c * 6 + 2, channelPositions[c].length, false);
    }
    w.bytes = bytes;
  }

  /**
   * PSD RLE (PackBits) для одного канала.
   * Формат: [rowLengths...] + [packed data...]
   */
  function psdRleEncode(channel, width, height) {
    const out = new ByteWriter();

    // Резервируем место под таблицу длин строк (по 2 байта на строку)
    const lengthsPos = out.length;
    for (let y = 0; y < height; y++) out.writeUint16(0);

    const rowLengths = [];
    for (let y = 0; y < height; y++) {
      const row = channel.subarray(y * width, (y + 1) * width);
      const packed = packBits(row);
      rowLengths.push(packed.length);
      out.writeBytes(packed);
    }

    // Записываем длины
    const bytes = out.getBytes();
    const dv = new DataView(bytes.buffer);
    for (let y = 0; y < height; y++) {
      dv.setUint16(lengthsPos + y * 2, rowLengths[y], false);
    }

    return bytes;
  }

  /**
   * PackBits-компрессия (RLE).
   */
  function packBits(data) {
    const out = [];
    const len = data.length;
    let i = 0;

    while (i < len) {
      // Ищем серию одинаковых байт
      let runEnd = i + 1;
      while (runEnd < len && runEnd - i < 128 && data[runEnd] === data[i]) runEnd++;

      const runLen = runEnd - i;

      if (runLen >= 2) {
        // Серия: (257 - runLen) as signed byte, then byte value
        out.push((257 - runLen) & 0xFF);
        out.push(data[i]);
        i = runEnd;
      } else {
        // Литеральная серия до следующего повтора
        let litEnd = i + 1;
        while (litEnd < len && litEnd - i < 128) {
          if (litEnd + 1 < len && data[litEnd] === data[litEnd + 1]) break;
          litEnd++;
        }
        const litLen = litEnd - i;
        out.push((litLen - 1) & 0xFF);
        for (let k = i; k < litEnd; k++) out.push(data[k]);
        i = litEnd;
      }
    }

    return new Uint8Array(out);
  }

  function buildCompositeImageData(layers, width, height) {
    const w = new ByteWriter();
    w.writeUint16(0); // compression = raw

    // Плоское изображение
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const cx = c.getContext('2d');
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, width, height);
    for (const layer of layers) {
      cx.drawImage(layer.canvas, 0, 0);
    }
    const imgData = cx.getImageData(0, 0, width, height).data;

    // Interleaved RGB (без alpha)
    const pixels = new Uint8Array(width * height * 3);
    for (let i = 0, p = 0; i < imgData.length; i += 4, p += 3) {
      pixels[p] = imgData[i];
      pixels[p + 1] = imgData[i + 1];
      pixels[p + 2] = imgData[i + 2];
    }
    w.writeBytes(pixels);

    return w.getBytes();
  }

  // ============================================================
  //  ByteWriter
  // ============================================================
  class ByteWriter {
    constructor() {
      this.bytes = new Uint8Array(1024);
      this.length = 0;
    }
    _ensure(n) {
      if (this.length + n <= this.bytes.length) return;
      let newSize = this.bytes.length * 2;
      while (newSize < this.length + n) newSize *= 2;
      const nb = new Uint8Array(newSize);
      nb.set(this.bytes);
      this.bytes = nb;
    }
    writeUint8(v) { this._ensure(1); this.bytes[this.length++] = v & 0xFF; }
    writeUint16(v) { this._ensure(2); this.bytes[this.length++] = (v >> 8) & 0xFF; this.bytes[this.length++] = v & 0xFF; }
    writeInt16(v) { this.writeUint16(v < 0 ? v + 0x10000 : v); }
    writeUint32(v) {
      this._ensure(4);
      this.bytes[this.length++] = (v >>> 24) & 0xFF;
      this.bytes[this.length++] = (v >>> 16) & 0xFF;
      this.bytes[this.length++] = (v >>> 8) & 0xFF;
      this.bytes[this.length++] = v & 0xFF;
    }
    writeInt32(v) { this.writeUint32(v < 0 ? v + 0x100000000 : v); }
    writeString(s) {
      this._ensure(s.length);
      for (let i = 0; i < s.length; i++) this.bytes[this.length++] = s.charCodeAt(i) & 0xFF;
    }
    writeBytes(arr) {
      this._ensure(arr.length);
      this.bytes.set(arr, this.length);
      this.length += arr.length;
    }
    getBytes() {
      return this.bytes.slice(0, this.length);
    }
  }

  // ============================================================
  //  Скачивание
  // ============================================================
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // ============================================================
  //  ZIP (без компрессии, только store)
  // ============================================================
  async function buildZip(files) {
    const chunks = [];
    const centralDir = [];
    let offset = 0;

    const enc = new TextEncoder();

    for (const file of files) {
      const nameBytes = enc.encode(file.name);
      const data = file.data; // Uint8Array

      // Local file header
      const local = new ByteWriter();
      local.writeUint32(0x04034b50);       // signature
      local.writeUint16(20);               // version needed
      local.writeUint16(0);                // flags
      local.writeUint16(0);                // compression = store
      local.writeUint16(0);                // time
      local.writeUint16(0);                // date
      local.writeUint32(crc32(data));      // crc32
      local.writeUint32(data.length);      // compressed size
      local.writeUint32(data.length);      // uncompressed size
      local.writeUint16(nameBytes.length); // name length
      local.writeUint16(0);                // extra length
      local.writeBytes(nameBytes);
      local.writeBytes(data);

      const localBytes = local.getBytes();
      chunks.push(localBytes);

      // Central directory record
      const cd = new ByteWriter();
      cd.writeUint32(0x02014b50);          // signature
      cd.writeUint16(20);                  // version made by
      cd.writeUint16(20);                  // version needed
      cd.writeUint16(0);
      cd.writeUint16(0);                   // compression
      cd.writeUint16(0);
      cd.writeUint16(0);
      cd.writeUint32(crc32(data));
      cd.writeUint32(data.length);
      cd.writeUint32(data.length);
      cd.writeUint16(nameBytes.length);
      cd.writeUint16(0);                   // extra
      cd.writeUint16(0);                   // comment
      cd.writeUint16(0);                   // disk
      cd.writeUint16(0);                   // internal attrs
      cd.writeUint32(0);                   // external attrs
      cd.writeUint32(offset);              // local header offset
      cd.writeBytes(nameBytes);
      centralDir.push(cd.getBytes());

      offset += localBytes.length;
    }

    const cdBytes = [];
    let cdSize = 0;
    for (const cd of centralDir) { cdBytes.push(cd); cdSize += cd.length; }

    // End of central directory
    const eocd = new ByteWriter();
    eocd.writeUint32(0x06054b50);
    eocd.writeUint16(0);
    eocd.writeUint16(0);
    eocd.writeUint16(files.length);
    eocd.writeUint16(files.length);
    eocd.writeUint32(cdSize);
    eocd.writeUint32(offset);
    eocd.writeUint16(0);

    const all = [...chunks, ...cdBytes, eocd.getBytes()];
    return new Blob(all, { type: 'application/zip' });
  }

  // ============================================================
  //  Экспорт JSON-проекта
  // ============================================================
  function serializeProject(state) {
    return JSON.stringify({
      version: 1,
      canvasSize: CANVAS_SIZE,
      dpi: DPI,
      exportedAt: new Date().toISOString(),
      canvasBg: state.canvasBg || '#ffffff',
      categories: state.categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        visible: cat.visible !== false,
        opacity: cat.opacity != null ? cat.opacity : 1,
        items: cat.items.map(it => ({
          id: it.id,
          name: it.name,
          src: it.src, // base64
          transform: it.transform || null,
        })),
      })),
      activeItems: state.activeItems,
    }, null, 2);
  }

  // ============================================================
  //  Восстановление проекта из JSON
  // ============================================================
  async function deserializeProject(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    const categories = [];
    for (const cat of data.categories || []) {
      const items = [];
      for (const it of cat.items || []) {
        const img = await loadImage(it.src);
        items.push({
          id: it.id,
          name: it.name,
          src: it.src,
          img,
          transform: it.transform || null,
        });
      }
      categories.push({
        id: cat.id,
        name: cat.name,
        visible: cat.visible !== false,
        opacity: cat.opacity != null ? cat.opacity : 1,
        items,
      });
    }

    return {
      version: data.version || 1,
      canvasBg: data.canvasBg || '#ffffff',
      categories,
      activeItems: data.activeItems || {},
    };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // ============================================================
  //  Публичный API
  // ============================================================
  global.Exporter = {
    canvasToPngWithDpi,
    resizeCanvas,
    buildPSD,
    buildZip,
    download,
    serializeProject,
    deserializeProject,
    loadImage,
    DPI,
    CANVAS_SIZE,
  };
})(window);