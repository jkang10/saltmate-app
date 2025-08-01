const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,

  // 만약 lintOnSave 관련 설정이 있다면 아래와 같이 false로 두거나 줄 전체를 삭제해도 됩니다.
  // lintOnSave: false
});
