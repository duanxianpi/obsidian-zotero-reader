const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

function load(file, requireModule = () => ({})) {
	const code = babel.transformSync(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), {
		configFile: false, babelrc: false,
		presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-react'],
	}).code;
	const context = { exports: {}, require: requireModule, console, structuredClone,
		setTimeout: (callback, ms) => ms === 0 ? setTimeout(callback, 0) : 1, clearTimeout: () => {}, window: { getComputedStyle: () => ({ getPropertyValue: () => '' }) }, document: { body: {} } };
	vm.runInNewContext(code, context);
	return context.exports;
}
const defines = load('common/defines.js');
const profiles = load('common/annotation-profiles.js', () => defines);
const Manager = load('common/annotation-manager.js', name => name === './defines' ? defines : {
	roundPositionValues: position => position,
	sortTags: tags => tags,
	basicDeepEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
	isSelector: () => false,
}).default;
const Reader = load('common/reader.js', name => name === './annotation-profiles' ? profiles : {
	...defines, createContext: () => ({}),
}).default;
const config = () => ({ autoTag: true, activeProfileId: 'research', profiles: [
	{ id: 'research', name: 'Research', palette: [{ id: 'a', color: '#ffd400', label: 'Methodology' }] },
	{ id: 'review', name: 'Review', palette: [{ id: 'b', color: '#ffd400', label: 'Evidence' }] },
] });
const plain = value => JSON.parse(JSON.stringify(value));
function manager(getConfig) {
	const saved = [];
	const m = new Manager({ annotations: [], readOnly: false, onRender: () => {}, onChangeFilter: () => {},
		onSave: annotations => { saved.push(...plain(annotations)); }, onDelete: () => {},
		onCreate: annotation => profiles.tagNewAnnotation(annotation, getConfig()),
	});
	m._lastSaveTime = Date.now();
	return { m, saved };
}
const annotation = (extra = {}) => ({ type: 'highlight', color: '#ffd400', sortIndex: '00001', position: { pageIndex: 0, rects: [[1, 2, 3, 4]] }, tags: [{ name: 'todo' }], ...extra });

test('tags are captured at creation before a profile switch and delayed save', async () => {
	let active = config();
	const { m, saved } = manager(() => active);
	const created = m.addAnnotation(annotation());
	active = { ...active, activeProfileId: 'review' };
	await m.flush();
	assert.deepEqual(saved[0].tags, [{ name: 'todo' }, { name: 'Methodology' }]);
	m.updateAnnotations([{ id: created.id, color: '#123456', comment: 'edited' }]);
	await m.flush();
	assert.deepEqual(saved.at(-1).tags, [{ name: 'todo' }, { name: 'Methodology' }]);
});

test('load, refresh, off/external/read-only and structural recreation do not tag', async () => {
	const { m } = manager(config);
	await m.setAnnotations([annotation({ id: 'EXISTING', tags: [] })]);
	assert.equal(m._annotations[0].tags.length, 0);
	const recreated = m.addAnnotation(annotation({ tags: [{ name: 'Old category' }] }), { applyCreationDefaults: false });
	assert.deepEqual(plain(recreated.tags), [{ name: 'Old category' }]);
	for (const extra of [{ isExternal: true }, { readOnly: true }]) {
		assert.equal(m.addAnnotation(annotation(extra)).tags.length, 1);
	}
	const disabled = manager(() => ({ ...config(), autoTag: false }));
	assert.equal(disabled.m.addAnnotation(annotation()).tags.length, 1);
	m.setReadOnly(true);
	assert.equal(m.addAnnotation(annotation()), null);
});

test('does not duplicate an existing category tag; undo/redo preserve creation meaning', () => {
	let active = config();
	const { m } = manager(() => active);
	const created = m.addAnnotation(annotation({ tags: [{ name: 'Methodology' }, { name: 'todo' }] }));
	assert.equal(created.tags.length, 2);
	active = { ...active, activeProfileId: 'review' };
	m.undo();
	m.redo();
	assert.deepEqual(plain(m._annotations[0].tags), [{ name: 'Methodology' }, { name: 'todo' }]);
});

function reader(input) {
	const r = Object.create(Reader.prototype);
	r._annotationProfileConfig = profiles.copyProfileConfig(input);
	r._getString = key => key;
	r._tools = { highlight: { type: 'highlight', color: '#ffd400' }, ink: { type: 'ink', color: '#000000' } };
	r._state = { tool: r._tools.highlight, annotations: [annotation({ color: '#abcdef' })] };
	r._updateState = state => Object.assign(r._state, state);
	r.setSelectedAnnotations = () => {};
	return r;
}

test('reader instances own palette state, settings updates never change existing annotations', () => {
	const input = config();
	const a = reader(input), b = reader(input);
	const original = plain(a._state.annotations);
	a.setAnnotationProfile('review');
	assert.equal(a.getAnnotationColors()[0][0], 'Evidence');
	assert.equal(b.getAnnotationColors()[0][0], 'Methodology');
	assert.equal(input.activeProfileId, 'research');
	const next = config();
	next.profiles[0].palette = [{ id: 'c', color: '#123456', label: 'Theory' }];
	a.setAnnotationProfileConfig(next);
	assert.equal(a._state.tool.color, '#123456');
	assert.equal(a._tools.ink.color, '#000000');
	a.setTool({ color: '#654321' });
	assert.equal(a._tools.highlight.color, '#654321');
	assert.deepEqual(plain(a._state.annotations), original);
});

test('unconfigured readers preserve palette, localized names, and extra black without duplicates', () => {
	const r = reader(null);
	assert.deepEqual(plain(r.getAnnotationColors().map(x => x.slice(0, 2))), plain(defines.ANNOTATION_COLORS));
	const input = config();
	input.profiles[0].palette.push({ id: 'black', color: '#000000', label: '' });
	r.setAnnotationProfileConfig(input);
	assert.equal(r.getAnnotationColors(true).filter(x => x[1] === '#000000').length, 1);
	assert.equal(r.getAnnotationColors()[0][2], 'Methodology (#ffd400)');
});


test('native profile selector keeps arrow and number keys instead of reader shortcuts', () => {
    const { KeyboardManager } = load('common/keyboard-manager.js');
    const { FocusManager } = load('common/focus-manager.js');
    for (const key of ['ArrowDown', 'ArrowUp', '1']) {
        const event = { key, target: { closest: () => ({}) }, preventDefault: () => assert.fail('native selection was prevented') };
        Object.create(KeyboardManager.prototype)._handleKeyDown(event);
        Object.create(FocusManager.prototype)._handleKeyDown(event);
    }
});
