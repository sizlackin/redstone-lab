/* Starts the app: draws the Redstone Lab page into <div id="app">.
   window.redstoneLab points at the running app, handy in the developer console (F12). */
(function () {
  var missing = ['engine.js', 'drawing.js', 'concepts.js', 'ui.js'].filter(function (f) {
    return window.__rlLoaded.indexOf(f) < 0;
  });
  if (missing.length) {
    window.__rlReport('app/js/' + missing[0] + ' has a mistake in it, so it stopped loading partway through.');
    return;
  }
  try {
    window.preact.render(html`<${RedstoneLab} ref=${(c) => { window.redstoneLab = c; }} />`, document.getElementById('app'));
  } catch (err) {
    window.__rlReport(String(err && err.message ? err.message : err));
    throw err;
  }
})();
