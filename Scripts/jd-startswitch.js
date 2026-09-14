// Experimental: the meaning of StartSwitch2026 is not confirmed.
// Change this field only; preserve errors and unfamiliar response structures.
(function () {
  let result = {};
  try {
    if (!/^https:\/\/api\.m\.jd\.com\/client\.action\?/.test($request.url) ||
        !/[?&]functionId=basicConfig(?:&|$)/.test($request.url)) return $done({});
    const obj = JSON.parse($response.body);
    if (!obj || (obj.code !== "0" && obj.code !== 0)) return $done({});
    const field = obj.data && obj.data["JDApp-home"] && obj.data["JDApp-home"].StartSwitch2026;
    if (!field || typeof field !== "object" || Array.isArray(field) ||
        !Object.prototype.hasOwnProperty.call(field, "value")) {
      console.log("[京东启动开关实验] 未找到目标字段，保留原响应");
      return $done({});
    }
    const oldValue = field.value;
    field.value = "0";
    result = {body: JSON.stringify(obj)};
    console.log("[京东启动开关实验] StartSwitch2026.value: " + oldValue + " -> 0");
  } catch (_) {
    console.log("[京东启动开关实验] 正文不可解析，保留原响应");
  }
  $done(result);
})();
