const context = require.context("../build/obsidian/pdf/", true, /.*/);

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

const inlineResources = context.keys().reduce((map, key) => {
	const base64 = context(key).split(",")[1];
	const fileName = key.replace("./", "");
	map[fileName] = {
		base64,
		type:
			mimeTypes[fileName.slice(fileName.lastIndexOf("."))] ||
			"application/octet-stream",
	};
	return map;
}, {});

export default inlineResources;
