// 面別リンク遷移の計測（?src= が付いているときだけ1回送る／2026-07-29 設計=ナオ）
// CSPが script-src 'self' のため外部ファイルにしている。インラインだと実行されない。
(function () {
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbx9M9j1Ad8mkVZKUcRd7ceg8v_IKhdpewRBzrp4Itf-9lBZPELdSSEf59MhuYzS4RtR/exec';
  var APP = 'soft-tennis-rule-drill';
  try {
    var src = new URLSearchParams(location.search).get('src');
    if (!src) return;                                 // 印のないアクセスは何もしない
    if (sessionStorage.getItem('src_sent')) return;   // 同じ訪問での二重計上を防ぐ
    sessionStorage.setItem('src_sent', '1');
    var url = ENDPOINT + '?src=' + encodeURIComponent(src) + '&app=' + encodeURIComponent(APP);
    if (navigator.sendBeacon) navigator.sendBeacon(url);
    else fetch(url, { mode: 'no-cors', keepalive: true });
  } catch (e) { /* 計測が失敗してもアプリ本体は絶対に止めない */ }
})();
