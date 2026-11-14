const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  const window = new EventTarget(), document = new EventTarget();
  const sandbox = { window, document, exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('engineLifecycle.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, sandbox);
  return { window, document, scope: sandbox.exports.createEngineScope() };
}

test('engine subscriptions are removed without removing application listeners', () => {
  const { window, document, scope } = setup();
  const original = window.addEventListener;
  let engine = 0, app = 0;
  window.addEventListener('resize', () => app++);
  const value = scope.create(() => {
    window.addEventListener('resize', () => engine++);
    document.addEventListener('visibilitychange', () => engine++);
    return 42;
  });
  assert.equal(value, 42);
  assert.equal(window.addEventListener, original);
  assert.equal(Object.hasOwn(window, 'addEventListener'), false);
  window.dispatchEvent(new Event('resize'));
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(engine, 2);
  scope.release();
  scope.release();
  window.dispatchEvent(new Event('resize'));
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(engine, 2);
  assert.equal(app, 2);
});

test('factory failure restores methods and removes partially installed listeners', () => {
  const { window, scope } = setup();
  let calls = 0;
  const original = window.addEventListener;
  assert.throws(() => scope.create(() => {
    window.addEventListener('resize', () => calls++);
    throw new Error('initialization failed');
  }), /initialization failed/);
  assert.equal(window.addEventListener, original);
  window.dispatchEvent(new Event('resize'));
  assert.equal(calls, 0);
});

test('existing own method descriptors survive repeated setup and cleanup', () => {
  const { window, scope } = setup();
  const original = window.addEventListener.bind(window);
  Object.defineProperty(window, 'addEventListener', { value: original, configurable: true });
  const descriptor = Object.getOwnPropertyDescriptor(window, 'addEventListener');
  for (let i = 0; i < 5; i++) {
    scope.create(() => window.addEventListener('resize', () => {}));
    scope.release();
    assert.deepEqual(Object.getOwnPropertyDescriptor(window, 'addEventListener'), descriptor);
  }
});
