const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const devCerts = require("office-addin-dev-certs");

module.exports = async (env, argv) => {
  const httpsOptions =
    argv.mode === "development" ? await devCerts.getHttpsServerOptions() : {};

  return {
    entry: {
      taskpane: "./src/taskpane/taskpane.ts",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].bundle.js",
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".js", ".mjs"],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.(woff|woff2|ttf|eot)$/,
          type: "asset/resource",
          generator: {
            filename: "fonts/[name][ext]",
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/taskpane/taskpane.html",
        filename: "taskpane.html",
        chunks: ["taskpane"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "assets", to: "assets" },
          { from: "manifest.xml", to: "manifest.xml" },
          { 
            from: "node_modules/katex/dist/fonts", 
            to: "fonts",
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    devServer: {
      static: path.resolve(__dirname, "dist"),
      port: 3000,
      server: {
        type: "https",
        options: httpsOptions,
      },
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  };
};
