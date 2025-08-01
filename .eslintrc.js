module.exports = {
  root: true,
  env: {
    node: true,
  },
  // extends �迭�� �״�� �����մϴ�.
  extends: [
    "plugin:vue/vue3-essential",
    "eslint:recommended",
    "plugin:prettier/recommended",
  ],
  // parser�� 'vue-eslint-parser'�� ���������� �����մϴ�.
  parser: "vue-eslint-parser",
  parserOptions: {
    // <script> �±� ���� �ڵ�� @babel/eslint-parser�� ����ϵ��� �����մϴ�.
    parser: "@babel/eslint-parser",
    ecmaVersion: 2020,
    sourceType: "module",
  },
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    "prettier/prettier": [
      "error",
      {
        endOfLine: "auto",
      },
    ],
  },
};
