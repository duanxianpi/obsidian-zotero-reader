const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

// Load the actual Reader class with inert rendering dependencies. Its SDT
// state machine runs unchanged; no browser, React tree or model files needed.
const source = fs.readFileSync(path.resolve(__dirname, '../../src/common/reader.js'), 'utf8');
const compiled = babel.transformSync(source, {
	configFile: false, babelrc: false,
	presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-react'],
}).code;
const structure = { document: 'fixture' };
const dependencies = {
	createContext: () => ({}),
	createPositionMapper: () => ({}),
	SDT_PACK_VERSION: 1,
	SDT_SCHEMA_VERSION: '1.0',
	openStructuredDocumentTextPack: async () => ({ materialize: async () => structure }),
};
const warnings = [];
const context = {
	exports: {}, require: () => dependencies,
	console: { warn: (...args) => warnings.push(args), error: () => {} },
	setTimeout: callback => { context.scheduled.push(callback); }, scheduled: [],
	window: { getComputedStyle: () => ({ getPropertyValue: () => '' }) },
	document: { body: {} },
};
vm.runInNewContext(compiled, context);
const Reader = context.exports.default;
const success = { ok: true, bytes: new ArrayBuffer(0), packVersion: 1, schemaMajorVersion: 1 };
function readerWith(getSDTPack) {
	const reader = Object.create(Reader.prototype);
	reader._getSDTPack = getSDTPack;
	reader._updateState = state => Object.assign(reader._state, state);
	reader._state = {};
	reader._readerRef = { current: null };
	return reader;
}

const adapterCode = babel.transformSync(fs.readFileSync(
	path.resolve(__dirname, '../../src/index.obsidian.reader.js'), 'utf8'), {
	configFile: false, babelrc: false,
	presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
}).code;
function adapterWith(parent) {
	const adapterContext = { exports: {}, window: {}, require: () => ({ ObsidianBridge: parent }) };
	vm.runInNewContext(adapterCode, adapterContext);
	return new adapterContext.exports.default();
}

test('installing after an unavailable Pack retries in the same Reader, then caches success', async () => {
	let calls = 0;
	const reader = readerWith(async ({ onProgress }) => {
		calls++;
		if (calls === 1) return { ok: false, reason: 'unavailable' };
		onProgress(30);
		return success;
	});
	assert.equal(await reader._loadSDT(), null);
	assert.equal(reader._sdtPromise, null);
	const result = await reader._loadSDT();
	assert.equal(result.structure, structure);
	assert.equal(reader._state.sdtProgress, null);
	assert.equal(await reader._loadSDT(), result);
	assert.equal(calls, 2);
});

test('concurrent SDT consumers share one generation', async () => {
	let finish;
	let calls = 0;
	const reader = readerWith(() => {
		calls++;
		return new Promise(resolve => { finish = resolve; });
	});
	const first = reader._loadSDT();
	const second = reader._loadSDT();
	finish(success);
	assert.equal(await first, await second);
	assert.equal(calls, 1);
});

test('closing during a request suppresses late progress, materialization and overlay creation', async () => {
	warnings.length = 0;
	let finish;
	let progress;
	let active = true;
	const adapter = adapterWith({});
	const reader = readerWith(({ onProgress }) => {
		// Host contract: requestReaderSDT suppresses progress after bridge close.
		// Its real implementation is covered in ZotFlow's reader-sdt.test.ts.
		progress = value => { if (active) onProgress(value); };
		return new Promise(resolve => { finish = resolve; });
	});
	adapter.reader = reader;
	reader._createView = () => assert.fail('Late SDT must not create a view');
	const pending = reader._setReadingMode(true, true);
	// Reading-mode transitions begin in a microtask.
	await Promise.resolve();
	progress(10);
	assert.equal(reader._state.sdtProgress, 10);
	active = false;
	await adapter.dispose();
	progress(90);
	// ZotFlow discards the generated result once the owning bridge is closed.
	finish({ ok: false, reason: 'unavailable' });
	await pending;
	assert.equal(reader._sdt, undefined);
	assert.equal(reader._state, null);
	assert.equal(warnings.some(([message]) => message === 'Failed to load SDT pack'), false);
});

test('a queued reading-mode toggle cannot restart work after close', async () => {
	const reader = readerWith(() => assert.fail('Closed Reader must not request SDT'));
	let resume;
	reader._readingModeQueue = new Promise(resolve => { resume = resolve; });
	const pending = reader._setReadingMode(true, true);
	await reader.destroy();
	resume();
	await pending;
	assert.equal(reader._state, null);
});

test('closing during materialization does not repopulate the SDT cache', async () => {
	const reader = readerWith(() => {});
	let finish;
	reader.getSDTReader = async () => ({
		materialize: () => new Promise(resolve => { finish = resolve; }),
	});
	const pending = reader._loadSDT();
	await Promise.resolve();
	await reader.destroy();
	finish(structure);
	assert.equal(await pending, null);
	assert.equal(reader._sdt, undefined);
});

test('reading-mode error feedback does not update a closed Reader', async () => {
	const reader = readerWith(() => {});
	reader._getString = () => 'unavailable';
	reader.setErrorMessage = () => {};
	reader._setReadingMode = async () => { throw Error('unavailable'); };
	context.scheduled.length = 0;
	await reader._handleReadingModeEnabledChange(true);
	assert.equal(context.scheduled.length, 1);
	await reader.destroy();
	// The five-second error banner can outlive the Reader that displayed it.
	context.scheduled[0]();

	const other = readerWith(() => {});
	let fail;
	other._setReadingMode = () => new Promise((_, reject) => { fail = reject; });
	const pending = other._handleReadingModeEnabledChange(true);
	await other.destroy();
	fail(Error('late failure'));
	await pending;
});

test('the Obsidian adapter destroys both SDT overlays before Reader cleanup', async () => {
	const adapter = adapterWith({});
	const destroyed = [];
	adapter.reader = {
		_secondarySDTView: { destroy: () => destroyed.push('secondary') },
		_primarySDTView: { destroy: () => destroyed.push('primary') },
		destroy: () => destroyed.push('reader'),
	};
	await adapter.dispose();
	assert.deepEqual(destroyed, ['secondary', 'primary', 'reader']);
	assert.equal(adapter.reader, undefined);
});
