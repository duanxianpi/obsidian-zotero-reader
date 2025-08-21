import { WindowMessenger, connect } from "penpal";
import ReaderAdapter from "./index.obsidian.reader.js";
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
			async initReader(opts) {
				await adapter.createReader(opts);
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
