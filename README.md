# Easy Volume Compressor for Firefox

音声/動画コンテンツの音量を自動的に均一化するFirefoxアドオン。内蔵コンプレッサーにより、大きすぎる音を抑制し、小さすぎる音を増幅して快適な視聴体験を提供します。

## 機能

- ページ内の全ての音声/動画要素に対して自動的にコンプレッサーを適用
- サイトごとに独立した設定の保存
- リアルタイムでの設定変更の反映
- シンプルで使いやすいUI

## インストール

1. Firefoxアドオンストアから「Easy Volume Compressor」をインストール
2. ツールバーに表示されるアイコンをクリックして設定パネルを開く
3. お好みに応じてコンプレッサーの設定を調整

## 設定項目

- **有効/無効**: コンプレッサーのオン/オフを切り替え
- **Threshold**: 圧縮を開始する音量レベル（dB）
- **Ratio**: 圧縮の強さ
- **Attack**: 圧縮が開始されるまでの時間（ms）
- **Release**: 圧縮が解除されるまでの時間（ms）
- **Output Gain**: 全体的な音量調整（dB）

## 開発者向け情報

### 必要な環境
- Node.js
- npm

### セットアップ

```bash
# リポジトリのクローン
git clone https://github.com/your-username/easy-volume-compressor-firefox.git
cd easy-volume-compressor-firefox

# 依存パッケージのインストール
npm install

# 開発モードで実行
npm run dev

# ビルドのみ実行
npm run build

# パッケージング
npm run package
```

### ディレクトリ構造

- `src/`: ソースコード
  - `background/`: バックグラウンドスクリプト
  - `content/`: コンテンツスクリプト
  - `popup/`: 設定パネルUI
- `dist/`: コンパイル済みファイル
- `popup/`: ポップアップHTML
- `icons/`: アドオンアイコン

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照してください。
