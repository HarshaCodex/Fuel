/* global __dirname, test, expect */
const fs = require('fs');
const path = require('path');

// Expo Router turns every file under app/ into a route and bundles it for the phone. A test file there pulls
// Node-only test code into the app bundle, which fails to build on iOS and Android, so tests live in __tests__/.
function findTestFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findTestFiles(full);
    return /\.(test|spec)\.[jt]sx?$/.test(entry.name) ? [full] : [];
  });
}

test('keeps test files out of the app/ routes folder', () => {
  expect(findTestFiles(path.join(__dirname, '..', 'app'))).toEqual([]);
});
