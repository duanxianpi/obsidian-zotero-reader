import Reader from "./common/reader";

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
	window._reader = reader;
	console.debug(
		`Reader instance with ID ${instanceId} initialized successfully`
	);
}
