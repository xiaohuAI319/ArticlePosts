const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/renderer/index.jsx',
  target: 'web', // 改为web目标
  devtool: 'source-map',
  resolve: {
    extensions: ['.js', '.jsx'],
    fallback: {
      "global": require.resolve("global"),
    }
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      inject: 'body',
      scriptLoading: 'defer',
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    open: false,
    historyApiFallback: true,
    client: {
      logging: 'warn', // 减少webpack-dev-server的日志输出
    },
    devMiddleware: {
      stats: 'minimal', // 最小化统计信息
    },
  },
};