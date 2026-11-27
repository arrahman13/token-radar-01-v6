// Token Radar v6 dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the board, the farm plans and the evidence. No network: every byte it shows is in data.js.
// The integrity strip rebuilds the board in this page from the snapshot and the same model code,
// and compares it with board.json's checksum row by row.

(function () {
  var DATA = window.RADAR;
  var MODEL = window.RADAR_MODEL;
  var params = new URLSearchParams(location.search);
  var state = { tab: 'board', category: '', text: '', watchlist: false, selected: null };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
  }
  function fmtPct(n) { return n === null || n === undefined ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function fmtAge(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d < 30) return d + 'd';
    if (d < 365) return Math.round(d / 30) + 'mo';
    return (d / 365).toFixed(1) + 'y';
  }
  function money(n, dec) { return '$' + n.toFixed(dec === undefined ? 2 : dec); }
  function fmtBreakeven(pct) { return pct < 0.0001 ? '<0.0001%' : pct.toFixed(4) + '%'; }

  // ---- header
  $('meta-line').textContent = 'Snapshot ' + DATA.as_of + ' · ' + DATA.source +
    ' · floor $' + DATA.floor_usd.toLocaleString() + ' · model ' + DATA.model_version;
  var kpis = [
    [DATA.board_size + '', 'board rows'],
    [DATA.watchlist_size + '/40', 'watchlist covered'],
    [DATA.accounted + '/758', 'protocols accounted for'],
    ['×' + DATA.value_validation.loo, 'value LOO error'],
    ['×' + DATA.value_validation.walk_forward, 'value walk-forward'],
    [DATA.odds_validation.cv + '', 'odds Brier (CV)'],
    ['×' + DATA.conformal_factor, '80% interval'],
  ];
  kpis.forEach(function (k) {
    var d = el('div', 'kpi');
    d.appendChild(el('b', null, k[0]));
    d.appendChild(el('span', null, k[1]));
    $('kpis').appendChild(d);
  });

  // ---- integrity strip: rebuild the board in this page and compare with board.json
  function runIntegrity() {
    var strip = $('integrity');
    try {
      var rebuilt = MODEL.rebuildBoard(DATA.snapshot);
      var match = 0;
      var bySlug = {};
      DATA.rows.forEach(function (r) { bySlug[r.slug] = r; });
      rebuilt.rows.forEach(function (r) {
        var mine = bySlug[r.slug];
        if (mine && mine.implied_value_usd === r.implied_value_usd && mine.rank === r.rank) match++;
      });
      var ok = match === DATA.rows.length && rebuilt.checksum === DATA.checksum;
      strip.textContent = 'Integrity: this page rebuilt the board from the snapshot — ' + match + '/' +
        DATA.rows.length + ' rows match board.json, checksum ' + DATA.checksum.slice(0, 12) + '…' +
        (ok ? ' Recompute agrees.' : ' MISMATCH — the data would be stale.');
      strip.className = 'integrity ' + (ok ? 'ok' : 'bad');
    } catch (err) {
      strip.textContent = 'Integrity: recompute failed in this page (' + err.message + ').';
      strip.className = 'integrity bad';
    }
  }

  // ---- board
  var cats = [];
  DATA.rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) === -1) cats.push(r.category); });
  cats.sort();
  cats.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('filter-category').appendChild(o);
  });

  function filteredRows() {
    return DATA.rows.filter(function (r) {
      if (state.category && r.category !== state.category) return false;
      if (state.watchlist && !r.on_watchlist) return false;
      if (state.text) {
        var q = state.text.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) === -1 && r.slug.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderBoard() {
    var rows = filteredRows();
    $('row-count').textContent = rows.length + ' of ' + DATA.rows.length + ' rows';
    var body = $('board-body');
    body.innerHTML = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (state.selected === r.slug) tr.className = 'selected';
      tr.setAttribute('data-slug', r.slug);
      var name = document.createElement('td');
      name.appendChild(document.createTextNode(r.name));
      if (r.on_watchlist) name.appendChild(el('span', 'badge', 'WATCHLIST'));
      if (r.above_floor && !r.on_watchlist) name.appendChild(el('span', 'badge floor', 'ABOVE FLOOR'));
      var cells = [
        [String(r.rank), 'num'], [null, null], [r.category || '—', null],
        [String(r.chains.length), 'num'], [fmtUsd(r.tvl_usd), 'num'],
        [fmtPct(r.change_7d), 'num'], [fmtAge(r.age_days), null],
        [(r.token_odds * 100).toFixed(0) + '%', 'num'],
        [fmtUsd(r.implied_value_usd), 'num'],
        [fmtUsd(r.interval_low_usd) + '–' + fmtUsd(r.interval_high_usd), 'num'],
        [money(r.farm.net_per_hour_usd) + '/h', r.farm.net_per_hour_usd >= 0 ? 'num pos' : 'num neg'],
        [money(r.farm.capital_usd, 0), 'num'],
      ];
      cells.forEach(function (c, i) {
        if (i === 1) { tr.appendChild(name); return; }
        var td = el('td', c[1], c[0]);
        tr.appendChild(td);
      });
      tr.addEventListener('click', function () { selectRow(r.slug); });
      body.appendChild(tr);
    });
  }

  function selectRow(slug) {
    state.selected = slug;
    renderBoard();
    var r = null;
    DATA.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) { $('detail').innerHTML = ''; return; }
    var d = $('detail');
    d.innerHTML = '';
    d.appendChild(el('h3', null, '#' + r.rank + ' — ' + r.name));
    var facts = el('div', 'facts');
    facts.innerHTML = 'Category <b>' + (r.category || '—') + '</b> · Chains <b>' + r.chains.join(', ') + '</b> · ' +
      'TVL <b>' + fmtUsd(r.tvl_usd) + '</b> · 7d <b>' + fmtPct(r.change_7d) + '</b> · Age <b>' + fmtAge(r.age_days) + '</b> · ' +
      'Token odds <b>' + (r.token_odds * 100).toFixed(1) + '%</b> · Implied value <b>' + fmtUsd(r.implied_value_usd) + '</b> ' +
      '(80% range ' + fmtUsd(r.interval_low_usd) + '–' + fmtUsd(r.interval_high_usd) + ')';
    d.appendChild(facts);
    var farm = el('div', 'facts');
    farm.innerHTML = 'Farm on <b>' + r.farm.chain + '</b> · Gas <b>' + money(r.farm.gas_per_tx_usd) + '/tx</b> · ' +
      'Minimum capital <b>' + money(r.farm.capital_usd, 0) + '</b> · Hold <b>' + r.farm.hold_days + ' days</b> · ' +
      'Gas total <b>' + money(r.farm.gas_total_usd) + '</b> · Attention <b>' + r.farm.hours.toFixed(2) + ' h</b> · ' +
      'Expected gross <b>' + money(r.farm.expected_gross_usd) + '</b> · Net <b>' + money(r.farm.net_per_hour_usd) + '/h</b> · ' +
      'Breakeven capture <b>' + fmtBreakeven(r.farm.breakeven_capture_pct) + '</b>';
    d.appendChild(farm);
    var ol = document.createElement('ol');
    r.farm_steps.forEach(function (s) { ol.appendChild(el('li', null, s)); });
    d.appendChild(ol);
    d.scrollIntoView({ block: 'nearest' });
  }

  // ---- evidence
  function evTable(rows) {
    var t = document.createElement('table');
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, row[0]));
      tr.appendChild(el('td', 'num', row[1]));
      t.appendChild(tr);
    });
    return t;
  }
  (function renderEvidence() {
    var wrap = $('evidence');
    var grid = el('div', 'ev-grid');
    var v = el('div', 'ev-card');
    v.appendChild(el('h3', null, 'Value model — what a launch is worth'));
    v.appendChild(evTable([
      ['Model', 'Huber (k = 1.345) on ln(mcap / TVL), ' + DATA.peers + ' traded peers (mcap ≥ $5M)'],
      ['Terms', DATA.value_terms.join(' + ') + '  (intercept ' + DATA.value_coefs[0] + ', size ' + DATA.value_coefs[1] + ', size3 ' + DATA.value_coefs[2] + ', growth_age ' + DATA.value_coefs[3] + ', size_growth ' + DATA.value_coefs[4] + ')'],
      ['Implied value', 'expected launch value: the fitted launch value times the token odds'],
      ['Leave-one-out', '×' + DATA.value_validation.loo],
      ['Walk-forward', '×' + DATA.value_validation.walk_forward],
      ['10-fold CV (×3)', '×' + DATA.value_validation.cv],
      ['Leave-one-category-out', '×' + DATA.value_validation.loco],
      ['80% interval', '±' + DATA.conformal_half_log + ' log units (×' + DATA.conformal_factor + '), coverage ' + DATA.conformal_coverage],
      ['Centres (peers)', 'ln TVL ' + DATA.center_lntvl + ', ln age ' + DATA.center_age + ', growth ' + DATA.center_growth + ', log1p chains ' + DATA.center_chains],
      ['Terms clamped', 'to the peers’ ranges — size [' + DATA.term_ranges.size[0] + ', ' + DATA.term_ranges.size[1] + '], size3 [' + DATA.term_ranges.size3[0] + ', ' + DATA.term_ranges.size3[1] + '], growth_age [' + DATA.term_ranges.growth_age[0] + ', ' + DATA.term_ranges.growth_age[1] + '], size_growth [' + DATA.term_ranges.size_growth[0] + ', ' + DATA.term_ranges.size_growth[1] + ']'],
    ]));
    var p = el('p', null, 'Terms were kept only when they lowered BOTH blind tests (leave-one-out and ' +
      'walk-forward) by more than 0.001 and worsened neither guard. The search ran 16 single terms, ' +
      'all 120 pairs and greedy forward from the best pairs; size, size3, growth_age and size_growth ' +
      'is the endpoint nothing else beats. Category offsets were tried for the value model and rejected: ' +
      'they worsen leave-one-out and cross-validation on 87 peers.');
    v.appendChild(p);
    grid.appendChild(v);

    var o = el('div', 'ev-card');
    o.appendChild(el('h3', null, 'Odds model — will it ever record a token?'));
    o.appendChild(evTable([
      ['Model', 'Logistic on ' + DATA.dated + ' dated protocols, base rate ' + (DATA.token_base_rate * 100).toFixed(1) + '%'],
      ['Terms', DATA.odds_terms.join(' + ') + '  (intercept ' + DATA.odds_coefs[0] + ', age ' + DATA.odds_coefs[1] + ', category ' + DATA.odds_coefs[2] + ')'],
      ['Brier, 10-fold CV (×3)', String(DATA.odds_validation.cv)],
      ['Brier, walk-forward', String(DATA.odds_validation.walk_forward)],
      ['Brier, leave-one-category-out', String(DATA.odds_validation.loco)],
      ['Median age', DATA.median_age_yrs + ' years (used when a protocol records no listing date)'],
    ]));
    o.appendChild(el('p', null, 'Category offsets are shrunk toward the base rate (k = 5) and are ' +
      'computed from the training fold only in every validation, so no held-out protocol leaks ' +
      'into its own offset. Adding growth, size or chains was tried and rejected: none lowers both ' +
      'blind tests by more than 0.001.'));
    grid.appendChild(o);

    var f = el('div', 'ev-card');
    f.appendChild(el('h3', null, 'Farm economics — what a plan costs'));
    var gasRows = Object.keys(DATA.gas_table).map(function (c) { return [c, money(DATA.gas_table[c]) + ' / tx']; });
    gasRows.push(['Other chains', money(0.5) + ' / tx (default)']);
    f.appendChild(evTable(gasRows));
    f.appendChild(el('p', null, 'Every plan carries a net $/hour verdict: expected gross minus gas, over the ' +
      'hours of attention. Expected gross is the implied value times a planning capture share of ' +
      '0.001% — the implied value already multiplies the launch value by the token odds, so it is the ' +
      'expected launch value; the share is a stated assumption, never a promise. The breakeven capture share ' +
      'sits beside every verdict so a reader can substitute their own. Gas figures are typical values; ' +
      'check the chain’s fee page before you act. Minimum capital runs $50 / $100 / $150 / $250 by TVL tier.'));
    grid.appendChild(f);

    var d = el('div', 'ev-card');
    d.appendChild(el('h3', null, 'Coverage — the floor is never a ceiling'));
    d.appendChild(el('p', null, 'The board holds all 198 pre-token protocols that pass the watchlist’s ' +
      'own exclusion test: the 40 on the watchlist, the 20 above the $50M floor the house list leaves ' +
      'out (labelled ABOVE FLOOR, with the house list’s own reason for leaving a protocol out being ' +
      'its parent protocol, a field this snapshot does not carry), and the 138 below the floor. ' +
      'The other 560 protocols are accounted for on the next tab with their reasons.'));
    grid.appendChild(d);
    wrap.appendChild(grid);
  })();

  // ---- disposition
  (function renderDisposition() {
    var c = DATA.disposition_counts;
    $('disp-counts').innerHTML = '<p class="note">Board <b>' + c.board + '</b> · Live <b>' + c.live +
      '</b> · Token-bearing, not in the live view <b>' + c.token + '</b> · Excluded <b>' + c.excluded +
      '</b> · Total <b>' + DATA.accounted + '</b>.</p>';
    var body = $('disp-body');
    DATA.disposition.forEach(function (e) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, e.name + ' (' + e.slug + ')'));
      tr.appendChild(el('td', null, e.status));
      tr.appendChild(el('td', null, e.reason));
      body.appendChild(tr);
    });
  })();

  // ---- live
  (function renderLive() {
    var body = $('live-body');
    DATA.live.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, r.name + ' (' + r.slug + ')'));
      tr.appendChild(el('td', null, r.category || '—'));
      tr.appendChild(el('td', null, r.chains.join(', ')));
      tr.appendChild(el('td', 'num', fmtUsd(r.tvl_usd)));
      tr.appendChild(el('td', 'num', fmtUsd(r.mcap_usd)));
      tr.appendChild(el('td', 'num', fmtPct(r.change_7d)));
      body.appendChild(tr);
    });
  })();

  // ---- tabs, filters, views
  function showTab(name) {
    state.tab = name;
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tabpage').forEach(function (s) {
      s.classList.toggle('active', s.id === 'tab-' + name);
    });
  }
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
  });
  $('filter-category').addEventListener('change', function () { state.category = this.value; renderBoard(); });
  $('filter-text').addEventListener('input', function () { state.text = this.value; renderBoard(); });
  $('filter-watchlist').addEventListener('change', function () { state.watchlist = this.checked; renderBoard(); });

  var view = params.get('view');
  if (view === 'detail' && params.get('slug')) {
    // A dedicated detail view: the table is hidden so the detail sits at the top.
    document.querySelector('#tab-board .controls').style.display = 'none';
    document.querySelector('#tab-board .table-wrap').style.display = 'none';
    showTab('board');
    state.selected = params.get('slug');
    renderBoard();
    selectRow(params.get('slug'));
    window.scrollTo(0, 0);
  } else if (view === 'filtered' && params.get('category')) {
    state.category = params.get('category');
    $('filter-category').value = state.category;
    showTab('board');
    renderBoard();
  } else {
    renderBoard();
  }
  setTimeout(runIntegrity, 0);
})();
