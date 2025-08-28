// webpack.reader.config.js
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const ZoteroLocalePlugin = require("./webpack.zotero-locale-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const InlineHtmlAssetsPlugin = require("./webpack.inline-html-assets-plugin");

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
			},
			chunkFilename: "[name].reader.js",
		},
		optimization: {
			minimize: mode === "production",
			splitChunks: false, // obsidian does not support split chunks
			runtimeChunk: false,
			usedExports: false,
			minimizer: [new CssMinimizerPlugin(), "..."],
		},
		module: {
			rules: [
				{
					test: /\.(ts|js)x?$/,
					exclude: /node_modules/,
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
					exclude: path.resolve(__dirname, "src/dom"),
					use: [
						MiniCssExtractPlugin.loader,
						"css-loader",
						"postcss-loader",
						{
							loader: "sass-loader",
							options: {
								additionalData: `$platform: 'obsidian';`,
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
								additionalData: `$platform: 'obsidian';`,
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
				files: ["zotero.ftl", "reader.ftl"],
				locales: ["en-US"],
				commitHash: "37f8c4d4f425244b5ead77bb7e129d828f62fb43",
			}),
			new CleanWebpackPlugin({
				cleanOnceBeforeBuildPatterns: ["**/*", "!pdf/**"],
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
		],
	};
};
