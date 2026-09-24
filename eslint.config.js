const js = require('@eslint/js');
const security = require('eslint-plugin-security');

module.exports = [
  { ignores: ['node_modules/**', '.scannerwork/**'] },
  js.configs.recommended,
  security.configs.recommended,
  {
    files: ['server.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'readonly', process: 'readonly', console: 'readonly', __dirname: 'readonly' },
    },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { document: 'readonly', fetch: 'readonly', confirm: 'readonly' },
    },
  },
];
