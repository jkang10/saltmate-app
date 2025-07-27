// vue.config.js
const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: '/' // 여기에 중요! 빌드된 파일이 제공될 기본 URL 경로.
})