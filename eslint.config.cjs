const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    rules: {
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
    },
  },
];
