# 3D MUSEUM

つくった世界を、もっと身近に。

**[サイトを開く](https://ecleaire.github.io/3dmuseum/)**

現在は公開準備中です。Coming soon ページで、濃紺の面とミント色の辺を持つ正八面体を操作できます。

## 操作方法

- ドラッグ・スワイプで回転
- ホイール・ピンチで拡大・縮小
- ↺ ボタンで初期表示にリセット

スマートフォン・タブレット・PC に対応しています。端末で動きを減らす設定を有効にしている場合、自動回転は停止します。

## ローカルでの確認

Node.js 24 を推奨します。

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## 公開

GitHub Pages の Source を **GitHub Actions** に設定します。`main` への push 後にテスト・ビルド・公開を実行し、ページと表示用ファイルを確認します。配信するファイルは `dist/` に生成されます。
