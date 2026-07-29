// 面別リンク遷移の計測（?src= が付いているときだけ1回送る／2026-07-29 設計=ナオ）
// CSPが script-src 'self' のため外部ファイルにしている。インラインだと実行されない。
(function () {
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbx9M9j1Ad8mkVZKUcRd7ceg8v_IKhdpewRBzrp4Itf-9lBZPELdSSEf59MhuYzS4RtR/exec';
  var APP = 'soft-tennis-rule-drill';
  try {
    var src = new URLSearchParams(location.search).get('src');
    if (!src) return;                                 // 印のないアクセスは何もしない
    var KEY = 'src_sent:' + APP + ':' + src;          // 3アプリは同一オリジンのため、キーを分けないと共有される
    if (sessionStorage.getItem(KEY)) return;          // 同じ訪問・同じ面での二重計上だけを防ぐ
    sessionStorage.setItem(KEY, '1');
    var url = ENDPOINT + '?src=' + encodeURIComponent(src) + '&app=' + encodeURIComponent(APP);
    if (navigator.sendBeacon) navigator.sendBeacon(url);
    else fetch(url, { mode: 'no-cors', keepalive: true });
  } catch (e) { /* 計測が失敗してもアプリ本体は絶対に止めない */ }
})();
