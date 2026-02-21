# データ型追加に伴うエディタへの対応

## ゴールの詳細

UIエディタの初期化引数編集画面を他のエディタと同様にデータ型の選択できるようになること。

docs/specs/yaml-data-schema/ui-type-schema.yaml に前回までは無かった項目 `DataType` を追加した。

```diff
diff --git forkSrcPrefix/docs/specs/yaml-data-schema/ui-type-schema.yaml forkDstPrefix/docs/specs/yaml-data-schema/ui-type-schema.yaml
index a8d5dbd8288cfcb399166b3ffcec5d86b89b97da..464b2dfdbb5a4b5563fc5f290fbd0e6de081f923 100644
--- forkSrcPrefix/docs/specs/yaml-data-schema/ui-type-schema.yaml
+++ forkDstPrefix/docs/specs/yaml-data-schema/ui-type-schema.yaml
@@ -8,7 +8,7 @@ additionalProperties: false
 properties:
   FormatVersion:
     type: string
-    default: "1.0.0"
+    default: "1.1.0"
   Data:
     type: array
     items:
@@ -53,11 +53,13 @@ $defs:
     type: object
     required:
       - Name
+      - DataType
     additionalProperties: false
     properties:
       Name:
         type: string
+      DataType:
+        type: string
       Description:
         type: string
         default: ""
-
```

### 成果物の要件

- UIエディタの初期化引数編集画面で、引数のデータ型を選択できるようにする。
- コマンドエディタの引数編集画面と同様のレイアウト
- YAMLの入出力にも DataType が反映されていること

## 特記事項

前回のタスクでは、文字がはみ出る問題を解決するために、引数の編集画面のレイアウトを変更した。
この点にも中止ながら実装すること。

詳細は1つ前のコミット 65e52ef5d4475d79b9e862503837b1a6cab1c70b を参照。

## タスク内容

- [x] 既存のHTML/JSの修正
