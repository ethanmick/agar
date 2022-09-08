const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')
const path = require('path')
const webpack = require('webpack')

/** @type { import('webpack').Configuration } */
module.exports = {
  entry: path.resolve(__dirname, './src/index.ts'), // Absolute path.
  output: {
    filename: '[name].[contenthash].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.ts$/,
        use: 'ts-loader',
      },
      {
        test: /\.(woff(2)?|eot|ttf|otf|svg|)$/,
        type: 'asset/inline',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  devServer: {
    host: '0.0.0.0',
    open: false,
    compress: true,
    hot: true,
    port: 8080,
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        defaultVendors: {
          // Build a distinct chunk file to phaser (allows to reduce size of js file).
          test: /[\\/]node_modules[\\/]phaser[\\/]/,
          name: 'phaser',
          enforce: true, // Ignore minimal constraints to use optimization module.
          chunks: 'initial',
        },
      },
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Phaser: 'phaser',
    }),
    new HtmlWebpackPlugin({
      // A HTML page that will load that JavaScript bundle as a script.
      title: 'Phaser',
      template: path.resolve(__dirname, './src/index.html'),
      filename: 'index.html',
    }),
    new CopyPlugin({
      patterns: [{ from: 'src/assets', to: 'assets/', noErrorOnMissing: true }],
    }),
  ],
}
