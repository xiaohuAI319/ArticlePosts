const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/renderer/index.jsx',
  target: 'electron-renderer',
  devtool: 'source-map',
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@pages': path.resolve(__dirname, 'src/renderer/pages'),
      '@store': path.resolve(__dirname, 'src/renderer/store'),
      '@utils': path.resolve(__dirname, 'src/renderer/utils'),
      '@services': path.resolve(__dirname, 'src/main/services')
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        use: {
          loader: 'file-loader',
          options: {
            outputPath: 'assets/images'
          }
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: {
          loader: 'file-loader',
          options: {
            outputPath: 'assets/fonts'
          }
        }
      }
    ]
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'renderer.js',
    publicPath: './'
  },
  plugins: [
    new (require('html-webpack-plugin'))({
      template: './src/renderer/public/index.html',
      filename: 'index.html'
    })
  ],
  devServer: {
    port: 3000,
    hot: true,
    static: {
      directory: path.join(__dirname, 'build')
    }
  }
};