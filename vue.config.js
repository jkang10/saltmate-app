const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  pwa: {
    name: 'Saltmate App',
    themeColor: '#007bff',
    msTileColor: '#000000',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',

    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      // [핵심 수정] 경로를 './'로 시작하는 상대 경로로 변경합니다.
      swSrc: './src/firebase-messaging-sw.js'
    }
  }
});