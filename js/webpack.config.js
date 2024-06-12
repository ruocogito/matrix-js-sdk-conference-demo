const path = require('path');
const Dotenv = require('dotenv-webpack');
const webpack = require('webpack')

module.exports = {
  entry: './bundle-builder.js', // Adjust the path to your entry file
 resolve: {
	alias: {
            '@': path.resolve('\\js'),
	     crypto: require.resolve('crypto-browserify')
        },
        fallback: {
            crypto: require.resolve('crypto-browserify'),
	    stream: require.resolve('stream'),
	    "fs": false,
	    path: require.resolve('path-browserify'),
           "vm": require.resolve("vm-browserify") 
        },
    },
  output: {
    filename: 'bundle.js',
    path: "J:\\web-projects\\matrix-demo-client\\matrix-demo-client\\js\\lib",
  },
    plugins: [
        new Dotenv(),
        new webpack.ProvidePlugin({
      process: 'process/browser',
    })
    ],
     module: {
    rules: [
      {
        test: /\.wasm$/,
        type: 'javascript/auto',
        use: {
          loader: 'file-loader',
          options: {
            publicPath: 'dist/'
          }
        }
      },
      // ... other rules
    ]
  }
};
