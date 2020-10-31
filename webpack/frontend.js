const path = require("path");
const webpack = require("webpack");
const { merge } = require("webpack-merge");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const AngularCompilerPlugin = require("@ngtools/webpack").AngularCompilerPlugin;

const clientConfig = {
    target: "electron-preload",
    entry: {
        frontend: "./frontend/main.ts"
    },
    context: path.resolve(__dirname, "..", "src"),
    output: {
        filename: "[name].bundle.js",
        path: path.resolve(__dirname, "..", "dist", "frontend"),
        publicPath: "./"
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [{
            test: /\.preload\.ts$/i,
            use: ["val-loader", "@ngtools/webpack"]
        },
        {
            test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/i,
            exclude: /\.preload\.ts$/i,
            use: ["@ngtools/webpack"]
        },
        {
            test: /\.html$/i,
            use: ["raw-loader"]
        },
        {
            test: /global\.scss$/i,
            use: [
                "style-loader",
                {
                    loader: "css-loader",
                    options: {
                        importLoaders: 2
                    }
                },
                "postcss-loader",
                "sass-loader"
            ]
        },
        {
            test: /\.(woff(2)?|ttf|eot)$/,
            use: [{
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]',
                    outputPath: 'fonts/'
                }
            }]
        },
        {
            test: /\.svg$/,
            use: [{
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]',
                    outputPath: 'icons/',
                }
            }]
        },
        {
            test: /\.css$/,
            use: [
                "to-string-loader",
                {
                    loader: "css-loader",
                    options: {
                        esModule: false
                    }
                }
            ]
        },
        {
            test: /\.scss$/,
            exclude: /global\.scss$/i,
            use: [
                "to-string-loader",
                {
                    loader: "css-loader",
                    options: {
                        importLoaders: 2,
                        esModule: false
                    }
                },
                "postcss-loader",
                "sass-loader"
            ]
        },
        {
            // Mark files inside `@angular/core` as using SystemJS style dynamic imports.
            // Removing this will cause deprecation warnings to appear.
            test: /[\/\\]@angular[\/\\]core[\/\\].+\.js$/,
            parser: {
                system: true
            },
        },
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: path.resolve(__dirname, "..", "dist", "frontend", "index.html"),
            template: path.resolve(__dirname, "..", "src", "frontend", "index.html")
        }),
        new webpack.ContextReplacementPlugin(
            /angular(\\|\/)core(\\|\/)@angular/,
            path.resolve(__dirname, "..", "dist")
        ),
        new AngularCompilerPlugin({
            tsConfigPath: path.resolve(__dirname, "..", "tsconfig.frontend.json"),
            entryModule: path.resolve(__dirname, "..", "src", "frontend", "app", "app.module#AppModule"),
            sourceMap: process.env.NODE_ENV !== "production",
        })
    ]
};

const developmentConfig = {
    devtool: "source-map",
    mode: "development"
};

const productionConfig = {
    mode: "production"
};

if (process.env.NODE_ENV === "production") {
    module.exports = merge(clientConfig, productionConfig);
} else {
    module.exports = merge(clientConfig, developmentConfig);
}