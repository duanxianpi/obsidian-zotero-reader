const https = require("https");
const crypto = require("crypto");
const JSZip = require("jszip");
const Terser = require("terser");
const { Compilation, sources } = require("webpack");

const OUTPUT_DIRECTORY = "document-worker";
const BROWSER_RUNTIME_PREAMBLE = `
// Obsidian/Electron exposes a Node-like process object inside Web Workers,
// but Document Worker must use browser APIs such as OffscreenCanvas here.
const process = undefined;
`;
const CORE_RESOURCE_PATTERNS = [
	/^cmaps\/.+/,
	/^standard_fonts\/.+/,
	/^wasm\/(?:jbig2|openjpeg)\.wasm$/,
];

class DocumentWorkerPlugin {
	constructor(options) {
		this.commitHash = options.commitHash;
		this.archiveSha256 = options.archiveSha256;
		this.cachedAssets = null;
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap(
			"DocumentWorkerPlugin",
			(compilation) => {
				compilation.hooks.processAssets.tapPromise(
					{
						name: "DocumentWorkerPlugin",
						stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
					},
					async () => {
						try {
							if (!this.cachedAssets) {
								console.log(
									"[DocumentWorkerPlugin] Downloading core PDF assets..."
								);
								this.cachedAssets = await this.getWorkerAssets();
							}

							for (const [name, content] of this.cachedAssets) {
								compilation.emitAsset(name, new sources.RawSource(content));
							}
						} catch (error) {
							compilation.errors.push(
								new Error(`DocumentWorkerPlugin: ${error.message}`)
							);
						}
					}
				);
			}
		);
	}

	async getWorkerAssets() {
		const url = `https://zotero-download.s3.amazonaws.com/ci/document-worker/${this.commitHash}.zip`;
		const zipBuffer = await this.download(url);
		const actualSha256 = crypto
			.createHash("sha256")
			.update(zipBuffer)
			.digest("hex");
		if (actualSha256 !== this.archiveSha256) {
			throw new Error(
				`Archive SHA-256 mismatch: expected ${this.archiveSha256}, got ${actualSha256}`
			);
		}
		return this.extract(zipBuffer);
	}

	download(url) {
		return new Promise((resolve, reject) => {
			const options = {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
				},
			};

			https
				.get(url, options, (res) => {
					if (res.statusCode !== 200) {
						res.resume();
						reject(
							new Error(
								`Failed to download worker from ${url}: ${res.statusCode}`
							)
						);
						return;
					}

					const chunks = [];
					res.on("data", (chunk) => chunks.push(chunk));
					res.on("end", () => resolve(Buffer.concat(chunks)));
					res.on("error", reject);
				})
				.on("error", reject);
		});
	}

	async extract(buffer) {
		const zip = await JSZip.loadAsync(buffer);
		const workerFile = zip.file("worker.js");
		if (!workerFile) {
			throw new Error("worker.js not found in zip");
		}

		const workerSource =
			BROWSER_RUNTIME_PREAMBLE + (await workerFile.async("string"));
		const minified = await Terser.minify(workerSource);
		if (minified.error) {
			throw minified.error;
		}
		if (!minified.code) {
			throw new Error("worker.js minification produced no output");
		}

		const assets = new Map([
			[`${OUTPUT_DIRECTORY}/worker.js`, minified.code],
		]);
		const resourcePaths = Object.keys(zip.files)
			.filter((name) => {
				const entry = zip.files[name];
				return (
					entry &&
					!entry.dir &&
					CORE_RESOURCE_PATTERNS.some((pattern) => pattern.test(name))
				);
			})
			.sort();

		for (const resourcePath of resourcePaths) {
			const resource = zip.file(resourcePath);
			if (!resource) {
				throw new Error(`${resourcePath} not found in zip`);
			}
			assets.set(
				`${OUTPUT_DIRECTORY}/${resourcePath}`,
				await resource.async("nodebuffer")
			);
		}

		return assets;
	}
}

module.exports = DocumentWorkerPlugin;
