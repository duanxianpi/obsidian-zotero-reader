// webpack.reader.config.js
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const ZoteroLocalePlugin = require("./webpack.zotero-locale-plugin");
const zlib = require("zlib");

function generateReaderConfig(build, mode) {
	/** `src/index.obsidian.js`
	 *  must contain **one line** that pulls in the stylesheet:
	 *  import "./common/stylesheets/main.scss";
	 */
	return {
		name: build,
		mode,
		devtool: false,

		// only keep single entry — CSS is imported from the JS file, otherwise output js won't be loaded in plugin's esbuild
		entry: {
			reader: `./src/index.${build}.js`,
		},

		output: {
			path: path.resolve(__dirname, "build", build),
			filename: "reader.js",
			libraryTarget: "var",
			library: "ZotoreReader",
			// library: {
			//   type: "commonjs-module", // plain `module.exports = …`
			//   export: "default"        // expose the *default* export
			// },
			publicPath: "",
		},

		module: {
			rules: [
				{
					test: /\.(ts|js)x?$/,
					exclude: [
						/node_modules/,
						path.resolve(
							__dirname,
							"src/dom/common/lib/find/worker.ts"
						),
					],
					loader: "babel-loader",
					options: {
						presets: [
							[
								"@babel/preset-env",
								{
									useBuiltIns: false,
									targets: { electron: 34, chrome: 132 },
								},
							],
						],
					},
				},
				{
					test: /\.s?css$/,
					exclude: [
						path.resolve(__dirname, "src/dom"),
						path.resolve(__dirname, "build/obsidian/pdf"),
					],
					use: [
						MiniCssExtractPlugin.loader,
						"css-loader",
						"postcss-loader",
						{
							loader: "sass-loader",
							options: {
								additionalData: `$platform: '${build}';`,
							},
						},
					],
				},
				{
					test: /\.scss$/,
					include: path.resolve(__dirname, "src/dom"),
					use: [
						"raw-loader",
						{
							loader: "sass-loader",
							options: {
								additionalData: `$platform: '${build}';`,
							},
						},
					],
				},
				{
					test: /\.svg$/i,
					issuer: /\.[jt]sx?$/,
					use: ["@svgr/webpack"],
				},
				{ test: /\.ftl$/, type: "asset/source" },
				{
					test: /worker\.ts$/, // Bundle find worker files
					include: path.resolve(__dirname, "src/dom/common/lib/find"),
					use: "babel-loader", // first turn TS → JS
					type: "asset/source", // then export that JS as plain text
				},
				{
					test: /tex\.js$/, // Inline MathJax TeX font URLs
					include: [
						path.dirname(
							require.resolve(
								"mathjax-full/js/output/chtml/fonts/tex.js"
							)
						),
					],
					use: [
						{
							loader: path.resolve(
								__dirname,
								"webpack.inline-mathjax-font-loader.js"
							),
						},
					],
				},
				{
					test: /.*/,
					include: [path.resolve(__dirname, "build/obsidian/pdf")],
					type: "asset/inline",
					generator: {
						dataUrl: (content) => {
							const gzipped = zlib.gzipSync(content);
							const base64 = gzipped.toString("base64");
							return `data:application/gzip;base64,${base64}`;
						},
					},
				},
			],
		},

		resolve: { extensions: [".js", ".ts", ".tsx"] },

		plugins: [
			new ZoteroLocalePlugin({
				files: ["zotero.ftl", "reader.ftl"],
				locales: ["en-US"],
				commitHash: "37f8c4d4f425244b5ead77bb7e129d828f62fb43",
			}),
			new CleanWebpackPlugin({
				cleanOnceBeforeBuildPatterns: ["**/*", "!pdf/**"],
			}),
			new MiniCssExtractPlugin({ filename: "[name].css" }),
		],

		optimization: {
			splitChunks: false, // no need to split chunks, we only have one entry
			runtimeChunk: false,
			minimize: mode === "production",
			usedExports: false,
		},
	};
}

module.exports = (env, argv) => {
	return generateReaderConfig("obsidian", argv.mode || "development");
};
