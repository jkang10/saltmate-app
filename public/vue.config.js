// vue.config.js
const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  // �߿�: ����� ������ ������ �⺻ URL ��θ� �����մϴ�.
  // Netlify�� ���� ���� ȣ���ÿ����� ��Ʈ ��� '/'�� ����մϴ�.
  publicPath: '/'
})