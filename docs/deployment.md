# 公開運用メモ

## URLの考え方

公開用:

- GitHubリポジトリ: `omicreate/soft-tennis-rule-drill`
- 公開URL: `https://omicreate.github.io/soft-tennis-rule-drill/`
- 用途: ソフトテニスを始めたばかりの子ども、保護者、指導者、テスト協力者へ案内するURL

## 基本方針

- 公開リポジトリには、個人PCの絶対パス、端末固有情報、連絡先、非公開資料を記載しない
- 修正はローカルの作業コピーで確認してからGitHubへ反映する
- 公開前に `docs/update-rules.md` の確認手順で出典を見直す
- 公式ロゴ、公式認定、公式監修と誤認される表示を使わない
- 開発内容はREADME、CHANGELOG、docs配下へ残す

## 通常の流れ

1. 作業コピーで修正する
2. ローカルで動作確認する
3. `npm test` が通ることを確認する
4. 必要に応じて `CHANGELOG.md` と関連Markdownを更新する
5. `sw.js` のキャッシュ名を更新する
6. GitHubへPushする
7. GitHub Pagesを確認する
8. スマホのSafariまたはChromeで表示、ホーム追加、オフライン起動を確認する
9. 問題なければSNSで案内する

## GitHub側で最初に必要な作業

推奨設定:

- Repository name: `soft-tennis-rule-drill`
- Visibility: `Public`
- README作成: なし
- `.gitignore` 作成: なし
- License作成: なし

作成後、GitHub Pagesを有効にする。

- Settings
- Pages
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/root`
- Save

## SNS案内前の確認

- トップ画面でタイトルが `ソフテニルールドリル` になっている
- 4択問題を回答できる
- `ドリル`、`振り返り`、`記録` の表示を確認できる
- ホーム画面追加時の名前が `ルールドリル` になる
- SNS共有時にタイトル、説明、OGP画像が表示される
- READMEに対象ユーザー、非公式アプリであること、利用条件、プライバシー方針がある
- READMEやdocsに個人PCの絶対パス、端末固有情報、非公開メモがない

## 注意点

- Publicリポジトリにすると、URLを知っている人はコードと問題データを閲覧できる
- 明示ライセンスを付けないため、一般的な再配布、改変利用、商用利用は許可しない
- ただしGitHubの機能として閲覧やforkは可能
- ルールは年度や大会ごとに変わるため、SNS案内では `β版` または `ご指摘歓迎` の表現を推奨する
