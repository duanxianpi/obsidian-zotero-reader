import Reader from "./common/reader";
import { WindowMessenger, connect } from "penpal";

/**
 * Create an empty reader instance (without container or data)
 * @returns {Object} Empty reader instance with initialize method
 */
async function createReader(options = {}) {
	// Generate unique instance ID
	const instanceId = `reader_${Date.now()}_${Math.random()
		.toString(36)
		.substring(2, 9)}`;

	const defaultOptions = {
		readOnly: false,
		// rtl: true,
		annotations: [],
		primaryViewState: {},
		sidebarWidth: 240,
		bottomPlaceholderHeight: null,
		toolbarPlaceholderWidth: 0,
		authorName: "Peter",
		showAnnotations: true,
		// platform: 'web',
		// password: 'test',
		onOpenContextMenu(params) {
			reader.openContextMenu(params);
		},
		onAddToNote() {
			alert("Add annotations to the current note");
		},
		onSaveAnnotations: async function (annotations) {
			console.log("Save annotations", annotations);
		},
		onDeleteAnnotations: function (ids) {
			console.log("Delete annotations", JSON.stringify(ids));
		},
		onChangeViewState: function (state, primary) {
			console.log("Set state", state, primary);
		},
		onOpenTagsPopup(annotationID, left, top) {
			alert(
				`Opening Zotero tagbox popup for id: ${annotationID}, left: ${left}, top: ${top}`
			);
		},
		onClosePopup(data) {
			console.log("onClosePopup", data);
		},
		onOpenLink(url) {
			alert("Navigating to an external link: " + url);
		},
		onToggleSidebar: (open) => {
			console.log("Sidebar toggled", open);
		},
		onChangeSidebarWidth(width) {
			console.log("Sidebar width changed", width);
		},
		onSetDataTransferAnnotations(dataTransfer, annotations, fromText) {
			console.log(
				"Set formatted dataTransfer annotations",
				dataTransfer,
				annotations,
				fromText
			);
		},
		onConfirm(title, text, confirmationButtonTitle) {
			return window.confirm(text);
		},
		onRotatePages(pageIndexes, degrees) {
			console.log("Rotating pages", pageIndexes, degrees);
		},
		onDeletePages(pageIndexes, degrees) {
			console.log("Deleting pages", pageIndexes, degrees);
		},
		onToggleContextPane() {
			console.log("Toggle context pane");
		},
		onTextSelectionAnnotationModeChange(mode) {
			console.log(`Change text selection annotation mode to '${mode}'`);
		},
		onSaveCustomThemes(customThemes) {
			console.log("Save custom themes", customThemes);
		},
	};

	const config = { ...defaultOptions, ...options };

	// Validate required options
	if (!config.data || !config.data.buf || !config.type) {
		throw new Error(
			"Reader data is required (data.buf and data.type must be provided in options)"
		);
	}

	const reader = new Reader(config);
	reader.enableAddToNote(true);
	await reader.initializedPromise;

	// Sync the theme with obsidian

	document.body.classList.add(`obsidian-theme-${options.theme}`);
	document.documentElement.setAttribute("data-color-scheme", options.theme);

	// Let the inner iframe sync theme with obsidian as well
	reader._primaryView._iframeWindow.addObsidianStyleVars(
		window.obsidianStyles
	);
	reader._primaryView._iframeWindow.document.body.classList.add(
		`obsidian-theme-${options.theme}`
	);
	reader._primaryView._iframeWindow.document.documentElement.setAttribute(
		"data-color-scheme",
		options.theme
	);
	window._reader = reader;
	console.debug(
		`Reader instance with ID ${instanceId} initialized successfully`
	);

	return reader;
}

// // Initialize Penpal connection with parent window
// let parentConnection = null;
// let readerInstance = null;

// async function initializePenpalConnection() {
// 	try {
// 		parentConnection = Penpal.connectToParent({
// 			// Methods exposed to the parent (view.ts)
// 			methods: {
// 				// Initialize reader with data from parent
// 				async initializeReader(data, type, filename) {
// 					console.log('Initializing reader with data from parent', { type, filename });

// 					const options = {
// 						data: { buf: data, type },
// 						type,
// 						filename,
// 						onSaveAnnotations: async function (annotations) {
// 							console.log("Save annotations", annotations);
// 							// Send annotations to parent
// 							if (parentConnection) {
// 								await parentConnection.call('onAnnotationsSaved', annotations);
// 							}
// 						},
// 						onDeleteAnnotations: function (ids) {
// 							console.log("Delete annotations", JSON.stringify(ids));
// 							// Send deleted annotation IDs to parent
// 							if (parentConnection) {
// 								parentConnection.call('onAnnotationsDeleted', ids);
// 							}
// 						},
// 						onChangeViewState: function (state, primary) {
// 							console.log("Set state", state, primary);
// 							// Send view state changes to parent
// 							if (parentConnection) {
// 								parentConnection.call('onViewStateChanged', state, primary);
// 							}
// 						},
// 						onAddToNote() {
// 							// Request parent to add annotations to note
// 							if (parentConnection) {
// 								parentConnection.call('onAddToNote');
// 							}
// 						},
// 					};

// 					readerInstance = await createReader(options);
// 					return { success: true, instanceId };
// 				},

// 				// Get current reader state
// 				getReaderState() {
// 					if (readerInstance) {
// 						return {
// 							annotations: readerInstance.getAnnotations ? readerInstance.getAnnotations() : [],
// 							viewState: readerInstance.getViewState ? readerInstance.getViewState() : null,
// 						};
// 					}
// 					return null;
// 				},

// 				// Update annotations from parent
// 				updateAnnotations(annotations) {
// 					if (readerInstance && readerInstance.setAnnotations) {
// 						readerInstance.setAnnotations(annotations);
// 						return { success: true };
// 					}
// 					return { success: false, error: 'Reader not initialized' };
// 				},

// 				// Navigate to specific page/location
// 				navigateTo(location) {
// 					if (readerInstance && readerInstance.navigate) {
// 						readerInstance.navigate(location);
// 						return { success: true };
// 					}
// 					return { success: false, error: 'Reader not initialized' };
// 				},

// 				// Get reader capabilities
// 				getCapabilities() {
// 					return {
// 						canAnnotate: true,
// 						canNavigate: true,
// 						canExportAnnotations: true,
// 						supportedFormats: ['pdf', 'epub']
// 					};
// 				}
// 			}
// 		});

// 		console.log('Penpal connection established with parent');

// 		// Notify parent that reader is ready
// 		await parentConnection.call('onReaderReady');

// 	} catch (error) {
// 		console.error('Failed to establish Penpal connection:', error);
// 	}
// }

try {
	const messenger = new WindowMessenger({
		remoteWindow: window.parent,
		// Defaults to the current origin.
		allowedOrigins: ["app://obsidian.md"],
	});

	const connection = connect({
		messenger,
		// Methods the iframe window is exposing to the parent window.
		methods: {
			init(BLOB_URL_MAP, obsidianStyles) {
				// Initialize the third party blob URLs
				window.BLOB_URL_MAP = BLOB_URL_MAP;

				// Sync Obsidian styles
				window.obsidianStyles = obsidianStyles;
				const newStylesheet = new CSSStyleSheet();

				for (const [selector, styles] of Object.entries(
					obsidianStyles
				)) {
					newStylesheet.insertRule(
						`${selector} { ${Object.entries(styles)
							.map(([key, value]) => `${key}: ${value};`)
							.join(" ")} }`
					);
				}
				document.adoptedStyleSheets.push(newStylesheet);

				return true;
			},
			async createReader(options) {
				createReader(options);
			},
			toggleTheme(originalTheme, newTheme) {
				document.body.classList.remove(
					`obsidian-theme-${originalTheme}`
				);
				document.body.classList.add(`obsidian-theme-${newTheme}`);
				document.documentElement.setAttribute(
					"data-color-scheme",
					newTheme
				);

				window._reader._primaryView._iframeWindow.document.body.classList.remove(
					`obsidian-theme-${originalTheme}`
				);
				window._reader._primaryView._iframeWindow.document.body.classList.add(
					`obsidian-theme-${newTheme}`
				);
				window._reader._primaryView._iframeWindow.document.documentElement.setAttribute(
					"data-color-scheme",
					newTheme
				);
			},
		},
	});

	console.log("Penpal connection established with parent window");
} catch (error) {
	console.error("Failed to establish Penpal connection:", error);
}
// const remote = await connection.promise;
// // Calling a remote method will always return a promise.
// const additionResult = await remote.add(2, 6);
// console.log(additionResult); // 8
