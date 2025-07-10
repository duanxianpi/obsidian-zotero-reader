// A Wrapper for the Obsidian Zotero Reader Webpack config

const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const ZoteroLocalePlugin = require("./webpack.zotero-locale-plugin");

function generateReaderConfig(build, mode) {
	let config = {
		name: build,
		mode: mode,
		devtool: false,
		entry: {
			reader: [
				"./src/index." + build + ".js",
				"./src/common/stylesheets/main.scss",
			],
		},
		output: {
			path: path.resolve(__dirname, "./build/" + build),
			filename: "reader.js",
			libraryTarget: "umd",
			publicPath: "",
			library: {
				name: "reader",
				type: "umd",
				umdNamedDefine: true,
			},
		},
		module: {
			rules: [
				{
					test: /\.(ts|js)x?$/,
					exclude: /node_modules/,
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
					exclude: path.resolve(__dirname, "./src/dom"),
					use: [
						MiniCssExtractPlugin.loader,
						{
							loader: "css-loader",
						},
						{
							loader: "postcss-loader",
						},
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
					include: path.resolve(__dirname, "./src/dom"),
					use: [
						{
							loader: "raw-loader",
						},
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
				{
					test: /\.ftl$/,
					type: "asset/source",
				},
			].filter(Boolean),
		},
		resolve: {
			extensions: [".js", ".ts", ".tsx"],
		},
		plugins: [
			new ZoteroLocalePlugin({
				files: ["zotero.ftl", "reader.ftl"],
				locales: ["en-US"],
				commitHash: "37f8c4d4f425244b5ead77bb7e129d828f62fb43",
			}),
			new CleanWebpackPlugin({
				cleanOnceBeforeBuildPatterns: ["**/*", "!pdf/**"],
			}),
			new MiniCssExtractPlugin({
				filename: "[name].css",
			}),
			new HtmlWebpackPlugin({
				template: "./index.reader.html",
				filename: "./[name].html",
				templateParameters: {
					build,
				},
			}),
			new CopyWebpackPlugin({
				patterns: [
					{
						from: "node_modules/mathjax-full/ts/output/chtml/fonts/tex-woff-v2/*.woff",
						to: "./mathjax-fonts/[name].woff",
					},
				],
			}),
		],
	};

	config.externals = {
		react: "React",
		"react-dom": "ReactDOM",
		"prop-types": "PropTypes",
	};

	return config;
}

module.exports = (env, argv) => {
	return generateReaderConfig("obsidian", argv.mode || "development");
};
