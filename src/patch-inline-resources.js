import inlineResources from "./inline-resources";
import * as cheerio from "cheerio";

/**
 * This function is used to patch the viewer.css file, since css cannot use blob URLs directly.
 * It will replace the original URLs with data URLs instead.
 */

export function patchViewerCSS() {
	const currentViewerCSSBase64 = inlineResources["web/viewer.css"].base64;
	const currentViewerCSS = atob(currentViewerCSSBase64);

	// For css, if it contains relative URLs, we need to adjust them
	const relativeUrlPattern =
		/url\(\s*(['"]?)(?![a-z][\w+.-]*:|\/\/)([^'")]+)\1\s*\)/g;
	const adjustedCss = currentViewerCSS.replace(
		relativeUrlPattern,
		(match, quote, url) => {
			// Get the base64 data from the inline resources
			const hit = Object.keys(globalThis.BLOB_URL_MAP).find((k) =>
				k.includes(url.match(/([^\/?#]+)(?:\?.*)?$/)[1])
			);
			if (hit) {
				const base64 = inlineResources[hit].base64;
				const mimeType = inlineResources[hit].type || "text/css";
				return `url("data:${mimeType};base64,${base64}")`;
			} else {
				console.warn(`No inline resource found for ${url}`);
				return match; // Return the original match if no resource found
			}
		}
	);

	const byteNumbers = Array.from(adjustedCss, (char) => char.charCodeAt(0));
	const byteArray = new Uint8Array(byteNumbers);
	const blob = new Blob([byteArray], {
		type: "text/css",
	});
	const url = URL.createObjectURL(blob);
	globalThis.BLOB_URL_MAP["web/viewer.css"] = url;
	console.info(`Patched CSS with data URL: ${url}, type: text/css`);
}

/** This function is used to patch the PDF viewer HTML file to use the blob URLs
 * for inline resources instead of the original URLs.
 * The following will be replaced in the viewer.html:
 * • fetch
 * • XMLHttpRequest
 * • Worker
 */
export function patchPDFViewerHTML() {
	const currentViewerHTMLBase64 = inlineResources["web/viewer.html"].base64;
	const currentViewerHTML = atob(currentViewerHTMLBase64);

	// viewer.html is UTF-8 BOM encoded, so we need to remove it
	const len = currentViewerHTML.length;
	let bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = currentViewerHTML.charCodeAt(i);
	}

	const BOM = [0xef, 0xbb, 0xbf];
	if (bytes[0] === BOM[0] && bytes[1] === BOM[1] && bytes[2] === BOM[2]) {
		bytes = bytes.slice(3);
	}
	const text = new TextDecoder("utf-8").decode(bytes);

	const $ = cheerio.load(text);

	// <link rel="stylesheet">
	$('link[rel="stylesheet"][href]').each((_, elem) => {
		const href = $(elem).attr("href");
		const hit = Object.keys(globalThis.BLOB_URL_MAP).find((k) =>
			k.includes(href.match(/([^\/?#]+)(?:\?.*)?$/)[1])
		);
		if (hit) {
			const url = globalThis.BLOB_URL_MAP[hit];
			$(elem).attr("href", url);
		} else {
			console.warn(`No blob URL found for ${href}`);
		}
	});

	// <script type="module" src="…">
	$('script[type="module"][src]').each((_, elem) => {
		const src = $(elem).attr("src");
		const hit = Object.keys(globalThis.BLOB_URL_MAP).find((k) =>
			k.includes(src.match(/([^\/?#]+)(?:\?.*)?$/)[1])
		);
		if (hit) {
			const url = globalThis.BLOB_URL_MAP[hit];
			$(elem).attr("src", url);
		} else {
			console.warn(`No blob URL found for ${src}`);
		}
	});

	// Monkey patch for fetch and XMLHttpRequest
	// Since the viewer.html will be loaded in iframe, patching the
	// fetch and XMLHttpRequest won't cause issues with the main app.
	$("head").prepend(`
<script type="module">

	/** Find matching resource key and return its blob URL */
	function getBlobUrlForRequest(requestedUrl) {
		const isRelative = (u) => !/^[a-zA-Z][a-zA-Z\\d+\\-.]*:/.test(u) && !u.startsWith("//");

		if (isRelative(requestedUrl)) {
			// For relative URLs, lookuping in the 
			return globalThis.BLOB_URL_MAP[requestedUrl] || 
				globalThis.BLOB_URL_MAP[Object.keys(globalThis.BLOB_URL_MAP).find(key => 
					key.includes(requestedUrl.match(/([^\\/?#]+)(?:\\?.*)?$/)[1])
				)];
		}
	}

	// ---------- patched fetch ----------
	const realFetch = window.fetch.bind(window);

	window.fetch = async function patchedFetch(input, init) {
	const url = typeof input === "string" ? input
		: input instanceof Request ? input.url
		: input instanceof URL ? input.toString()
		: "";

	const blobUrl = getBlobUrlForRequest(url);
	if (blobUrl) {
		// Redirect to blob URL
		return realFetch(blobUrl, init);
	}

	return realFetch(input, init);
	};

	// ---------- patched XMLHttpRequest ----------
	const NativeXHR = window.XMLHttpRequest;

	function PatchedXHR() {
	/* Real XHR that will do the work */
	const real = new NativeXHR();

	/* Intercept all property access with a proxy */
	return new Proxy(real, {
		get(target, prop, receiver) {
		/* Intercept .open() and rewrite the URL if we have a blob */
		if (prop === 'open') {
			return function open(method, url, async = true, user, pw) {
			const mapped = getBlobUrlForRequest(url);
			return target.open.call(
				target,
				method,
				mapped || url,
				async,
				user,
				pw
			);
			};
		}

		/* Any other function ⇒ bind real as ‘this’ so callbacks behave */
		const value = Reflect.get(target, prop, receiver);
		if (typeof value === 'function') {
			return value.bind(target);
		}
		return value;
		},

		/* Simple forwarding setter */
		set(target, prop, value) {
		target[prop] = value;
		return true;
		}
	});
	}

	/* Copy static constants such as XMLHttpRequest.DONE, OPENED… */
	Object.getOwnPropertyNames(NativeXHR).forEach((k) => {
	if (!(k in PatchedXHR)) {
		Object.defineProperty(
		PatchedXHR,
		k,
		Object.getOwnPropertyDescriptor(NativeXHR, k)
		);
	}
	});

	/* Replace the global constructor */
	window.XMLHttpRequest = PatchedXHR;

	// Test the patched fetch
	fetch('standard_fonts/FoxitFixedBoldItalic.pfb').then((response) => {
		if (response.ok) {
		console.log('Font loaded successfully via blob URL fetch');
		return response.arrayBuffer();
		}
	}).then(buffer => {
		if (buffer) console.log('Font data:', buffer.byteLength, 'bytes');
	});

	// Test the patched XMLHttpRequest
	const xhr = new XMLHttpRequest();
	xhr.open('GET', 'standard_fonts/FoxitFixedBoldItalic.pfb', true);
	xhr.responseType = 'arraybuffer';
	xhr.onload = function () {
		console.log('Font loaded successfully via blob URL XHR');
		console.log('Font data:', this.response.byteLength, 'bytes');
	};
	xhr.send();
</script>
		`);

	// Passing the globalThis.BLOB_URL_MAP to the viewer.html as a map
	$("head").prepend(`
<script type="module">
	globalThis.BLOB_URL_MAP = ${JSON.stringify(globalThis.BLOB_URL_MAP)};
</script>
	`);

	// Patch the pdf.worker.js script tag
	$("head").append(`
<script type="module">PDFViewerApplicationOptions.set('workerSrc', globalThis.BLOB_URL_MAP["build/pdf.worker.mjs"]);</script>
	`);

	const patchedHTML = $.html();
	const byteNumbers = Array.from(patchedHTML, (char) => char.charCodeAt(0));
	const byteArray = new Uint8Array(byteNumbers);
	const blob = new Blob([byteArray], {
		type: "text/html",
	});
	const url = URL.createObjectURL(blob);
	globalThis.BLOB_URL_MAP["web/viewer.html"] = url;
	console.info(`Patched viewer.html with blob URL: ${url}`);
}
