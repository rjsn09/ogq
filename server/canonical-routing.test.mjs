import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { build } from 'esbuild';

// Bundle the real handler and query parser, replacing only upstream HTTP I/O.
const bundle = await build({
  entryPoints: ['api/canonical-proxy.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  plugins: [{
    name: 'mock-upstream',
    setup(builder) {
      builder.onLoad({ filter: /ogqProxy\.ts$/ }, async (args) => {
        const source = await readFile(args.path, 'utf8');
        return {
          contents: source.replace(
            'export async function proxyOGQ(',
            'async function unusedProxyOGQ(',
          ) + '\nexport async function proxyOGQ(req, res, path) { res.forwarded = path; }',
          loader: 'ts',
        };
      });
    },
  }],
});
const { default: handler } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

function response() {
  return {
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
}

test('nested canonical URLs have an explicit rewrite to an existing function', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.deepEqual(config.rewrites, [{
    source: '/api/canonical/:path*',
    destination: '/api/canonical-proxy?path=:path*',
  }]);
  await readFile('api/canonical-proxy.ts');
});

for (const [method, path] of [
  ['POST', ''],
  ['GET', 'character-123'],
  ['POST', 'character-123/regenerate'],
  ['POST', 'character-123/approve'],
  ['POST', 'character-123/generate-set'],
  ['GET', 'character-123/events'],
  ['GET', 'generate-set/job-123/events'],
  ['GET', 'generate-set/job-123/status'],
]) {
  test(`${method} canonical/${path} forwards to the matching backend route`, async () => {
    const res = response();
    await handler({ method, query: { path, after: '2' } }, res);
    assert.equal(res.forwarded, `/api/canonical${path ? `/${path}` : ''}?after=2`);
  });
}

test('invalid paths and unsupported methods never reach the backend', async () => {
  for (const [method, path, code] of [
    ['POST', '../health', 400],
    ['POST', 'character?override=1', 400],
    ['DELETE', 'character-123', 405],
  ]) {
    const res = response();
    await handler({ method, query: { path } }, res);
    assert.equal(res.statusCode, code);
    assert.equal(res.forwarded, undefined);
  }
});
