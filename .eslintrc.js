module.exports = {
  root: true,
  env: {
    node: true,
    "vue/setup-compiler-macros": true, // <script setup> 환경을 인식하도록 추가
  },
  extends: [
    "plugin:vue/vue3-essential",
    "eslint:recommended",
    "prettier", // ESLint의 서식 규칙을 비활성화 (prettier와 충돌 방지)
  ],
  parserOptions: {
    parser: "@babel/eslint-parser",
  },
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    // 'prettier/prettier' 규칙은 extends에 prettier를 추가했으므로 제거하거나 그대로 둬도 괜찮습니다.
    // 여기서는 명시적으로 제거하여 혼동을 줄입니다.
  },
};