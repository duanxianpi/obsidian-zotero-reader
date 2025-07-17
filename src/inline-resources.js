import { ungzip } from "pako";
import workerZippedBase64 from "./dom/common/lib/find/worker.ts?b64";

const pdfjsContext = require.context("../build/obsidian/pdf/", true, /.*/);
const mimeTypes = {
	".pdf": "application/pdf",
	".wasm": "application/wasm",
	".mjs": "application/javascript",
	".js": "application/javascript",
	".json": "application/json",
	".txt": "text/plain",
	".css": "text/css",
	".html": "text/html",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".pfb": "application/x-font-type1",
	".otf": "font/otf",
	".eot": "application/vnd.ms-fontobject",
	".map": "application/json",
	".bcmap": "application/octet-stream",
	".icc": "application/vnd.iccprofile",
};

const ungzipBase64 = (base64) => {
	const gzippedBuffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
	const decompressedBuffer = ungzip(gzippedBuffer);

	let binary = "";
	const len = decompressedBuffer.length;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(decompressedBuffer[i]);
	}
	return btoa(binary);
};

const inlineResources = pdfjsContext.keys().reduce((map, key) => {
	const gzippedBase64 = pdfjsContext(key).split(",")[1];
	
	const decompressedBase64 = ungzipBase64(gzippedBase64);

	const fileName = key.replace("./", "");
	map[fileName] = {
		base64: decompressedBase64,
		type:
			mimeTypes[fileName.slice(fileName.lastIndexOf("."))] ||
			"application/octet-stream",
	};

	return map;
}, {});

inlineResources["find-worker.js"] = {
	base64: ungzipBase64(workerZippedBase64.split(",")[1]),
	type: "application/javascript",
};

export default inlineResources;
