const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: 'development',
  plugins: [
    new CopyPlugin({
      patterns: [
        "index.html",
      ]
    })
  ],
}