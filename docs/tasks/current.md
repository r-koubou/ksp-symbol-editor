# データ型追加に伴うエディタへの対応

## ゴールの詳細

コールバックエディタの引数エディタに他のエディタと同様にデータ型の選択できるようになること。

docs/specs/yaml-data-schema/callback-schema.yaml の Arguments に前回までは無かった項目 `DataType` を追加した。

```diff
diff --git forkSrcPrefix/docs/specs/yaml-data-schema/callback-schema.yaml forkDstPrefix/docs/specs/yaml-data-schema/callback-schema.yaml
index 6a4a154abca67ac77a130f72c73a49bbfeb53b24..5fc548667ffcd46ac4e6b1b5fb4befe0d3bee508 100644
--- forkSrcPrefix/docs/specs/yaml-data-schema/callback-schema.yaml
+++ forkDstPrefix/docs/specs/yaml-data-schema/callback-schema.yaml
@@ -8,7 +8,7 @@ additionalProperties: false
 properties:
   FormatVersion:
     type: string
-    default: "1.0.0"
+    default: "1.1.0"
   Data:
     type: array
     items:
@@ -48,11 +48,14 @@ $defs:
     type: object
     required:
       - Name
+      - DataType
       - RequiredDeclare
     additionalProperties: false
     properties:
       Name:
         type: string
+      DataType:
+        type: string
       RequiredDeclare:
         type: boolean
         default: true
```

### 成果物の要件

- コールバックエディタの引数編集画面で、引数のデータ型を選択できるようにする。
- コマンドエディタの引数編集画面と同様のレイアウト
- YAMLの入出力にも DataType が反映されていること

## タスク内容

- [x] 既存のHTML/JSの修正
