let webpack = require('webpack');
let nodeExternals = require('webpack-node-externals');
let merge = require('webpack-merge');
let path = require('path');

let clientConfig = {
    target: 'electron-main',
    entry: {
        main: './main.ts'
    },
    context: path.resolve(__dirname, 'src'),
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/i,
                use: ['awesome-typescript-loader']
            },
            {
                test: /\.(ico|gif|png|jpe?g|svg)$/i,
                use: 'file-loader?name=images/[name].[ext]'
            }
        ]
    },
    externals: [
        nodeExternals()
    ],
    node: {
        __dirname: false
    }
};

let developmentConfig = {
    devtool: 'source-map',
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
};

if (process.env.NODE_ENV === 'production')
    module.exports = merge(clientConfig, productionConfig);
else
    module.exports = merge(clientConfig, developmentConfig);