/**
 * Webpack loader that inlines the TeX web-font URLs used by MathJax 3
 * (mathjax-full) as base64 data-URIs.
 *
 * Matches:  url("%%URL%%/<FontName>.woff") format("woff")
 * Replaces: url("data:font/woff;base64,<BASE64>") format("woff")
 *
 * Works for every *.woff file present in
 *   mathjax-full/ts/output/chtml/fonts/tex-woff-v2/
 */
const fs = require("fs");
const path = require("path");

module.exports = function (source) {
	this.cacheable?.(); // let webpack cache the result

	const pattern =
		/url\("%%URL%%\/([A-Za-z0-9_-]+\.woff[0-9]?)"\)\s*format\("woff[0-9]?"\)/g;

	return source.replace(pattern, (_, fontFile) => {
		// Resolve the real font path once; throws if the font is missing
		const fontPath = require.resolve(
			`mathjax-full/ts/output/chtml/fonts/tex-woff-v2/${fontFile}`
		);

		const fontBuffer = fs.readFileSync(fontPath);
		const base64 = fontBuffer.toString("base64");
		const mime =
			fontBuffer.subarray(0, 4).toString() === "wOF2"
				? "font/woff2"
				: "font/woff";

		return `url("data:${mime};base64,${base64}") format("${
			mime.endsWith("2") ? "woff2" : "woff"
		}")`;
	});
};
