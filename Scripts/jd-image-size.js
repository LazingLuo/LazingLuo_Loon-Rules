// Replace selected image dimensions with a transparent 1x1 PNG.
(function () {
  const bytes = $response.body;
  if (!(bytes instanceof Uint8Array) || bytes.length < 10) return $done({});

  const targetText = $argument && typeof $argument.sizes === "string"
    ? $argument.sizes
    : "1125x2436,1125x1602";
  const targets = new Set(
    targetText.split(",").map(function (item) {
      return item.trim().toLowerCase().replace(/\s+/g, "");
    }).filter(Boolean)
  );

  const size = getImageSize(bytes);
  if (!size || !targets.has(size.width + "x" + size.height)) return $done({});

  const learnedId = learnMaterialId($request.url);
  const confirmed = learnedId && isConfirmedId(learnedId);
  if ($argument && $argument.confirmed_only === true && !confirmed) {
    console.log("[京东开屏图片] 尺寸命中但不是 start 已确认素材，仅学习不替换：" +
      size.width + "x" + size.height + " " + $request.url);
    return $done({});
  }

  const transparentPng = new Uint8Array([
    137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,
    0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,13,73,68,65,84,
    8,29,99,248,207,192,240,31,0,5,128,2,63,73,194,250,89,0,
    0,0,0,73,69,78,68,174,66,96,130
  ]);
  const headers = Object.assign({}, $response.headers || {});
  removeHeader(headers, "content-length");
  removeHeader(headers, "content-encoding");
  removeHeader(headers, "transfer-encoding");
  setHeader(headers, "Content-Type", "image/png");

  const message = "已替换 " + size.width + "x" + size.height +
    (learnedId ? "\n素材标识：" + learnedId + (confirmed ? "（start已确认）" : "（仅尺寸候选）") : "") +
    "\n" + $request.url;
  console.log("[京东开屏图片] " + message);
  if (!$argument || $argument.notify !== false) {
    try {
      $notification.post("京东开屏图片已拦截", size.width + "x" + size.height, $request.url);
    } catch (error) {
      console.log("[京东开屏图片] 通知发送失败：" + error);
    }
  }
  $done({headers: headers, body: transparentPng});

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

  function removeHeader(headers, name) {
    Object.keys(headers).forEach(function (key) {
      if (key.toLowerCase() === name.toLowerCase()) delete headers[key];
    });
  }

  function setHeader(headers, name, value) {
    removeHeader(headers, name);
    headers[name] = value;
  }

  function learnMaterialId(url) {
    if (typeof $persistentStore === "undefined") return "";
    const cleanUrl = String(url || "").split("?")[0].split("#")[0];
    const fileName = cleanUrl.slice(cleanUrl.lastIndexOf("/") + 1);
    const id = fileName.split(".")[0];
    // JD image identifiers observed here are normally 16 hexadecimal characters.
    if (!/^[0-9a-f]{12,64}$/i.test(id)) return "";
    const key = "jd_splash_learned_ids_v1";
    let saved = [];
    try {
      saved = JSON.parse($persistentStore.read(key) || "[]");
      if (!Array.isArray(saved)) saved = [];
    } catch (_) {
      saved = [];
    }
    saved = saved.filter(function (item) { return typeof item === "string" && item !== id; });
    saved.unshift(id);
    saved = saved.slice(0, 50);
    try {
      $persistentStore.write(JSON.stringify(saved), key);
      return id;
    } catch (error) {
      console.log("[京东开屏图片] 自动学习素材标识失败：" + error);
      return "";
    }
  }

  function isConfirmedId(id) {
    const builtIn = ["0258465984541464", "0258465984fe4b7a", "02584659844678e3"];
    if (builtIn.indexOf(id) !== -1) return true;
    if (typeof $persistentStore === "undefined") return false;
    try {
      const saved = JSON.parse($persistentStore.read("jd_splash_confirmed_ids_v1") || "[]");
      return Array.isArray(saved) && saved.indexOf(id) !== -1;
    } catch (_) {
      return false;
    }
  }
})();
