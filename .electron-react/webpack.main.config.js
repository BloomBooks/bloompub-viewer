"use strict";

process.env.BABEL_ENV = "main";

const path = require("path");
const webpack = require("webpack");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

let mainConfig = {
  // using -eval- here can trigger security alarm (BL-8994)
  devtool: "cheap-module-source-map",
  entry: {
    main: path.join(__dirname, "../src/main/index.ts"),
    preload: path.join(__dirname, "../src/preload.ts"),
  },
  // externals,
  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        loader: "ts-loader",
        options: {
          transpileOnly: true,
          experimentalWatchApi: true,
        },
        exclude: /node_modules/,
      },
      {
        test: /\.node$/,
        use: "node-loader",
      },
    ],
  },
  node: {
    __dirname: process.env.NODE_ENV !== "production",
    __filename: process.env.NODE_ENV !== "production",
  },
  output: {
    filename: "[name].js",
    libraryTarget: "umd",
    path: path.join(__dirname, "../dist/electron"),
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
  ],
  resolve: {
    modules: ["src", "node_modules"],
    extensions: [".js", ".ts", ".json", ".node"],
  },
  target: "electron-main",
};

/**
 * Adjust mainConfig for development settings
 */
if (process.env.NODE_ENV !== "production") {
  mainConfig.plugins.push(
    new webpack.DefinePlugin({
      __static: `"${path.join(__dirname, "../static").replace(/\\/g, "\\\\")}"`,
    })
  );
}

/**
 * Adjust mainConfig for production settings
 */
if (process.env.NODE_ENV === "production") {
  mainConfig.optimization = {
    minimize: true,
    minimizer: [new TerserPlugin()],
  };
  mainConfig.plugins.push(
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": '"production"',
    })
  );
}

module.exports = mainConfig;
