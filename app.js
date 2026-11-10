(function () {
  "use strict";

  const MAX_RESULTS = 150;

  const state = {
    mult: null,   // net multiplier 0-1, or null = list only
    quote: [],    // {recordId, qty, mult}
  };

  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => Array.from(document.querySelectorAll(sel));
  const fmt = (n) => (n == null || isNaN(n)) ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const round2 = (n) => Math.round(n * 100) / 100;
  const round4 = (n) => Math.round(n * 10000) / 10000;
  const validMult = (m) => m != null && !isNaN(m) && m > 0 && m <= 1;

  // ---------- header / meta ----------
  $("#sourceLine").innerHTML =
    `<b>${CAT_META.record_count.toLocaleString()}</b> priceable line items · tariff-inclusive list prices · cross-referenced where possible to <b>${CAT_META.source_pdf}</b> (${CAT_META.pdf_pages} pages) · generated ${CAT_META.generated}`;
  $("#pageCoveragePct").textContent = CAT_META.pdf_page_hint_coverage_pct + "%";

  // ---------- tabs ----------
  function showPanel(id) {
    $all(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.panel === id));
    $all(".panel").forEach(p => p.classList.toggle("active", p.id === id));
  }
  $all(".tab-btn").forEach(btn => btn.addEventListener("click", () => showPanel(btn.dataset.panel)));

  // ---------- global multiplier / % boxes ----------
  const multInput = $("#multInput"), pctInput = $("#pctInput");
  multInput.addEventListener("input", () => {
    const m = parseFloat(multInput.value);
    if (validMult(m)) {
      state.mult = m;
      pctInput.value = round4((1 - m) * 100);
    } else {
      state.mult = null;
      pctInput.value = "";
    }
    runSearch();
  });
  pctInput.addEventListener("input", () => {
    const p = parseFloat(pctInput.value);
    if (!isNaN(p) && p >= 0 && p < 100) {
      state.mult = round4(1 - p / 100);
      multInput.value = state.mult;
    } else {
      state.mult = null;
      multInput.value = "";
    }
    runSearch();
  });

  // ---------- pricing helpers ----------
  function netFor(record, mult) {
    return validMult(mult) ? round2(record.list * mult) : null;
  }

  function pageHintHTML(record) {
    if (record.pdfPages && record.pdfPages.length) {
      const label = record.pdfPages.length === 1 ? `Catalog p.${record.pdfPages[0]}` : `Catalog pp.${record.pdfPages.join(",")}`;
      return `<span class="page-hint found">${label}</span>`;
    }
    return `<span class="page-hint missing">Not located in PDF — verify</span>`;
  }

  function flagHTML(record) {
    if (!record.flag) return "";
    const label = record.flag.t === "unverified" ? "⚠ Unverified price" : "⚠ Source data conflict";
    return `<div><span class="flag-badge ${record.flag.t}" title="${escapeHTML(record.flag.note)}">${label}</span></div>` +
           `<div class="flag-note">${escapeHTML(record.flag.note)}</div>`;
  }

  // ---------- section filter ----------
  const sectionFilter = $("#sectionFilter");
  Array.from(new Set(CAT_DATA.map(r => r.section))).sort().forEach(s => {
    const opt = document.createElement("option");
    opt.value = s; opt.textContent = s;
    sectionFilter.appendChild(opt);
  });
  sectionFilter.addEventListener("change", runSearch);

  // ---------- search ----------
  const searchInput = $("#searchInput");
  searchInput.addEventListener("input", runSearch);

  function matches(record, q) {
    if (!q) return true;
    const hay = (record.part + " " + record.desc + " " + record.context.join(" ") + " " + record.section).toLowerCase();
    return q.split(/\s+/).every(term => hay.includes(term));
  }

  function runSearch() {
    const q = searchInput.value.trim().toLowerCase();
    const sec = sectionFilter.value;
    let list = CAT_DATA;
    if (sec) list = list.filter(r => r.section === sec);
    if (q) list = list.filter(r => matches(r, q));

    const meta = $("#resultsMeta");
    const results = $("#results");

    if (!q && !sec) {
      meta.textContent = `Type a part number, description, or keyword to search ${CAT_DATA.length.toLocaleString()} line items (or pick a section).`;
      results.innerHTML = "";
      return;
    }

    const total = list.length;
    const shown = list.slice(0, MAX_RESULTS);
    meta.textContent = total > MAX_RESULTS
      ? `Showing first ${MAX_RESULTS} of ${total.toLocaleString()} matches — refine your search.`
      : `${total.toLocaleString()} match${total === 1 ? "" : "es"}.`;

    results.innerHTML = shown.map(cardHTML).join("");

    $all(".add-to-quote-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id, 10);
        const qtyInput = document.querySelector(`.qty-input[data-id="${id}"]`);
        addToQuote(id, Math.max(1, parseInt(qtyInput.value, 10) || 1));
      });
    });
  }

  function cardHTML(r) {
    const net = netFor(r, state.mult);
    return `
    <div class="card">
      <div class="card-head">
        <span class="part-no">${escapeHTML(r.part)}</span>
        <span class="section-pill">${escapeHTML(r.section)}</span>
      </div>
      <div class="card-body">
        <div class="desc">
          ${escapeHTML(r.desc || "(no description)")}
          <div class="context-line">${r.context.slice(-2).map(escapeHTML).join(" › ")}</div>
          ${flagHTML(r)}
        </div>
        <div class="price-grid">
          <div class="price-col">
            <div class="plabel">List</div>
            <div class="pval">${fmt(r.list)}</div>
          </div>
          <div class="price-col net">
            <div class="plabel">${validMult(state.mult) ? "Net (×" + state.mult + ")" : "Net"}</div>
            <div class="pval">${net != null ? fmt(net) : "—"}</div>
          </div>
        </div>
        <div class="add-controls">
          ${pageHintHTML(r)}
          <input type="number" class="qty-input" data-id="${r.id}" value="1" min="1">
          <button class="btn small add-to-quote-btn" data-id="${r.id}">Add to Quote</button>
        </div>
      </div>
    </div>`;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- quote ----------
  function addToQuote(recordId, qty) {
    state.quote.push({ recordId, qty, mult: state.mult });
    renderQuote();
    showToast("Added to quote");
    showPanel("panel-quote");
  }

  function renderQuote() {
    const body = $("#quoteBody");
    const empty = $("#quoteEmpty");
    const wrap = $("#quoteTableWrap");

    if (state.quote.length === 0) {
      empty.style.display = "block";
      wrap.style.display = "none";
      updateTotals();
      return;
    }
    empty.style.display = "none";
    wrap.style.display = "block";

    body.innerHTML = state.quote.map((line, idx) => {
      const r = CAT_DATA[line.recordId];
      const net = netFor(r, line.mult);
      const ext = net != null ? round2(net * line.qty) : null;
      const flag = r.flag ? `<div><span class="flag-badge ${r.flag.t}" title="${escapeHTML(r.flag.note)}">⚠ ${r.flag.t === "unverified" ? "Unverified" : "Source conflict"}</span></div>` : "";
      return `<tr data-row="${idx}">
        <td>${idx + 1}</td>
        <td><input type="number" class="qb-qty" data-idx="${idx}" value="${line.qty}" min="1"></td>
        <td class="part-no">${escapeHTML(r.part)}</td>
        <td>${escapeHTML(r.desc)}${flag}</td>
        <td class="num">${fmt(r.list)}</td>
        <td><input type="number" class="qb-mult" data-idx="${idx}" value="${line.mult != null ? line.mult : ""}" min="0" max="1" step="0.0001" placeholder="list"></td>
        <td class="num qb-net-cell">${net != null ? fmt(net) : "—"}</td>
        <td class="num qb-ext-cell">${ext != null ? fmt(ext) : "—"}</td>
        <td><button class="btn danger small qb-remove" data-idx="${idx}">✕</button></td>
      </tr>`;
    }).join("");

    // in-place updates so typing doesn't lose focus
    $all(".qb-qty").forEach(inp => inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      state.quote[idx].qty = Math.max(1, parseInt(e.target.value, 10) || 1);
      updateRowCells(idx);
    }));
    $all(".qb-mult").forEach(inp => inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const m = parseFloat(e.target.value);
      state.quote[idx].mult = validMult(m) ? m : null;
      updateRowCells(idx);
    }));
    $all(".qb-remove").forEach(btn => btn.addEventListener("click", (e) => {
      state.quote.splice(parseInt(e.target.dataset.idx, 10), 1);
      renderQuote();
    }));

    updateTotals();
  }

  function updateRowCells(idx) {
    const line = state.quote[idx];
    const r = CAT_DATA[line.recordId];
    const net = netFor(r, line.mult);
    const ext = net != null ? round2(net * line.qty) : null;
    const row = document.querySelector(`tr[data-row="${idx}"]`);
    if (row) {
      row.querySelector(".qb-net-cell").textContent = net != null ? fmt(net) : "—";
      row.querySelector(".qb-ext-cell").textContent = ext != null ? fmt(ext) : "—";
    }
    updateTotals();
  }

  function updateTotals() {
    let listTot = 0, netTot = 0;
    state.quote.forEach(line => {
      const r = CAT_DATA[line.recordId];
      const net = netFor(r, line.mult);
      listTot += r.list * line.qty;
      netTot += (net != null ? net : r.list) * line.qty;
    });
    $("#totListVal").textContent = fmt(listTot);
    $("#totSavingsVal").textContent = fmt(listTot - netTot);
    $("#totNetVal").textContent = fmt(netTot);
  }

  $("#clearQuoteBtn").addEventListener("click", () => {
    if (state.quote.length && !confirm("Clear all quote lines?")) return;
    state.quote = [];
    renderQuote();
  });

  $("#printQuoteBtn").addEventListener("click", () => window.print());

  $("#csvQuoteBtn").addEventListener("click", () => {
    const rows = [["Qty", "Part", "Description", "List", "Multiplier", "Net Unit", "Ext. Net", "Note"]];
    state.quote.forEach(line => {
      const r = CAT_DATA[line.recordId];
      const net = netFor(r, line.mult);
      rows.push([line.qty, r.part, r.desc, r.list, line.mult != null ? line.mult : "", net != null ? net : "", net != null ? round2(net * line.qty) : "", r.flag ? r.flag.note : ""]);
    });
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    navigator.clipboard.writeText(csv).then(() => showToast("Quote copied as CSV"));
  });

  function showToast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 1800);
  }

  // ---------- discount calculator ----------
  const calcMult = $("#calcMult"), calcPct = $("#calcPct"), calcList = $("#calcList"), calcNet = $("#calcNet");
  function updateCalcNet() {
    const m = parseFloat(calcMult.value), l = parseFloat(calcList.value);
    calcNet.textContent = (validMult(m) && !isNaN(l)) ? fmt(round2(l * m)) : "—";
  }
  calcMult.addEventListener("input", () => {
    const m = parseFloat(calcMult.value);
    calcPct.value = validMult(m) ? round4((1 - m) * 100) : "";
    updateCalcNet();
  });
  calcPct.addEventListener("input", () => {
    const p = parseFloat(calcPct.value);
    calcMult.value = (!isNaN(p) && p >= 0 && p < 100) ? round4(1 - p / 100) : "";
    updateCalcNet();
  });
  calcList.addEventListener("input", updateCalcNet);

  renderQuote();
})();
