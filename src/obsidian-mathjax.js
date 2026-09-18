// Obsidian's editor renders math in the host window, but its output needs the
// matching CHTML stylesheet and fonts inside the reader iframe as well.
// Initialize this only AFTER the reader's imports have run: MathJax 3's
// AllPackages module otherwise calls preLoad on the editor's MathJax 4 loader.

function copyStringMap(value) {
	if (!value || typeof value !== "object") return {};
	return Object.fromEntries(
		Object.entries(value).filter(([, item]) => typeof item === "string")
	);
}

function copyTypedFields(value, fields) {
	if (!value || typeof value !== "object") return {};
	return Object.fromEntries(
		fields
			.filter(([key, type]) => typeof value[key] === type)
			.map(([key]) => [key, value[key]])
	);
}

function getMajorVersion(mathJax) {
	const match = /^(\d+)(?:\.|$)/.exec(mathJax?.version || "");
	return match ? Number(match[1]) : null;
}

function createMathJaxConfig(mathJax) {
	const majorVersion = getMajorVersion(mathJax);
	if (majorVersion !== 3 && majorVersion !== 4) {
		throw new Error(`Unsupported editor MathJax version: ${mathJax?.version || "unknown"}`);
	}

	// MathJax mutates its config during startup. In v3, for example,
	// chtml.font becomes a TeXFont instance whose prototype cannot cross into
	// the iframe. Copy only the primitive fields the new runtime needs.
	const hostConfig = mathJax.config || {};
	const iframeConfig = {
		loader: { paths: copyStringMap(hostConfig.loader?.paths) },
		chtml: {
			...copyTypedFields(hostConfig.chtml, [
				["fontURL", "string"],
				["matchFontHeight", "boolean"],
			]),
			adaptiveCSS: false,
		},
		options: { enableMenu: false },
		// Do not run host startup callbacks against the iframe or scan the
		// reader content. Obsidian handles the editor's actual typesetting.
		startup: { typeset: false },
	};

	if (majorVersion === 4) {
		iframeConfig.output = copyTypedFields(hostConfig.output, [
			["font", "string"],
			["fontPath", "string"],
		]);
		Object.assign(
			iframeConfig.chtml,
			copyTypedFields(hostConfig.chtml, [["dynamicPrefix", "string"]])
		);
	}

	return iframeConfig;
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
		readerWindow.MathJax = createMathJaxConfig(parentWindow.MathJax);
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
