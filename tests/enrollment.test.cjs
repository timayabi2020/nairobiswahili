const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { createHash, randomUUID } = require('node:crypto');

const root = resolve(__dirname, '..');
const backend = readFileSync(resolve(root, 'google-apps-script/Code.gs'), 'utf8');
const frontend = readFileSync(resolve(root, 'enrollment.js'), 'utf8');
const valid = () => ({
  requestId: randomUUID(), lesson: 'Swahili Safari 1', name: 'Test Learner',
  phone: '+254 (700) 000-000', email: 'learner@example.com',
  startDate: '2027-01-20', message: 'Weekend lessons?\nOnline preferred.',
  consent: 'yes', website: ''
});

function server(options = {}) {
  const sent = [];
  const errors = [];
  const cache = new Map();
  const properties = new Map(Object.entries({
    SITE_ORIGIN: 'https://nairobiswahili.com',
    ENROLLMENT_EMAIL: 'school@example.com',
    ...options.properties
  }));
  let released = 0;
  const context = vm.createContext({
    console: { error: message => errors.push(message) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key),
      setProperties: values => Object.entries(values).forEach(([key, value]) => properties.set(key, value))
    }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => options.lock !== false, releaseLock: () => released++ }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_, value) => createHash('sha256').update(value).digest(),
      base64EncodeWebSafe: buffer => buffer.toString('base64url'),
      formatDate: date => date.toISOString().slice(0, 10)
    },
    MailApp: {
      getRemainingDailyQuota: () => options.quota ?? 100,
      sendEmail: message => {
        if (options.failSend) throw new Error('Mail service unavailable.');
        sent.push(message);
      }
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'allowall' },
      createHtmlOutput: html => ({ setXFrameOptionsMode: () => html })
    }
  });
  vm.runInContext(backend, context);
  function post(input) {
    const html = context.doPost({ parameter: input });
    let response;
    let target;
    vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], {
      window: { top: { postMessage: (data, origin) => { response = data; target = origin; } } }
    });
    assert.equal(target, properties.get('SITE_ORIGIN') || 'https://nairobiswahili.com');
    return response;
  }
  return { context, post, sent, errors, cache, properties, released: () => released };
}

test('email contains every field, fixed recipient and visitor reply-to; acknowledgement matches request', () => {
  const app = server();
  const input = valid();
  const result = app.post(input);
  assert.equal(result.ok, true);
  assert.equal(result.requestId, input.requestId);
  assert.equal(result.type, 'nairobi-enrollment');
  assert.equal(app.sent.length, 1);
  const mail = app.sent[0];
  assert.equal(mail.to, 'school@example.com');
  assert.equal(mail.replyTo, input.email);
  for (const key of ['lesson', 'name', 'phone', 'email', 'startDate', 'message']) assert.ok(mail.body.includes(input[key]), key);
  assert.equal(app.released(), 1);
});

test('optional fields and Unicode names are accepted, and email body remains plain text', () => {
  const app = server();
  assert.equal(app.post({ ...valid(), name: 'Amélie', startDate: '', message: '<script>example</script>' }).ok, true);
  assert.ok(app.sent[0].body.includes('Not specified'));
  assert.ok(app.sent[0].body.includes('<script>example</script>'));
  assert.equal(app.sent[0].htmlBody, undefined);
});

test('malformed, missing, oversized, header-injection and bot submissions never send', () => {
  const cases = [
    { name: ' ' }, { name: 'x'.repeat(121) }, { phone: '-------' }, { phone: 'abcdefg' },
    { email: 'bad' }, { email: 'a@example.com\nBcc: other@example.com' },
    { lesson: 'Course\r\nInjected' }, { message: 'x'.repeat(2001) },
    { startDate: '2027-02-29' }, { startDate: '2027-13-01' },
    { startDate: 'tomorrow' }, { consent: '' }, { website: 'bot.example' }, { requestId: '<script>' }
  ];
  for (const overrides of cases) {
    const app = server();
    assert.equal(app.post({ ...valid(), ...overrides }).ok, false, JSON.stringify(overrides));
    assert.equal(app.sent.length, 0);
    assert.equal(app.errors.length, 1);
    assert.ok(!app.errors[0].includes('learner@example.com'));
  }
  assert.equal(server().post(undefined).ok, false);
});

test('duplicate requests acknowledge once; per-address cap prevents additional sends', () => {
  const app = server();
  const input = valid();
  assert.equal(app.post(input).ok, true);
  assert.equal(app.post(input).ok, true);
  assert.equal(app.sent.length, 1);
  assert.equal(app.post(valid()).ok, true);
  assert.equal(app.post(valid()).ok, true);
  assert.equal(app.post(valid()).ok, false);
  assert.equal(app.sent.length, 3);
  assert.ok([...app.cache.keys()].every(key => !key.includes(input.email)));
});

test('daily cap, quota exhaustion, busy lock, bad setup and mail errors report failure', () => {
  for (const options of [
    { quota: 0 }, { lock: false }, { failSend: true },
    { properties: { ENROLLMENT_EMAIL: '' } },
    { properties: { SITE_ORIGIN: 'https://wrong.example/path' } },
    { properties: { SEND_DAY: new Date().toISOString().slice(0, 10), SEND_COUNT: '80' } }
  ]) {
    const app = server(options);
    assert.equal(app.post(valid()).ok, false);
    assert.equal(app.sent.length, 0);
    assert.equal(app.errors.length, 1);
  }
});

function client(config = { endpoint: 'https://script.google.com/macros/s/test-deployment/exec' }) {
  const listeners = {};
  const elements = new Map();
  let timer;
  let nativeSubmits = 0;
  let payload;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', dataset: {}, hidden: false, disabled: false,
      addEventListener: (type, fn) => { listeners[`${id}:${type}`] = fn; },
      setAttribute() {}, removeAttribute() {}, setCustomValidity() {}, focus() {},
      reportValidity: () => true,
      reset() {},
      querySelector: () => element('close'),
      showModal() { this.open = true; },
      close() { this.open = false; listeners['enrollment-dialog:close'](); }
    });
    return elements.get(id);
  }
  const document = {
    getElementById: element,
    body: { classList: { add() {}, remove() {} } }
  };
  element('enrollment-name').value = 'Test Learner';
  element('enrollment-phone').value = '+254700000000';
  const button = {
    closest: () => ({ querySelector: () => ({ textContent: 'Swahili Safari 2' }) }),
    focus() {}
  };
  vm.runInNewContext(frontend, {
    document, window: { addEventListener: (type, fn) => { listeners[type] = fn; } },
    fetch: async () => ({ ok: true, json: async () => config }),
    crypto: { randomUUID }, console: { error() {} },
    setTimeout: fn => { timer = fn; return 1; }, clearTimeout() {},
    URL, Date,
    HTMLFormElement: { prototype: { submit() {
      nativeSubmits++;
      payload = { disabled: element('enrollment-fields').disabled, requestId: element('enrollment-request-id').value };
    } } }
  });
  return {
    element, listeners, timeout: () => timer(), nativeSubmits: () => nativeSubmits, payload: () => payload,
    open: async () => {
      listeners['lessons-cards:click']({ target: { closest: () => button } });
      await new Promise(resolve => setImmediate(resolve));
    },
    submit: () => listeners['enrollment-form:submit']({ preventDefault() {} }),
    message: (origin, overrides = {}) => listeners.message({
      origin, data: { type: 'nairobi-enrollment', requestId: element('enrollment-request-id').value, ok: true, ...overrides }
    })
  };
}

test('frontend selects lesson, submits once with enabled payload, and waits for trusted matching receipt', async () => {
  const app = client();
  await app.open();
  assert.equal(app.element('enrollment-lesson').value, 'Swahili Safari 2');
  assert.equal(app.element('enrollment-submit').disabled, false);
  app.submit();
  app.submit();
  assert.equal(app.nativeSubmits(), 1);
  assert.equal(app.payload().disabled, false);
  assert.equal(app.element('enrollment-fields').disabled, true);
  for (const origin of ['null', 'https://evil.example', 'https://script.google.com.evil.example', 'http://script.google.com']) app.message(origin);
  app.message('https://script.google.com', { requestId: 'wrong' });
  app.message('https://script.google.com', { ok: 'true' });
  assert.equal(app.element('enrollment-form').hidden, false);
  app.message('https://n-example-script.googleusercontent.com');
  assert.equal(app.element('enrollment-form').hidden, true);
  assert.match(app.element('enrollment-status').textContent, /Asante/);
});

test('frontend handles explicit failure, ambiguous timeout and missing configuration honestly', async () => {
  for (const mode of ['failure', 'timeout']) {
    const app = client();
    await app.open();
    app.submit();
    if (mode === 'failure') app.message('https://script.google.com', { ok: false });
    else app.timeout();
    assert.equal(app.element('enrollment-status').dataset.error, 'true');
    assert.equal(app.element('enrollment-form').hidden, false);
    assert.equal(app.element('enrollment-fields').disabled, false);
  }
  const app = client({ endpoint: '' });
  await app.open();
  assert.equal(app.element('enrollment-submit').disabled, true);
  assert.match(app.element('enrollment-status').textContent, /unavailable/);
  app.submit();
  assert.equal(app.nativeSubmits(), 0);
});

test('Escape closes the popup explicitly', async () => {
  const app = client();
  await app.open();
  let prevented = false;
  app.listeners['enrollment-dialog:keydown']({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(app.element('enrollment-dialog').open, false);
  assert.equal(prevented, true);
});
