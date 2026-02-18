specs
=====


## このファイルの概要

各種仕様や制約を記載するファイルの説明を記載する。作業前に必ず目を通すこと。


## ファイル概要

```
├── callback.md                     # コールバックのYAMLデータ仕様
├── command.md                      # コマンドのYAMLデータ仕様
├── function.md                     # 関数のYAMLデータ仕様
├── README.md                       # このファイル
├── ui/                             # UI全般に関する仕様
├── ui-type.md                      # UI型のYAMLデータ仕様
├── variable.md                     # 変数のYAMLデータ仕様
└── yaml-data-schema/               # 各YAMLデータのスキーマ
```

## YAMLファイル

本プロジェクトでエクスポートされたYAMLファイルは、C#のプログラムで、ライブラリ YamlDotNet を使用して読み込まれる。


本プロジェクト発足以前までは YamlDotNet ででYAMLファイルの生成を行っており、本プロジェクトのエディタでロードする際は、 YamlDotNet で生成されたYAMLファイルの記法であることを留意すること。

以下にC#側でのYAMLファイルの生成時のコードを示す。

```csharp
ISerializer serializer
        = new SerializerBuilder()
         .WithNewLine( "\n" )
         .WithIndentedSequences()
         .Build();

serializer.Serialize( obj );
```
