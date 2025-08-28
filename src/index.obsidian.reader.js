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
			sidebarOpen: false,
			toolbarPlaceholderWidth: 0,
			showAnnotations: true,
			customThemes: [this.generateObsidianTheme()],
			lightTheme: "obsidian",
			darkTheme: "obsidian",
			onOpenContextMenu: (params) => {
				this.reader.openContextMenu(params);
			},
			onAddToNote: () => {
				this.emit({ type: "addToNote" });
			},
			onSaveAnnotations: (annotations) => {
				console.log("Save annotations", annotations);
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
				console.log("Custom themes saved:", customThemes);
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
		window._reader = this.reader;

		// adopt obsidian styles
		this.adoptObsidianStyles(
			window.OBSIDIAN_THEME_VARIABLES,
			this.reader._primaryView._iframeWindow.document
		);
		this.applyColorScheme(opts.colorScheme);
		this.reader._primaryViewContainer.style.opacity = "1";

		this.emit({ type: "ready" });
	}

	applyColorScheme(colorScheme) {
		document.documentElement.classList.toggle(
			"obsidian-theme-dark",
			colorScheme === "dark"
		);
		document.documentElement.classList.toggle(
			"obsidian-theme-light",
			colorScheme === "light"
		);

		const newCustomThemes = this.reader._state.customThemes?.map(
			(theme) => {
				if (theme.id === "obsidian") {
					return this.generateObsidianTheme();
				}
				return theme;
			}
		);

		this.reader.setCustomThemes(newCustomThemes);

		// Ask the Reader instance to update theme if API exists; otherwise set vars into its iframe safely.
		const win = this.reader?._primaryView?._iframeWindow;
		if (win?.document?.documentElement) {
			win.document.documentElement.classList.toggle(
				"obsidian-theme-dark",
				colorScheme === "dark"
			);
			win.document.documentElement.classList.toggle(
				"obsidian-theme-light",
				colorScheme === "light"
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

	generateObsidianTheme() {
		const expandShortHex = (hex) => {
			// Convert #abc to #aabbcc
			return hex.replace(
				/^#([a-f\d])([a-f\d])([a-f\d])$/i,
				(m, r, g, b) => "#" + r + r + g + g + b + b
			);
		};

		const convertAnyColorToHex = (color) => {
			// Already hex
			if (color.startsWith("#")) {
				return color.length === 4 ? expandShortHex(color) : color;
			}

			// Named colors, rgb(), rgba(), hsl(), etc.
			const canvas = document.createElement("canvas");
			canvas.width = canvas.height = 1;
			const ctx = canvas.getContext("2d");

			ctx.fillStyle = color;
			ctx.fillRect(0, 0, 1, 1);

			const imageData = ctx.getImageData(0, 0, 1, 1).data;
			const r = imageData[0];
			const g = imageData[1];
			const b = imageData[2];

			return (
				"#" +
				((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
			);
		};

		const computedStyle = getComputedStyle(document.documentElement);
		const background = computedStyle.getPropertyValue(
			"--background-primary"
		);
		const foreground = computedStyle.getPropertyValue("--text-normal");

		return {
			background: convertAnyColorToHex(background),
			foreground: convertAnyColorToHex(foreground),
			id: "obsidian",
			label: "Obsidian",
		};
	}

	async dispose() {
		this.reader = undefined;
	}
}
