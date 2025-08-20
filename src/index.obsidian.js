import { WindowMessenger, connect } from "penpal";
import Reader from "./common/reader";

/**
 * -----------------------------------------------------------
 * Adapter for the reader
 * -----------------------------------------------------------
 */

class ReaderAdapter {
	reader;
	listeners = new Set();

	on(cb) {
		this.listeners.add(cb);
		return () => this.listeners.delete(cb);
	}
	emit(e) {
		this.listeners.forEach((l) => l(e));
	}

	async create(opts) {
		const defaults = {
			readOnly: false,
			annotations: [],
			primaryViewState: {},
			sidebarWidth: 240,
			toolbarPlaceholderWidth: 0,
			showAnnotations: true,
			onOpenContextMenu: (params) => {
				this.reader.openContextMenu(params);
			},
			onAddToNote: () => {
				this.emit({ type: "addToNote" });
			},
			onSaveAnnotations: (annotations) => {
				this.emit({ type: "annotationsSaved", annotations });
			},
			onDeleteAnnotations: (ids) => {
				this.emit({ type: "annotationsDeleted", ids });
			},
			onChangeViewState: (state, primary) => {
				this.emit({ type: "viewStateChanged", state, primary });
			},
			onOpenTagsPopup: (annotationID, left, top) => {
				this.emit({ type: "openTagsPopup", annotationID, left, top });
			},
			onClosePopup: (data) => {
				this.emit({ type: "closePopup", data });
			},
			onOpenLink: (url) => {
				this.emit({ type: "openLink", url });
			},
			onToggleSidebar: (open) => {
				this.emit({ type: "sidebarToggled", open });
			},
			onChangeSidebarWidth: (width) => {
				this.emit({ type: "sidebarWidthChanged", width });
			},
			onSetDataTransferAnnotations: (
				dataTransfer,
				annotations,
				fromText
			) => {
				this.emit({
					type: "setDataTransferAnnotations",
					dataTransfer,
					annotations,
					fromText,
				});
			},
			onConfirm: (title, text, confirmationButtonTitle) => {
				this.emit({
					type: "confirm",
					title,
					text,
					confirmationButtonTitle,
				});
			},
			onRotatePages: (pageIndexes, degrees) => {
				this.emit({ type: "rotatePages", pageIndexes, degrees });
			},
			onDeletePages: (pageIndexes, degrees) => {
				this.emit({ type: "deletePages", pageIndexes, degrees });
			},
			onToggleContextPane: () => {
				this.emit({ type: "toggleContextPane" });
			},
			onTextSelectionAnnotationModeChange: (mode) => {
				this.emit({ type: "textSelectionAnnotationModeChanged", mode });
			},
			onSaveCustomThemes: (customThemes) => {
				this.emit({ type: "saveCustomThemes", customThemes });
			},
		};

		// Build data argument from Source
		const config = { ...defaults, ...opts };
		if (
			!config.data ||
			!(config.data.buf || config.data.url) ||
			!config.type
		) {
			throw new Error(
				"Reader data is required (one of data.buf and data.url, and data.type must be provided in options)"
			);
		}

		console.log("Reader config:", config);

		this.reader = new Reader(config);
		this.reader.enableAddToNote(true);
		await this.reader.initializedPromise;

		this.applyTheme(opts.obsidianTheme);
		this.emit({ type: "ready" });
	}

	applyTheme(theme) {
		document.body.classList.toggle("obsidian-theme-dark", theme === "dark");
		document.body.classList.toggle(
			"obsidian-theme-light",
			theme === "light"
		);
		document.documentElement.setAttribute("data-color-scheme", theme);

		// Ask the Reader instance to update theme if API exists; otherwise set vars into its iframe safely.
		const win = this.reader?._primaryView?._iframeWindow;
		if (win?.document?.documentElement) {
			win.document.documentElement.setAttribute(
				"data-color-scheme",
				theme
			);
			win.document.body.classList.toggle(
				"obsidian-theme-dark",
				theme === "dark"
			);
			win.document.body.classList.toggle(
				"obsidian-theme-light",
				theme === "light"
			);
		}
	}

	adoptObsidianStyles(obsidianThemeVariables) {
		try {
			const sheet = new CSSStyleSheet();
			for (const [sel, map] of Object.entries(obsidianThemeVariables)) {
				const rules = Object.entries(map)
					.map(([k, v]) => `${k}: ${v};`)
					.join(" ");
				sheet.insertRule(`${sel} { ${rules} }`);
			}
			document.adoptedStyleSheets.push(sheet);
		} catch {
			// Fallback for browsers without adoptedStyleSheets
			const style = document.createElement("style");
			style.textContent = Object.entries(obsidianThemeVariables)
				.map(
					([sel, map]) =>
						`${sel}{${Object.entries(map)
							.map(([k, v]) => `${k}:${v};`)
							.join("")}}`
				)
				.join("");
			document.head.appendChild(style);
		}
	}

	async dispose() {
		try {
			await this.reader?.destroy?.();
		} catch {}
		this.reader = undefined;
	}
}

/**
 * -----------------------------------------------------------
 * Penpal bridge with the obsidian
 * -----------------------------------------------------------
 */

const adapter = new ReaderAdapter();

(async function bootstrap() {
	const messenger = new WindowMessenger({
		remoteWindow: window.parent,
		allowedOrigins: ["app://obsidian.md"],
	});

	const connection = connect({
		messenger,
		methods: {
			async init(payload) {
				window.BLOB_URL_MAP = payload.blobUrlMap;
				window.OBSIDIAN_THEME_VARIABLES =
					payload.obsidianThemeVariables;
				adapter.adoptObsidianStyles(payload.obsidianThemeVariables);
				adapter.applyTheme(payload.theme);
				return { ok: true };
			},
			async createReader(opts) {
				console.log("Creating reader with opts:", opts);
				await adapter.create(opts);
				return { ok: true };
			},
			async setTheme(theme) {
				adapter.applyTheme(theme);
				return { ok: true };
			},
			async dispose() {
				await adapter.dispose();
				return { ok: true };
			},
		},
	});

	// Event pipe child → parent
	const parent = await connection.promise;
	adapter.on((evt) => parent.handleEvent(evt));
})();
