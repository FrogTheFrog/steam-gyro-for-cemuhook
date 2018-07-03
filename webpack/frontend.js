let path = require("path");
let webpack = require("webpack");
let merge = require("webpack-merge");
let nodeExternals = require("webpack-node-externals");
let HtmlWebpackPlugin = require("html-webpack-plugin");
let AngularCompilerPlugin = require("@ngtools/webpack").AngularCompilerPlugin;

let clientConfig = {
    target: "electron-renderer",
    entry: {
        renderer: "./frontend/main.ts"
    },
    context: path.resolve(__dirname, "..", "src"),
    output: {
        filename: "[name].bundle.js",
        path: path.resolve(__dirname, "..", "dist", "frontend"),
        publicPath: "./"
    },
    resolve: {
        extensions: [".ts", ".js"]
    },
    module: {
        rules: [
            {
                test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/i,
                use: ["@ngtools/webpack"]
            },
            {
                test: /.html$/i,
                use: ["raw-loader"]
            },
            {
                test: /global\.scss$/i,
                use: ["style-loader", "to-string-loader", "css-loader?importLoaders=2", "postcss-loader", "sass-loader"]
            },
            {
                test: /\.scss$/,
                exclude: /global\.scss$/i,
                use: ["to-string-loader", "css-loader?importLoaders=2", "postcss-loader", "sass-loader"]
            },
        ]
    },
    externals: [
        nodeExternals({ whitelist: ["ngx-auto-unsubscribe"] })
    ],
    plugins: [
        new HtmlWebpackPlugin({
            filename: path.resolve(__dirname, "..", "dist", "renderer", "index.html"),
            template: path.resolve(__dirname, "..", "src", "renderer", "index.html")
        }),
        new webpack.ContextReplacementPlugin(
            /angular(\\|\/)core(\\|\/)@angular/,
            path.resolve(__dirname, "..", "dist")
        ),
        new AngularCompilerPlugin({
            tsConfigPath: path.resolve(__dirname, "..", "tsconfig.json"),
            entryModule: path.resolve(__dirname, "..", "src", "renderer", "app.module#AppModule"),
            skipCodeGeneration: process.env.NODE_ENV !== "production",
            sourceMap: true
        })
    ]
};

let developmentConfig = {
    devtool: "cheap-module-eval-source-map",
    mode: "development"
};

let productionConfig = {
    mode: "production"
};

if (process.env.NODE_ENV === "production")
    module.exports = merge(clientConfig, productionConfig);
else
    module.exports = merge(clientConfig, developmentConfig);
