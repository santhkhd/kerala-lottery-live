// app.js - Loads Google Sheet JSON (gviz), renders UI, search & detail view

(() => {
  const sheetId = window.SHEET_ID || ""; // set in index.html before loading this script
  const sheetName = "results";
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;

  // DOM refs
  const grid = document.getElementById("grid");
  const loading = document.getElementById("loading");
  const empty = document.getElementById("empty");
  const searchInput = document.getElementById("search");
  const filterDate = document.getElementById("filter-date");
  const refreshBtn = document.getElementById("refreshBtn");

  // detail view
  const detailView = document.getElementById("detailView");
  const closeDetail = document.getElementById("closeDetail");
  const detailLottery = document.getElementById("detailLottery");
  const detailDate = document.getElementById("detailDate");
  const detailDraw = document.getElementById("detailDraw");
  const detailResult = document.getElementById("detailResult");
  const detailPrizeList = document.getElementById("detailPrizeList");
  const detailNotes = document.getElementById("detailNotes");

  let rows = []; // parsed data
  let filtered = [];

  // util: parse gviz response (it is JSONP-ish)
  function parseGviz(text) {
    // gviz returns "/*O_o*/\ngoogle.visualization.Query.setResponse(...);"
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonText = text.substring(start, end + 1);
    return JSON.parse(jsonText);
  }

  function normalizeCell(cell) {
    // cell may be null
    if (!cell) return "";
    if (cell.v === undefined || cell.v === null) return cell.f || "";
    return cell.v;
  }

  function mapGvizToRows(gviz) {
    const cols = gviz.table.cols.map(c => c.label || c.id || c);
    return gviz.table.rows.map(r => {
      const obj = {};
      cols.forEach((col, i) => {
        obj[col] = normalizeCell(r.c[i]);
      });
      return obj;
    });
  }

  function formatDateForDisplay(isoOrDate) {
    if (!isoOrDate) return "";
    const d = new Date(isoOrDate);
    if (isNaN(d)) {
      // try parsing yyyy-mm-dd manually
      const parts = isoOrDate.split("-");
      if (parts.length === 3) {
        const [y, m, day] = parts;
        return new Date(y, m - 1, day).toLocaleDateString();
      }
      return isoOrDate;
    }
    return d.toLocaleDateString();
  }

  function renderGrid(data) {
    grid.innerHTML = "";
    if (!data.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    data.forEach((item, idx) => {
      const card = document.createElement("article");
      card.className = "card";
      card.setAttribute("tabindex", 0);
      card.dataset.index = idx;

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = item.LotteryName || "Untitled Lottery";

      const big = document.createElement("div");
      big.className = "big-result";
      big.textContent = item.Result || "—";

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<span>${formatDateForDisplay(item.Date)}</span> <span>•</span> <span>Draw: ${item.Draw || "—"}</span>`;

      card.appendChild(title);
      card.appendChild(big);
      card.appendChild(meta);

      // open detail on click or enter
      card.addEventListener("click", () => openDetail(item));
      card.addEventListener("keypress", (e) => {
        if (e.key === "Enter") openDetail(item);
      });

      grid.appendChild(card);
    });
  }

  function openDetail(item) {
    detailLottery.textContent = item.LotteryName || "Lottery";
    detailDate.textContent = `Date: ${formatDateForDisplay(item.Date)}`;
    detailDraw.textContent = item.Draw ? `Draw: ${item.Draw}` : "";
    detailResult.textContent = item.Result || "No result";
    detailPrizeList.textContent = item.PrizeList || "";
    detailNotes.textContent = item.Notes || "";

    detailView.hidden = false;
    document.body.style.overflow = "hidden"; // prevent background scroll
  }

  function closeDetailView() {
    detailView.hidden = true;
    document.body.style.overflow = "";
  }

  // search & filter
  function applyFilters() {
    const q = (searchInput.value || "").trim().toLowerCase();
    const order = filterDate.value;

    filtered = rows.filter(r => {
      if (!q) return true;
      const hay = `${r.LotteryName} ${r.Result} ${r.Date} ${r.Draw} ${r.PrizeList}`.toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    if (order === "latest") {
      filtered.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    } else {
      filtered.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    }

    renderGrid(filtered);
  }

  // fetch sheet, parse and load
  async function loadData() {
    if (!sheetId || sheetId.includes("REPLACE_WITH")) {
      showError("Please set your Google Sheet ID in index.html (window.SHEET_ID).");
      return;
    }

    loading.style.display = "flex";
    empty.hidden = true;
    grid.innerHTML = "";

    try {
      const res = await fetch(gvizUrl);
      const txt = await res.text();
      const parsed = parseGviz(txt);
      const mapped = mapGvizToRows(parsed);

      // normalize: map column names to expected keys
      // User should use headers: Date, LotteryName, Draw, Result, PrizeList, Notes
      rows = mapped.map(r => ({
        Date: r.Date || r.date || r.DATE || "",
        LotteryName: r.LotteryName || r['Lottery Name'] || r.lotteryname || r.LOTTERYNAME || "",
        Draw: r.Draw || r.draw || "",
        Result: r.Result || r.result || "",
        PrizeList: r.PrizeList || r['Prize List'] || r.prizelist || "",
        Notes: r.Notes || r.notes || ""
      }));

      applyFilters();
    } catch (err) {
      console.error(err);
      showError("Unable to load data. Check your Sheet ID, sharing settings, or network.");
    } finally {
      loading.style.display = "none";
    }
  }

  function showError(msg) {
    loading.style.display = "none";
    empty.hidden = false;
    empty.textContent = msg;
  }

  // hooks
  searchInput.addEventListener("input", () => applyFilters());
  filterDate.addEventListener("change", () => applyFilters());
  refreshBtn.addEventListener("click", () => loadData());
  closeDetail.addEventListener("click", closeDetailView);
  detailView.addEventListener("click", (e) => {
    if (e.target === detailView) closeDetailView();
  });

  // initial load (with small delay to show spinner)
  setTimeout(loadData, 200);
})();
