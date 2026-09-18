const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');
const { CHTML } = require('mathjax-full/js/output/chtml.js');
const { TeXFont } = require('mathjax-full/js/output/chtml/fonts/tex.js');

const root = path.resolve(__dirname, '../..');
const template = fs.readFileSync(path.join(root, 'index.obsidian.reader.html'), 'utf8');
const environment = /<script>\s*([\s\S]*?)<\/script>/.exec(template)[1];
const compiled = babel.transformSync(fs.readFileSync(path.join(root, 'src/obsidian-mathjax.js'), 'utf8'), {
	configFile: false, babelrc: false,
	presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
}).code;
// The real package's startup check is the regression trigger. Its imports only
// register TeX packages; stub those to run the check in the iframe's VM realm.
const allPackages = fs.readFileSync(require.resolve('mathjax-full/js/input/tex/AllPackages.js'), 'utf8');

function scriptElement(src) {
	const listeners = new Map();
	return {
		src, removed: false,
		addEventListener(event, fn) { listeners.set(event, fn); },
		removeEventListener(event) { listeners.delete(event); },
		emit(event) { listeners.get(event)?.(); },
		remove() { this.removed = true; },
		listeners,
	};
}

function createHostConfig(version) {
	const callback = () => {};
	const config = {
		loader: { paths: { mathjax: 'app://obsidian.md/lib/mathjax', fonts: '/local-fonts' } },
		chtml: { fontURL: '/local-fonts/woff2', adaptiveCSS: true },
		tex: { macros: { RR: '\\mathbb{R}' }, packages: ['base', 'ams'], postFilters: [callback] },
		options: { enableMenu: false },
		startup: { ready: callback },
	};
	if (version.startsWith('4.')) {
		config.output = { font: 'mathjax-tex' };
	}
	return config;
}

function harness({ filename = 'obsidian-mathjax.js', version = '4.0.0', config = createHostConfig(version) } = {}) {
	const hostScript = scriptElement(`app://obsidian.md/lib/mathjax/${filename}`);
	const parent = {
		location: { origin: 'app://obsidian.md' },
		document: { scripts: [hostScript] },
		MathJax: { version, config, startup: { promise: Promise.resolve() } },
	};
	const added = [];
	const warnings = [];
	const timers = new Map();
	const doc = {
		querySelector: () => ({ setAttribute() {} }),
		createElement: () => scriptElement(''),
		head: { appendChild(element) { added.push(element); } },
	};
	const context = {
		parent, document: doc, exports: {}, require: () => ({}),
		console: { warn: (...args) => warnings.push(args) },
		setTimeout(fn) { const id = {}; timers.set(id, fn); return id; },
		clearTimeout(id) { timers.delete(id); },
	};
	context.window = context;
	vm.createContext(context);
	vm.runInContext(environment, context);
	vm.runInContext(allPackages, context);
	vm.runInContext(compiled, context);
	return { context, parent, version, config, hostScript, added, warnings, timers };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

async function finishScriptLoad(h, initialized) {
	const script = h.added[0];
	let ready;
	const stylesheet = { name: 'CHTML stylesheet' };
	h.context.MathJax = {
		startup: { promise: new Promise((resolve) => {
			ready = resolve;
		}) },
		chtmlStylesheet: () => stylesheet,
	};
	script.emit('load');
	await tick();
	assert.equal(h.added.length, 1, 'stylesheet must wait for MathJax startup');
	ready();
	await initialized;
	assert.equal(h.added[1], stylesheet);
	assert.equal(h.timers.size, 0);
	assert.equal(script.listeners.size, 0);
	assert.equal(h.warnings.length, 0);
}

test('rebuilds MathJax 3 config without copying its runtime font instance', async () => {
	const version = '3.2.2';
	const config = createHostConfig(version);
	const hostFont = new TeXFont({ fontURL: config.chtml.fontURL });
	config.chtml.font = hostFont;
	config.chtml.cssStyles = { runtime: true };
	config.loader.paths.invalid = { runtime: true };
	config.output = { font: 'must-not-cross-the-version-boundary' };
	const h = harness({ filename: 'tex-chtml-full.js', version, config });
	assert.equal(h.context.MathJax, undefined, 'HTML must not expose a partial global before bundled imports');
	const initialized = h.context.exports.initializeEditorMathJax(h.context, h.parent);
	await tick();
	const copied = h.context.MathJax;
	assert.equal(h.added[0].src, h.hostScript.src);
	assert.equal(copied.chtml.adaptiveCSS, false);
	assert.equal(copied.chtml.fontURL, config.chtml.fontURL);
	assert.equal(copied.chtml.font, undefined);
	assert.equal(copied.chtml.cssStyles, undefined);
	assert.equal(copied.loader.paths.invalid, undefined);
	assert.equal(copied.output, undefined);
	assert.equal(copied.tex, undefined);
	assert.equal(copied.startup.typeset, false);
	let output;
	assert.doesNotThrow(() => {
		output = new CHTML(copied.chtml);
	});
	assert.equal(typeof output.font.adaptiveCSS, 'function');
	assert.equal(config.chtml.font, hostFont, 'host runtime config must remain untouched');
	await finishScriptLoad(h, initialized);
});

test('copies only safe MathJax 4 font and path settings', async () => {
	const version = '4.0.0';
	const config = createHostConfig(version);
	config.loader.paths.invalid = { runtime: true };
	config.output.fontPath = 'app://obsidian.md/lib/mathjax/%%FONT%%';
	config.output.runtimeFont = { instance: true };
	config.chtml.dynamicPrefix = 'app://obsidian.md/lib/mathjax/dynamic';
	config.chtml.matchFontHeight = false;
	config.chtml.font = { instance: true };
	const h = harness({ version, config });
	const initialized = h.context.exports.initializeEditorMathJax(h.context, h.parent);
	await tick();
	const copied = h.context.MathJax;
	assert.deepEqual(
		JSON.parse(JSON.stringify(copied.loader.paths)),
		{ mathjax: 'app://obsidian.md/lib/mathjax', fonts: '/local-fonts' }
	);
	assert.deepEqual(
		JSON.parse(JSON.stringify(copied.output)),
		{ font: 'mathjax-tex', fontPath: 'app://obsidian.md/lib/mathjax/%%FONT%%' }
	);
	assert.equal(copied.chtml.fontURL, config.chtml.fontURL);
	assert.equal(copied.chtml.dynamicPrefix, config.chtml.dynamicPrefix);
	assert.equal(copied.chtml.matchFontHeight, false);
	assert.equal(copied.chtml.adaptiveCSS, false);
	assert.equal(copied.chtml.font, undefined);
	assert.equal(copied.tex, undefined);
	assert.deepEqual(JSON.parse(JSON.stringify(copied.options)), { enableMenu: false });
	assert.deepEqual(JSON.parse(JSON.stringify(copied.startup)), { typeset: false });
	assert.deepEqual(config.chtml.font, { instance: true }, 'host runtime config must remain untouched');
	await finishScriptLoad(h, initialized);
});

test('waits for the host warm-up instead of using its unfinished configuration', async () => {
	const h = harness();
	h.parent.MathJax = h.config;
	const initialized = h.context.exports.initializeEditorMathJax(h.context, h.parent);
	assert.equal(h.added.length, 0);
	h.parent.MathJax = { version: h.version, config: h.config, startup: { promise: Promise.resolve() } };
	h.hostScript.emit('load');
	await tick();
	h.added[0].emit('error');
	await initialized;
	assert.equal(h.hostScript.listeners.size, 0);
	assert.equal(h.context.MathJax, undefined);
	assert.equal(h.timers.size, 0);
});

test('rejects an unknown MathJax major without delaying reader initialization', async () => {
	const h = harness({ version: '5.0.0' });
	await h.context.exports.initializeEditorMathJax(h.context, h.parent);
	assert.equal(h.context.MathJax, undefined);
	assert.equal(h.added.length, 0);
	assert.equal(h.warnings.length, 1);
	assert.match(h.warnings[0][1].message, /Unsupported editor MathJax version: 5\.0\.0/);
});

test('continues without installing a partial global when Obsidian has no MathJax', async () => {
	const h = harness();
	h.parent.document.scripts = [];
	delete h.parent.MathJax;
	await h.context.exports.initializeEditorMathJax(h.context, h.parent);
	assert.equal(h.context.MathJax, undefined);
	assert.equal(h.added.length, 0);
	assert.equal(h.warnings.length, 0);
});

test('a failed script is cleaned up and does not reject reader initialization', async () => {
	const h = harness();
	const initialized = h.context.exports.initializeEditorMathJax(h.context, h.parent);
	await tick();
	h.added[0].emit('error');
	await initialized;
	assert.equal(h.context.MathJax, undefined);
	assert.equal(h.added[0].removed, true);
	assert.equal(h.added[0].listeners.size, 0);
	assert.equal(h.timers.size, 0);
	assert.equal(h.warnings.length, 1);
});

test('a stalled script does not wait forever', async () => {
	const h = harness();
	const initialized = h.context.exports.initializeEditorMathJax(h.context, h.parent);
	await tick();
	for (const timeout of [...h.timers.values()]) timeout();
	await initialized;
	assert.equal(h.context.MathJax, undefined);
	assert.equal(h.added[0].removed, true);
	assert.equal(h.timers.size, 0);
});

test('a rejected MathJax startup does not reject reader initialization', async () => {
	const h = harness();
	const initialized = h.context.exports.initializeEditorMathJax(h.context, h.parent);
	await tick();
	h.context.MathJax = { startup: { promise: Promise.reject(new Error('font load failed')) } };
	h.added[0].emit('load');
	await initialized;
	assert.equal(h.context.MathJax, undefined);
	assert.equal(h.warnings.length, 1);
});

test('the reader entrypoint loads bundled math before editor math and waits before connecting', async () => {
	const h = harness();
	const events = [];
	let ready;
	const startup = new Promise(resolve => { ready = resolve; });
	const entrypoint = babel.transformSync(fs.readFileSync(path.join(root, 'src/index.obsidian.js'), 'utf8'), {
		configFile: false, babelrc: false,
		presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
	}).code;
	h.context.require = name => {
		if (name === './index.obsidian.reader.js') {
			assert.equal(h.context.MathJax, undefined);
			events.push('bundled reader');
			return class ReaderAdapter {};
		}
		if (name === './obsidian-mathjax.js') {
			return { initializeEditorMathJax() { events.push('editor math'); return startup; } };
		}
		if (name === 'penpal') {
			return {
				WindowMessenger: class WindowMessenger {},
				connect() { events.push('connect'); return { promise: new Promise(() => {}) }; },
			};
		}
		return {};
	};
	vm.runInContext(entrypoint, h.context);
	assert.deepEqual(events, ['bundled reader', 'editor math']);
	ready();
	await tick();
	assert.deepEqual(events, ['bundled reader', 'editor math', 'connect']);
});
