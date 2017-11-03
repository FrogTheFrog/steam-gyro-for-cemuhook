let path = require('path');
let webpack = require('webpack');
let merge = require('webpack-merge');
let nodeExternals = require('webpack-node-externals');
let HtmlWebpackPlugin = require('html-webpack-plugin');
let ExtractTextPlugin = require('extract-text-webpack-plugin');
let GlobalStyle = new ExtractTextPlugin('styles/globalStyle.css');

let clientConfig = {
    target: 'electron-renderer',
    entry: {
        renderer: './renderer/main.ts',
        polyfill: ['reflect-metadata', 'zone.js/dist/zone']
    },
    context: path.resolve(__dirname, '..', 'src'),
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, '..', 'dist', 'renderer'),
        publicPath: "./"
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/i,
                use: ['awesome-typescript-loader', 'angular2-template-loader']
            },
            {
                test: /global\.scss$/i,
                loader: GlobalStyle.extract(['css-loader?importLoaders=2', 'postcss-loader', 'sass-loader'])
            },
            {
                test: /\.scss$/,
                exclude: /global\.scss$/i,
                use: ['to-string-loader', 'css-loader?importLoaders=2', 'postcss-loader', 'sass-loader']
            },
            {
                test: /\.(gif|png|jpe?g|svg|ico)$/i,
                use: 'file-loader?name=images/[name].[ext]'
            },
            {
                test: /\.(ttf|eot|woff|woff2)$/i,
                use: 'file-loader?name=fonts/[name].[ext]&publicPath=../'
            }
        ]
    },
    externals: [
        nodeExternals()
    ],
    plugins: [
        new webpack.optimize.CommonsChunkPlugin({
            names: ['polyfill']
        }),
        new HtmlWebpackPlugin({
            filename: path.resolve(__dirname, '..', 'dist', 'renderer', 'index.html'),
            template: path.resolve(__dirname, '..', 'src', 'renderer', 'index.html')
        }),
        new webpack.ContextReplacementPlugin(
            /angular(\\|\/)core(\\|\/)@angular/,
            path.resolve(__dirname, '..', 'dist')
        ),
        GlobalStyle
    ]
};

let developmentConfig = {
    devtool: 'cheap-module-eval-source-map',
    performance: {
        hints: false
    },
    output: {
        devtoolModuleFilenameTemplate: function (info) {
            return "file:///" + encodeURI(info.absoluteResourcePath);
        }
    }
};

let productionConfig = {
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
        }),
    ]
};

if (process.env.NODE_ENV === 'production')
    module.exports = merge(clientConfig, productionConfig);
else
    module.exports = merge(clientConfig, developmentConfig);