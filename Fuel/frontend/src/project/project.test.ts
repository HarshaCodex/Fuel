// @types/node is not a dependency, so load fs through Jest; jest runs with cwd = package root.
const fs = jest.requireActual<{ readFileSync(p: string, enc: string): string }>('fs');
const read = (f: string) => fs.readFileSync(`${process.cwd()}/${f}`, 'utf8');

describe('project setup', () => {
  it('defines the typecheck, lint, test, check and screenshots scripts', () => {
    const { scripts } = JSON.parse(read('package.json'));
    expect(scripts.typecheck).toBe('tsc --noEmit');
    expect(scripts.lint).toBe('eslint .');
    expect(scripts.test).toBe('jest --ci');
    expect(scripts.check).toContain('typecheck');
    expect(scripts.check).toContain('lint');
    expect(scripts.check).toContain('test');
    expect(scripts.screenshots).toContain('screenshots.mjs');
  });

  it.each(['screenshots/', 'node_modules/', 'dist/', '.expo/', 'web-build/'])(
    'gitignores %s',
    (entry) => {
      expect(read('.gitignore').split('\n')).toContain(entry);
    },
  );

  it('provides the API base URL variable in .env.example and the README', () => {
    expect(read('.env.example')).toMatch(/^EXPO_PUBLIC_API_BASE_URL=https?:\/\//m);
    expect(read('README.md')).toContain('EXPO_PUBLIC_API_BASE_URL');
  });

  it.each(['npm install', 'npm run check', 'npm run screenshots'])(
    'documents %s in the README',
    (cmd) => {
      expect(read('README.md')).toContain(cmd);
    },
  );
});
