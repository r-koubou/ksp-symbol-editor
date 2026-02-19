# 進捗・未解決事項

## 完了済み

### 変数シンボルエディタ（2026-02-18）

`apps/variables/` に変数シンボルエディタを作成・完成。
詳細は `docs/tasks/logs/2026-02-18.md` を参照。

### コマンドシンボルエディタ（2026-02-18）

`apps/commands/` にコマンドシンボルエディタを作成・完成。
ReturnType・Arguments（ネスト）の編集、データ型 Quick Selection、引数編集モーダルを実装。
YAML 1.1 boolean クォート漏れ・`|-` 空行のスペース混入バグを修正（`apps/variables/app.js` も同時修正）。
詳細は `docs/tasks/logs/2026-02-18.md` を参照。

### コールバックシンボルエディタ（2026-02-19）

`apps/callbacks/` にコールバックシンボルエディタを作成・完成。
AllowMultipleDeclaration・引数 RequiredDeclare の編集、引数編集モーダルを実装。
FormatVersion 出力をクォートなし（`1.0.0`）に統一（commands・variables も同時修正、variable-schema.yaml の仕様ミスも訂正）。
詳細は `docs/tasks/logs/2026-02-19.md` を参照。

## 未着手

- UIタイプシンボルエディタ (`apps/ui-types/`)
