module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', ".eslintrc.cjs"],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react', 'react-refresh'],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "quotes": [1, "double"],
    "no-plusplus": "off",
    "no-underscore-dangle": "off",
    "no-shadow": "off",
    "no-use-before-define": "off",
    "comma-dangle": ["error", {
      "arrays": "only-multiline",
      "objects": "only-multiline",
      "imports": "only-multiline",
      "exports": "only-multiline",
      "functions": "ignore"
    }],
    "arrow-body-style": "off",
    "no-else-return": "off",
    "quote-props": "off",
    "class-methods-use-this": "off",
    "arrow-parens": "off",
    "no-case-declarations": "off",
    "no-nested-ternary": "off",
    "prefer-promise-reject-errors": "off",
    "react/jsx-filename-extension": "off",
    "react/prefer-stateless-function": "off",
    "react/forbid-prop-types": "off",
    "react/jsx-closing-bracket-location": "off",
    "react/jsx-curly-brace-presence": "off",
    "linebreak-style": "off",
    "jsx-a11y/label-has-for": "off",
    "jsx-a11y/anchor-is-valid": "off",
    "jsx-a11y/label-has-associated-control": "off",
    "import/extensions": "off",
    "react-hooks/exhaustive-deps": "off",
    "react-refresh/only-export-components": "off",
    "no-unused-vars": [
      "error",
      {
        "varsIgnorePattern": "React"
      }
    ],
    "no-console": [
      "warn",
      {
        "allow": [
          "warn",
          "error"
        ]
      }
    ]
  },
  globals: {
    Headway: true,
    HW_config: true,
    process: true,
  },
}
