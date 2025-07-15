import Reader from "./common/reader";
import "./common/stylesheets/main.scss";

/**
 * ObsidianZoteroReaderFactory Factory - Creates and manages reader instances for Obsidian plugin
 */
class ObsidianZoteroReaderFactory {
	constructor() {
		this.instances = new Map(); // Track multiple reader instances
	}

	/**
	 * Create an empty reader instance (without container or data)
	 * @returns {Object} Empty reader instance with initialize method
	 */
	createReader() {
		// Generate unique instance ID
		const instanceId = `reader_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 9)}`;

		let reader = null;
		let container = null;
		let config = null;
		let initialized = false;

		// Create empty instance
		const instance = {
			// Initialize the reader with container, data, and options
			initialize: async (container, options = {}) => {
				container = container;

				if (initialized) {
					console.warn(
						`Reader instance ${instanceId} is already initialized`
					);
					return instance;
				}

				// Merge default options with provided options
				const defaultOptions = {
					type: "pdf",
					readOnly: false,
					sidebarWidth: 240,
					bottomPlaceholderHeight: null,
					toolbarPlaceholderWidth: 0,
					authorName: "User",
					showAnnotations: false,
					annotations: [],
					primaryViewState: {},
					container: container,
					// Default callbacks that can be overridden
					onOpenContextMenu: (params) => {},
					onAddToNote: () => {},
					onSaveAnnotations: async (annotations) => {
						console.log("Save annotations", annotations);
					},
					onDeleteAnnotations: (ids) => {
						console.log("Delete annotations", JSON.stringify(ids));
					},
					onChangeViewState: (state, primary) => {
						console.log("Set state", state, primary);
					},
					onOpenTagsPopup: (annotationID, left, top) => {
						console.log(
							`Opening tags popup for id: ${annotationID}, left: ${left}, top: ${top}`
						);
					},
					onClosePopup: (data) => {
						console.log("onClosePopup", data);
					},
					onOpenLink: (url) => {
						console.log("Opening external link:", url);
					},
					onToggleSidebar: (open) => {
						console.log("Sidebar toggled", open);
					},
					onChangeSidebarWidth: (width) => {
						console.log("Sidebar width changed", width);
					},
					onSetDataTransferAnnotations: (
						dataTransfer,
						annotations,
						fromText
					) => {
						console.log(
							"Set formatted dataTransfer annotations",
							dataTransfer,
							annotations,
							fromText
						);
					},
					onConfirm: (title, text, confirmationButtonTitle) => {
						return window.confirm(text);
					},
					onRotatePages: (pageIndexes, degrees) => {
						console.log("Rotating pages", pageIndexes, degrees);
					},
					onDeletePages: (pageIndexes, degrees) => {
						console.log("Deleting pages", pageIndexes, degrees);
					},
					onToggleContextPane: () => {
						console.log("Toggle context pane");
					},
					onTextSelectionAnnotationModeChange: (mode) => {
						console.log(
							`Change text selection annotation mode to '${mode}'`
						);
					},
					onSaveCustomThemes: (customThemes) => {
						console.log("Save custom themes", customThemes);
					},
				};

				config = { ...defaultOptions, ...options };

				// Validate required options
				if (!config.data || !config.data.buf) {
					throw new Error(
						"Reader data is required (data.buf must be provided in options)"
					);
				}

				console.log("Creating reader instance", config);
				// Create the reader instance
				reader = new Reader({
					...config,
					// Ensure the reader's context menu handler can access the reader instance
					onOpenContextMenu: (params) => {
						reader.openContextMenu(params);
						if (config.onOpenContextMenu) {
							config.onOpenContextMenu(params);
						}
					},
				});

				console.log("Reader instance created", reader);

				// Enable add to note functionality
				reader.enableAddToNote(true);

				// Wait for reader initialization
				await reader.initializedPromise;

				// Update initialized state
				initialized = true;

				return instance;
			},

			// Lifecycle methods
			destroy: () => {
				if (reader && typeof reader.destroy === "function") {
					reader.destroy();
				}
				// Clean up container
				if (container && container.parentNode) {
					container.innerHTML = "";
				}
				// Remove from instances map
				this.instances.delete(instanceId);
				initialized = false;
				reader = null;
				container = null;
				config = null;
			},

			// Utility methods
			getReader: () => reader,
			getContainer: () => container,
			getId: () => instanceId,
			isInitialized: () => initialized,

			// Reader API proxies (with initialization checks)
			focus: () => reader?.focus && reader.focus(),
			unfocus: () => reader?.unfocus && reader.unfocus(),
			navigateToAnnotation: (annotation) =>
				reader?.navigateToAnnotation &&
				reader.navigateToAnnotation(annotation),
			setFilter: (filter) =>
				reader?.setFilter && reader.setFilter(filter),
			enableAddToNote: (enable) =>
				reader?.enableAddToNote && reader.enableAddToNote(enable),
		};

		// Store instance
		this.instances.set(instanceId, instance);

		return instance;
	}

	/**
	 * Get all active reader instances
	 */
	getAllInstances() {
		return Array.from(this.instances.values());
	}

	/**
	 * Get a specific reader instance by ID
	 */
	getInstance(id) {
		return this.instances.get(id);
	}

	/**
	 * Destroy all reader instances
	 */
	destroyAll() {
		this.instances.forEach((instance) => instance.destroy());
		this.instances.clear();
	}

	/**
	 * Get the count of active instances
	 */
	getInstanceCount() {
		return this.instances.size;
	}
}

export default ObsidianZoteroReaderFactory;
