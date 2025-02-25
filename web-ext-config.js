module.exports = {
  // アドオンのビルドとパッケージング設定
  build: {
    overwriteDest: true,
  },
  // 開発時の設定
  run: {
    startUrl: [
      "https://www.youtube.com", // テスト用のメディアサイト
      "about:debugging#/runtime/this-firefox" // アドオンのデバッグページ
    ],
    browserConsole: true, // ブラウザコンソールを表示
    firefoxProfile: undefined, // 新しいプロファイルを使用
    keepProfileChanges: false, // プロファイルの変更を保持しない
    watchFile: [
      "manifest.json",
      "popup/**/*",
      "dist/**/*.js"
    ],
  },
  // 無視するファイル
  ignoreFiles: [
    "node_modules/**",
    ".git/**",
    "src/**/*.ts", // コンパイル前のTypeScriptファイル
    "**/*.map" // ソースマップ
  ]
};