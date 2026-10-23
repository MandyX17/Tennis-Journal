/* ============ 极简 ZIP：只做 store（不压缩），用于含媒体备份 ============ */
(function (global) {
  'use strict';

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function w16(a, o, v) { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; }
  function w32(a, o, v) { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; a[o + 2] = (v >>> 16) & 255; a[o + 3] = (v >>> 24) & 255; }

  function create(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;

    files.forEach(f => {
      const nameBytes = enc.encode(f.name);
      const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
      const crc = crc32(data);
      const size = data.length;

      const lh = new Uint8Array(30 + nameBytes.length);
      w32(lh, 0, 0x04034b50);
      w16(lh, 4, 20);
      w16(lh, 6, 0x0800);       // UTF-8 文件名
      w16(lh, 8, 0);            // store
      w16(lh, 10, 0);           // 时间
      w16(lh, 12, 0x21);        // 日期 1980-01-01
      w32(lh, 14, crc);
      w32(lh, 18, size);
      w32(lh, 22, size);
      w16(lh, 26, nameBytes.length);
      w16(lh, 28, 0);
      lh.set(nameBytes, 30);

      chunks.push(lh, data);

      const ch = new Uint8Array(46 + nameBytes.length);
      w32(ch, 0, 0x02014b50);
      w16(ch, 4, 20);
      w16(ch, 6, 20);
      w16(ch, 8, 0x0800);
      w16(ch, 10, 0);
      w16(ch, 12, 0);
      w16(ch, 14, 0x21);
      w32(ch, 16, crc);
      w32(ch, 20, size);
      w32(ch, 24, size);
      w16(ch, 28, nameBytes.length);
      w16(ch, 30, 0);
      w16(ch, 32, 0);
      w16(ch, 34, 0);
      w16(ch, 36, 0);
      w32(ch, 38, 0);
      w32(ch, 42, offset);
      ch.set(nameBytes, 46);
      central.push(ch);

      offset += lh.length + size;
    });

    let centralSize = 0;
    central.forEach(c => { centralSize += c.length; });

    const eocd = new Uint8Array(22);
    w32(eocd, 0, 0x06054b50);
    w16(eocd, 4, 0);
    w16(eocd, 6, 0);
    w16(eocd, 8, files.length);
    w16(eocd, 10, files.length);
    w32(eocd, 12, centralSize);
    w32(eocd, 16, offset);
    w16(eocd, 20, 0);

    const all = chunks.concat(central, [eocd]);
    let total = 0;
    all.forEach(a => { total += a.length; });
    const out = new Uint8Array(total);
    let p = 0;
    all.forEach(a => { out.set(a, p); p += a.length; });

    return new Blob([out], { type: 'application/zip' });
  }

  function parse(buffer) {
    const u8 = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    let eocd = -1;
    const minStart = Math.max(0, u8.length - 22 - 65535);
    for (let i = u8.length - 22; i >= minStart; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 zip 文件');

    const count = dv.getUint16(eocd + 10, true);
    let cdOff = dv.getUint32(eocd + 16, true);
    const out = [];

    for (let i = 0; i < count; i++) {
      if (dv.getUint32(cdOff, true) !== 0x02014b50) break;
      const method = dv.getUint16(cdOff + 10, true);
      const compSize = dv.getUint32(cdOff + 20, true);
      const nameLen = dv.getUint16(cdOff + 28, true);
      const extraLen = dv.getUint16(cdOff + 30, true);
      const commentLen = dv.getUint16(cdOff + 32, true);
      const localOff = dv.getUint32(cdOff + 42, true);
      const name = new TextDecoder('utf-8').decode(u8.subarray(cdOff + 46, cdOff + 46 + nameLen));

      const lNameLen = dv.getUint16(localOff + 26, true);
      const lExtraLen = dv.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const data = u8.slice(dataStart, dataStart + compSize);

      out.push({ name, method, data });
      cdOff += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  global.MiniZip = { create, parse };
})(window);
