UI仕様
=====

UI全般に関する仕様を記載する。UI実装作業前に必ず目を通すこと。


## 概要

docs/specs 以下のエディタ仕様 (*-editor.md) で記載されているUIの共通仕様を記載する。

## 実装アプローチ

エディタは Web ブラウザでHTML/CSS/JavaScript を使用して実装する。

### UIフレームワーク・Tailwind CSS の不使用

React や Vue などのフレームワーク、Tailwind CSS は使用せず、純粋な JavaScript で実装する。理由は以下の通り。

- バックエンドサーバーを用いないローカル完結（HTMLファイル開くだけで動作）で問題ないため。

## 全体レイアウト・コンテナ要素

appendix/container.jpg を参照。

ピクセルサイズまでの完全再現は求めない。あくまでモック程度であることに留意すること。

## 各コンテナごとのレイアウト

appendix/mock.jpg を参照。

ピクセルサイズまでの完全再現は求めない。あくまでモック程度であることに留意すること。

## UI方針

- レスポンシブデザインを採用し、ウィンドウサイズに応じてレイアウトが適切に変化するようにする。

## YAMLデータエクスポート時の特記事項

### Description というフィールド

文字数ゼロのときは

```yaml
Description: ""
```

とすること。

1文字以上のときは、改行を含む含まないに関わらず、以下のようにすること。

```yaml
Description: |-
    テキスト
```

## ディレクトリ構成

```
├── appendix/                           # UIのレイアウト図の画像を格納しているディレクトリ
├── callback-editor.md                  # コールバックシンボルのエディタUI仕様
├── command-editor.md                   # コマンドシンボルのエディタUI仕様
├── data-type-edit.md                   # データ型のエディタUI仕様
├── function-editor.md                  # 関数シンボルのエディタUI仕様
├── README.md                           # このファイル
├── ui-type-editor.md                   # UIデータ型のエディタUI仕様
└── variable-editor.md                  # 変数シンボルのエディタUI仕様
```
