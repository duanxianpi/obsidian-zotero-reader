// Obsidian's editor renders math in the host window, but its output needs the
// matching CHTML stylesheet and fonts inside the reader iframe as well.
// Initialize this only AFTER the reader's imports have run: MathJax 3's
// AllPackages module otherwise calls preLoad on the editor's MathJax 4 loader.

function copyConfig(value) {
	if (Array.isArray(value)) return value.map(copyConfig);
	if (Object.prototype.toString.call(value) === "[object Object]") {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyConfig(item)]));
	}
	return value;
}

function waitForScript(script) {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			clearTimeout(timeout);
			script.removeEventListener("load", onLoad);
			script.removeEventListener("error", onError);
		};
		const onLoad = () => {
			cleanup();
			resolve();
		};
		const onError = () => {
			cleanup();
			reject(new Error("Editor MathJax script failed to load"));
		};
		const timeout = setTimeout(onError, 5000);
		script.addEventListener("load", onLoad);
		script.addEventListener("error", onError);
	});
}

export async function initializeEditorMathJax(readerWindow, parentWindow) {
	let script;
	try {
		// Use the script Obsidian actually loaded, including its app:// URL.
		// 1.14.1 changed this from tex-chtml-full.js to obsidian-mathjax.js.
		const hostScript = Array.from(parentWindow.document.scripts).find(element => (
			/\/lib\/mathjax\/(?:tex-chtml-full|obsidian-mathjax)\.js(?:[?#]|$)/.test(element.src)
		));
		// Obsidian 1.14.0 uses Temml and may have no MathJax script at all.
		if (!hostScript) return;

		// ZotFlow warms up host math in the background. It may still be loading
		// when this iframe starts; don't mistake its configuration for the engine.
		if (!parentWindow.MathJax?.startup?.promise) await waitForScript(hostScript);
		await parentWindow.MathJax.startup.promise;
		const config = parentWindow.MathJax.config;
		readerWindow.MathJax = {
			loader: { paths: copyConfig(config.loader?.paths || {}) },
			tex: copyConfig(config.tex || {}),
			output: copyConfig(config.output || {}),
			chtml: { ...copyConfig(config.chtml || {}), adaptiveCSS: false },
			options: copyConfig(config.options || {}),
			// Do not run host startup callbacks against the iframe or scan the
			// reader content. Obsidian handles the editor's actual typesetting.
			startup: { typeset: false },
		};
		script = readerWindow.document.createElement("script");
		script.src = hostScript.src;
		const loaded = waitForScript(script);
		readerWindow.document.head.appendChild(script);
		await loaded;
		await readerWindow.MathJax.startup.promise;
		readerWindow.document.head.appendChild(readerWindow.MathJax.chtmlStylesheet());
	}
	catch (error) {
		// A math resource failure must not prevent the PDF reader handshake.
		script?.remove();
		delete readerWindow.MathJax;
		console.warn("[ZotFlow MathJax] Could not initialize editor math", error);
	}
}
