import Reader from "./common/reader";

/**
 * -----------------------------------------------------------
 * Adapter for the reader
 * -----------------------------------------------------------
 */

export default class ReaderAdapter {
	reader;
	listeners = new Set();

	on(cb) {
		this.listeners.add(cb);
		return () => this.listeners.delete(cb);
	}
	emit(e) {
		this.listeners.forEach((l) => l(e));
	}

	async createReader(opts) {
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

		this.reader = new Reader(config);
		this.reader.enableAddToNote(true);
		
		await this.reader.initializedPromise;

		// adopt obsidian styles
		this.adoptObsidianStyles(
			window.OBSIDIAN_THEME_VARIABLES,
			this.reader._primaryView._iframeWindow.document
		);
		this.applyTheme(opts.obsidianTheme);
		this.reader._primaryViewContainer.style.opacity = "1";

		this.emit({ type: "ready" });
	}

	applyTheme(theme) {
		console.log("Applying theme:", theme);
		document.documentElement.classList.toggle(
			"obsidian-theme-dark",
			theme === "dark"
		);
		document.documentElement.classList.toggle(
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
			win.document.documentElement.classList.toggle(
				"obsidian-theme-dark",
				theme === "dark"
			);
			win.document.documentElement.classList.toggle(
				"obsidian-theme-light",
				theme === "light"
			);
		}
	}

	adoptObsidianStyles(obsidianThemeVariables, document) {
		const varsStyle = document.createElement("style");
		varsStyle.textContent = Object.entries(obsidianThemeVariables)
			.map(
				([sel, map]) =>
					`${sel}{${Object.entries(map)
						.map(([k, v]) => `${k}:${v};`)
						.join("")}}`
			)
			.join("");

		const scrollbarStyle = document.createElement("style");
		scrollbarStyle.textContent = `
				::-webkit-scrollbar {
					background-color: var(--scrollbar-bg);
					width: var(--scrollbar-width);
					height: var(--scrollbar-height);
					-webkit-border-radius: var(--scrollbar-radius);
					background-color: transparent;
				}

				::-webkit-scrollbar-track {
					background-color: transparent;
				}

				::-webkit-scrollbar-thumb {
					background-color: var(--scrollbar-thumb-bg);
					-webkit-border-radius: var(--scrollbar-radius);
					background-clip: padding-box;
					border: 2px solid transparent;
					border-width: var(--scrollbar-border-width);
					min-height: 45px;
				}

				::-webkit-scrollbar-thumb:active {
					-webkit-border-radius: var(--scrollbar-radius);
				}

				::-webkit-scrollbar-thumb:hover,
				::-webkit-scrollbar-thumb:active {
					background-color: var(--scrollbar-active-thumb-bg);
				}

				::-webkit-scrollbar-corner {
					background: transparent;
				}
				@supports not selector(::-webkit-scrollbar) {
					:root {
						scrollbar-width: thin;
						scrollbar-color: var(--scrollbar-thumb-bg) var(--scrollbar-bg);
					}
				}`;

		document.head.prepend(scrollbarStyle);
		document.head.prepend(varsStyle);
	}

	async dispose() {
		try {
			await this.reader?.destroy?.();
		} catch {}
		this.reader = undefined;
	}
}
