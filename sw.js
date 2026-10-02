// ルールドリルは新アプリ「ソフトテニスIQ」へ移転しました（2026-10-02）。
// 古い版をキャッシュから出し続けないよう、このService Workerは自分のキャッシュを消して登録を解除し、
// 開いている画面を再読み込みして移転先へ案内します。同じドメインの他アプリのキャッシュには触れません。
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("soft-tennis-rule-drill-")).map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});

self.addEventListener("fetch", () => {
  // 何もしない（通常どおりネットワークから取得）
});
