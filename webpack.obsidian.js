// webpack.reader.config.js
const fs = require("fs");
const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const ZoteroLocalePlugin = require("./webpack.zotero-locale-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const InlineHtmlAssetsPlugin = require("./webpack.inline-html-assets-plugin");
const DocumentWorkerPlugin = require("./webpack.document-worker-plugin");

const ZOTERO_LOCALE_COMMIT = fs
	.readFileSync(path.resolve(__dirname, ".zotero-locale-commit"), "utf8")
	.trim();

const DOCUMENT_WORKER_LOCK = JSON.parse(
	fs.readFileSync(
		path.resolve(__dirname, "../../document-worker.lock.json"),
		"utf8"
	)
).documentWorker;

module.exports = (_env, argv) => {
	const mode = argv.mode || "development";

	return {
		name: "obsidian",
		mode,
		devtool: false,
		entry: {
			reader: [
				"./src/index.obsidian.js",
				"./src/common/stylesheets/main.scss",
			],
		},
		output: {
			path: path.resolve(__dirname, "./build/obsidian"),
			filename: "reader.js",
			libraryTarget: "umd",
			publicPath: "",
			library: {
				name: "reader",
				type: "umd",
				umdNamedDefine: true,
			},
			chunkFilename: "[name].reader.js",
		},
		optimization: {
			minimize: mode === "production",
			splitChunks: false, // obsidian does not support split chunks
			runtimeChunk: false,
			usedExports: false,
			minimizer: [
				new CssMinimizerPlugin(),
				new TerserPlugin({ terserOptions: { compress: { passes: 2 } } }),
			],
		},
		module: {
			rules: [
				{
					test: /\.(ts|js)x?$/,
					include: path.resolve(__dirname, "./src"),
					use: {
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
				},
				{
					test: /\.s?css$/,
					include: path.resolve(__dirname, "./src"),
					exclude: path.resolve(__dirname, "./src/dom"),
					use: [
						MiniCssExtractPlugin.loader,
						"css-loader",
						"postcss-loader",
						{
							loader: "sass-loader",
							options: {
								additionalData: `$platform: 'web';`,
							},
						},
					],
				},
				{
					test: /\.scss$/,
					include: path.resolve(__dirname, "./src/dom"),
					use: [
						"raw-loader",
						{
							loader: "sass-loader",
							options: {
								additionalData: `$platform: 'web';`,
							},
						},
					],
				},
				{
					test: /\.svg$/i,
					include: path.resolve(__dirname, "./res/icons"),
					issuer: /\.[jt]sx?$/,
					use: ["@svgr/webpack"],
				},
				{
					test: /\.ftl$/,
					include: path.resolve(__dirname, "./locales"),
					type: "asset/source",
				},
				{
					test: /(tex|FontData)\.js$/, // Inline MathJax TeX font URLs
					include: [
						path.dirname(
							require.resolve(
								"mathjax-full/js/output/chtml/fonts/tex.js"
							)
						),
						path.dirname(
							require.resolve(
								"mathjax-full/js/output/chtml/FontData.js"
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
			].filter(Boolean),
		},

		resolve: { extensions: [".js", ".ts", ".tsx"] },

		plugins: [
			new ZoteroLocalePlugin({
				files: [
					"zotero.ftl",
					"reader.ftl",
					{ src: "app/assets/branding/locale/brand.ftl", dest: "brand.ftl" },
				],
				locales: ["en-US"],
				commitHash: ZOTERO_LOCALE_COMMIT,
			}),
			new CleanWebpackPlugin({
				cleanOnceBeforeBuildPatterns: [
					"**/*",
					"!pdf",
					"!pdf/LICENSE",
					"!pdf/build",
					"!pdf/build/**",
					"!pdf/web",
					"!pdf/web/**",
				],
			}),
			new HtmlWebpackPlugin({
				template: "./index.obsidian.reader.html",
				filename: "./[name].html",
				inject: false,
				cache: false,
			}),
			new MiniCssExtractPlugin({ filename: "[name].css" }),
			new InlineHtmlAssetsPlugin({
				leaveCSSFile: false,
				leaveJSFile: false,
				keepLinkTag: false,
				keepScriptTag: false,
			}),
			new DocumentWorkerPlugin({
				commitHash: DOCUMENT_WORKER_LOCK.commit,
				archiveSha256: DOCUMENT_WORKER_LOCK.archiveSha256,
			}),
		],
	};
};
