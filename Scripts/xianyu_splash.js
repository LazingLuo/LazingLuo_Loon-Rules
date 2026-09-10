let body = $response.body;

try {
  const obj = JSON.parse(body);

  if (obj?.data?.adMap) {
    obj.data.adMap = {};
  }

  body = JSON.stringify(obj);
} catch (e) {
  console.log(`闲鱼开屏处理失败: ${e}`);
}

$done({ body });
