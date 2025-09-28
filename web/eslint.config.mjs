import nextPlugin from "eslint-config-next";

export default [
  {
    ignores: [".next", "dist", "node_modules", "coverage"]
  },
  ...nextPlugin,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react/jsx-sort-props": ["error", { "callbacksLast": true, "shorthandFirst": true }],
      "react/self-closing-comp": "error"
    }
  }
];
