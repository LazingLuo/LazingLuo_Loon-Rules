// Read-only Ali image probe: learn candidates by decoded pixel dimensions.
(function () {
  const bytes = $response.body;
  if (!(bytes instanceof Uint8Array)) return $done({});
  const size = getImageSize(bytes);
  const url = $request.url;
  const named = /tps-1125-(?:1602|2436)(?:[._!/?-]|$)/i.test(url);
  const measured = size && size.width === 1125 && (size.height === 2436 || size.height === 1602);
  if (!named && !measured) return $done({});
  const clean = url.split('?')[0];
  const filename = clean.slice(clean.lastIndexOf('/') + 1);
  const id = filename.replace(/-tps-.*$/i, '').split('.')[0];
  if (id.length < 8) return $done({});
  const record = {time:Date.now(), id:id, url:url, size:size, reason:measured?'真实尺寸':'URL尺寸标记'};
  try {
    let ids = JSON.parse($persistentStore.read('tb_splash_candidate_ids_v1') || '[]');
    if (!Array.isArray(ids)) ids=[];
    ids = ids.filter(x=>x.id!==id); ids.unshift(record);
    $persistentStore.write(JSON.stringify(ids.slice(0,50)), 'tb_splash_candidate_ids_v1');
    const refs = JSON.parse($persistentStore.read('tb_splash_recent_refs_v1') || '[]');
    const related = Array.isArray(refs) ? refs.filter(x=>x.refs && x.refs.some(r=>r.url.indexOf(id)>=0)) : [];
    $persistentStore.write(JSON.stringify({candidate:record, earlierReferences:related.slice(0,10)}),'tb_splash_last_image_v1');
    console.log('[淘宝竖屏候选] '+JSON.stringify(record)+'；此前接口引用='+related.length);
    $notification.post('淘宝/天猫竖屏素材候选',related.length?'已找到此前接口引用':'已学习ID，尚未找到接口引用',url);
  } catch(e) { console.log('[淘宝素材探测] 保存失败：'+e); }
  $done({});
  function getImageSize(data) {
    return pngSize(data) || gifSize(data) || jpegSize(data) || webpSize(data) || ispeSize(data);
  }

  function pngSize(data) {
    if (data.length < 24 || data[0] !== 0x89 || data[1] !== 0x50 ||
        data[2] !== 0x4e || data[3] !== 0x47) return null;
    return {width: readU32BE(data, 16), height: readU32BE(data, 20)};
  }

  function gifSize(data) {
    if (data.length < 10 || data[0] !== 0x47 || data[1] !== 0x49 ||
        data[2] !== 0x46 || data[3] !== 0x38) return null;
    return {width: readU16LE(data, 6), height: readU16LE(data, 8)};
  }

  function jpegSize(data) {
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 8 < data.length) {
      while (offset < data.length && data[offset] !== 0xff) offset++;
      while (offset < data.length && data[offset] === 0xff) offset++;
      if (offset >= data.length) break;
      const marker = data[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= data.length) break;
      const length = (data[offset] << 8) | data[offset + 1];
      if (length < 2 || offset + length > data.length) break;
      if (isSof(marker) && length >= 7) {
        return {
          width: (data[offset + 5] << 8) | data[offset + 6],
          height: (data[offset + 3] << 8) | data[offset + 4]
        };
      }
      offset += length;
    }
    return null;
  }

  function isSof(marker) {
    return (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
  }

  function webpSize(data) {
    if (data.length < 30 || ascii(data, 0, 4) !== "RIFF" ||
        ascii(data, 8, 4) !== "WEBP") return null;
    const kind = ascii(data, 12, 4);
    if (kind === "VP8X") {
      return {
        width: 1 + readU24LE(data, 24),
        height: 1 + readU24LE(data, 27)
      };
    }
    if (kind === "VP8L" && data[20] === 0x2f && data.length >= 25) {
      return {
        width: 1 + (data[21] | ((data[22] & 0x3f) << 8)),
        height: 1 + ((data[22] >> 6) | (data[23] << 2) | ((data[24] & 0x0f) << 10))
      };
    }
    if (kind === "VP8 ") {
      const end = Math.min(data.length - 9, 64);
      for (let i = 20; i <= end; i++) {
        if (data[i] === 0x9d && data[i + 1] === 0x01 && data[i + 2] === 0x2a) {
          return {
            width: readU16LE(data, i + 3) & 0x3fff,
            height: readU16LE(data, i + 5) & 0x3fff
          };
        }
      }
    }
    return null;
  }

  // HEIC/HEIF/AVIF store dimensions in an ispe box. Metadata is normally near the front.
  function ispeSize(data) {
    const end = Math.min(data.length - 16, 1024 * 1024);
    for (let i = 4; i <= end; i++) {
      if (data[i] === 0x69 && data[i + 1] === 0x73 &&
          data[i + 2] === 0x70 && data[i + 3] === 0x65) {
        const width = readU32BE(data, i + 8);
        const height = readU32BE(data, i + 12);
        if (width > 0 && height > 0) return {width: width, height: height};
      }
    }
    return null;
  }

  function ascii(data, offset, length) {
    let value = "";
    for (let i = 0; i < length; i++) value += String.fromCharCode(data[offset + i]);
    return value;
  }

  function readU16LE(data, offset) {
    return data[offset] | (data[offset + 1] << 8);
  }

  function readU24LE(data, offset) {
    return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
  }

  function readU32BE(data, offset) {
    return ((data[offset] * 0x1000000) + (data[offset + 1] << 16) +
      (data[offset + 2] << 8) + data[offset + 3]) >>> 0;
  }

})();
