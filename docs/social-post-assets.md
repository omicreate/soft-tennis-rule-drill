# 投稿用画像

ソフテニルールドリルを各媒体で紹介するときに使う画像です。

## 画像一覧

- `assets/social/x-facebook-card.png`
  - X、Facebook、リンク共有向け
  - サイズ: 1200 x 630
- `assets/social/instagram-square.png`
  - Instagramフィード向け
  - サイズ: 1080 x 1080
- `assets/social/instagram-story.png`
  - Instagramストーリーズ、縦長告知向け
  - サイズ: 1080 x 1920
- `assets/social/note-header.png`
  - note記事ヘッダー、横長告知向け
  - サイズ: 1600 x 900

## デザイン方針

- 硬式テニス風の曲線入りボール、フェルト質感、テニスボール絵文字は使わない
- ルールカード、チェック、スコア表示、4択ドリルの雰囲気を中心にする
- 公開URLや説明文は最小限にし、投稿本文で補足する

## 再生成

画像を作り直す場合は、Sharpが利用できる環境で以下を実行します。

```sh
node scripts/generate-social-assets.js
```
