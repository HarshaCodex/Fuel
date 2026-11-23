const { defineConfig, globalIgnores } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

// eslint-config-expo's "typescript" import resolver fails to load with TypeScript 6, so the import rules
// that need module resolution are off. tsc already checks that imports resolve and exports exist.
const resolverRules = ['no-unresolved', 'namespace', 'named', 'default', 'export', 'no-named-as-default', 'no-named-as-default-member', 'no-duplicates'];

module.exports = defineConfig([
  expo,
  { rules: Object.fromEntries(resolverRules.map((r) => [`import/${r}`, 'off'])) },
  globalIgnores(['dist/*', '.expo/*', 'web-build/*', 'screenshots/*']),
]);
