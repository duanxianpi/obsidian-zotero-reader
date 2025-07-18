class InlineHtmlAssetsPlugin {
	constructor(options = {}) {
		this.opt = {
			inlineCSS: true,
			inlineJS: true,
			leaveCSSFile: false,
			leaveJSFile: false,
			keepLinkTag: false,
			keepScriptTag: false,
			...options,
		};
	}

	static _escape(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	/** Extract all href/src values that end with .css or .js from current HTML */
	static _collect(html, ext) {
		const rx =
			ext === "css"
				? /<link\s[^>]*href=["']([^"']+\.css)["'][^>]*>/gi
				: /<script\s[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/gi;
		const out = [];
		let m;
		while ((m = rx.exec(html))) out.push(m[1]);
		return out;
	}

	apply(compiler) {
		const HtmlWebpackPlugin = require("html-webpack-plugin");

		compiler.hooks.thisCompilation.tap(
			"InlineHtmlAssetsPlugin",
			(compilation) => {
				HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(
					"InlineHtmlAssetsPlugin",
					(data, cb) => {
						const { assets } = compilation;

						/* ---------------- CSS ---------------- */
						if (this.opt.inlineCSS) {
							InlineHtmlAssetsPlugin._collect(
								data.html,
								"css"
							).forEach((name) => {
								if (!assets[name]) return; // safety
								let css = assets[name].source().toString();
								css = css.replace(
									/\s*@charset\s+["'][^"']+["'];?/i,
									""
								); // invalid inline
								data.html = data.html.replace(
									/<\/head>/i,
									(m) =>
										`<style id="inlined-${name.replace(
											/\W/g,
											"_"
										)}">\n${css}\n</style>\n${m}`
								);
								if (!this.opt.keepLinkTag) {
									const linkRx = new RegExp(
										`<link[^>]+href=["']${InlineHtmlAssetsPlugin._escape(
											name
										)}["'][^>]*>`,
										"gi"
									);
									data.html = data.html.replace(linkRx, "");
								}
								if (!this.opt.leaveCSSFile) delete assets[name];
							});
						}

						/* ---------------- JS ---------------- */
						if (this.opt.inlineJS) {
							InlineHtmlAssetsPlugin._collect(
								data.html,
								"js"
							).forEach((name) => {
								console.log(
									"============================================================",
									name
								);
								if (!assets[name]) return;
								const js = assets[name].source().toString();
								data.html = data.html.replace(
									/<\/body>/i,
									(m) =>
										`<script id="inlined-${name.replace(
											/\W/g,
											"_"
										)}">\n${js}\n</script>\n${m}`
								);
								if (!this.opt.keepScriptTag) {
									const scriptRx = new RegExp(
										`<script[^>]+src=["']${InlineHtmlAssetsPlugin._escape(
											name
										)}["'][^>]*></script>`,
										"gi"
									);
									data.html = data.html.replace(scriptRx, "");
								}
								if (!this.opt.leaveJSFile) delete assets[name];
							});
						}

						cb(null, data);
					}
				);
			}
		);
	}
}

module.exports = InlineHtmlAssetsPlugin;
