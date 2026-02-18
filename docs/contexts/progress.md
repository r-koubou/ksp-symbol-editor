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

## 未着手

- コールバックシンボルエディタ (`apps/callbacks/`)
- 関数シンボルエディタ (`apps/functions/`)
- UIタイプシンボルエディタ (`apps/ui-types/`)
