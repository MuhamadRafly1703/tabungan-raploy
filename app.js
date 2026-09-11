/* ===========================================================
   TABUNGAN RAFLY — app.js
   Semua logic aplikasi: state, kalkulasi, render, form, dsb.
   Tidak ada backend — semua data di localStorage.
   =========================================================== */

(function () {
"use strict";

/* ===================== UTIL ===================== */
const STORAGE_KEY = "tabunganRaflyData";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function nowTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}
function fmtRupiah(n) {
  n = Math.round(Number(n) || 0);
  return "Rp" + n.toLocaleString("id-ID");
}
function parseNum(v) {
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}
function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function daysBetween(a, b) {
  const A = new Date(a + "T00:00:00"), B = new Date(b + "T00:00:00");
  return Math.round((B - A) / 86400000);
}
function esc(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* ===================== DEFAULT STATE ===================== */
function defaultState() {
  return {
    accounts: [
      { id: "acc-tunai", name: "Tunai", type: "Tunai", balance: 800000, note: "" }
    ],
    incomes: [],
    expenses: [],
    pockets: [
      { id: uid(), name: "Hutang", target: 0, balance: 0, accountId: "acc-tunai", targetDate: "", note: "" },
      { id: uid(), name: "Kuliah", target: 0, balance: 0, accountId: "acc-tunai", targetDate: "", note: "" },
      { id: uid(), name: "Laptop", target: 0, balance: 0, accountId: "acc-tunai", targetDate: "", note: "" },
      { id: uid(), name: "Pasangan/Lainnya", target: 0, balance: 0, accountId: "acc-tunai", targetDate: "", note: "" },
      { id: uid(), name: "Kebutuhan Harian", target: 0, balance: 0, accountId: "acc-tunai", targetDate: "", note: "" },
      { id: uid(), name: "Dana Darurat", target: 0, balance: 0, accountId: "acc-tunai", targetDate: "", note: "" },
      { id: uid(), name: "Cadangan", target: 0, balance: 0, accountId: "acc-tunai", targetDate: "", note: "" }
    ],
    futureGoals: [],
    debts: [
      { id: uid(), name: "Hutang jatuh tempo tgl 13", amount: 325000, paidAmount: 0, dueDate: "", note: "" },
      { id: uid(), name: "Hutang jatuh tempo tgl 19", amount: 250000, paidAmount: 0, dueDate: "", note: "" },
      { id: uid(), name: "Kuliah - UTS", amount: 1000000, paidAmount: 0, dueDate: "", note: "" },
      { id: uid(), name: "Kuliah - UAS", amount: 1500000, paidAmount: 0, dueDate: "", note: "" }
    ],
    allocations: [],
    budgetMoves: [],
    settings: {
      initialBalance: 800000,
      initialBalanceNote: "Saldo awal masih bercampur (bensin, makan, tabungan, hutang)",
      dailyBudgetAmount: 30000,
      allocationPercents: { debt: 45, needs: 25, college: 15, laptop: 5, future: 5, partner: 5 }
    },
    transactions: []
  };
}

/* ===================== STORE ===================== */
const Store = {
  state: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.state = raw ? JSON.parse(raw) : defaultState();
      if (!this.state.accounts || !this.state.accounts.length) this.state = defaultState();
    } catch (e) {
      this.state = defaultState();
    }
    return this.state;
  },
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },
  get() { return this.state; }
};

/* pastikan pocket/goal tertentu ada (untuk hasil pembagian uang) */
function ensurePocketByName(name) {
  const s = Store.get();
  let p = s.pockets.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!p) {
    p = { id: uid(), name, target: 0, balance: 0, accountId: s.accounts[0] ? s.accounts[0].id : "", targetDate: "", note: "" };
    s.pockets.push(p);
  }
  return p;
}
function ensureFutureGoal(name) {
  const s = Store.get();
  let g = s.futureGoals.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!g) {
    g = { id: uid(), name, target: 0, balance: 0, accountId: s.accounts[0] ? s.accounts[0].id : "", startDate: todayISO(), targetDate: "", note: "" };
    s.futureGoals.push(g);
  }
  return g;
}

function addTransaction(t) {
  const s = Store.get();
  s.transactions.unshift(Object.assign({
    id: uid(), date: todayISO(), time: nowTime()
  }, t));
}

/* ===================== KALKULASI ===================== */
function sumBy(arr, fn) { return arr.reduce((a, x) => a + (fn(x) || 0), 0); }

function totalAccounts() { return sumBy(Store.get().accounts, (a) => a.balance); }
function totalPockets() { return sumBy(Store.get().pockets, (p) => p.balance); }
function totalFuture() { return sumBy(Store.get().futureGoals, (g) => g.balance); }
function totalAll() { return totalAccounts() + totalPockets() + totalFuture(); }
function usableBalance() { return totalAccounts() + totalPockets(); }

function incomesOn(date) { return Store.get().incomes.filter((i) => i.date === date); }
function expensesOn(date, kind) {
  return Store.get().expenses.filter((e) => e.date === date && (!kind || e.kind === kind));
}
function grossOn(date) { return sumBy(incomesOn(date), (i) => i.amount); }
function workExpOn(date) { return sumBy(expensesOn(date, "work"), (e) => e.amount); }
function dailyExpOn(date) { return sumBy(expensesOn(date, "daily"), (e) => e.amount); }
function netOn(date) { return grossOn(date) - workExpOn(date); }

function lastNDays(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function totalUnallocated() {
  const s = Store.get();
  const totalIncome = sumBy(s.incomes, (i) => i.amount);
  const totalWork = sumBy(s.expenses.filter((e) => e.kind === "work"), (e) => e.amount);
  const totalAllocated = sumBy(s.allocations, (a) => a.netAmount);
  return Math.max(0, totalIncome - totalWork - totalAllocated);
}

function totalDebtUnpaid() {
  return sumBy(Store.get().debts, (d) => Math.max(0, d.amount - d.paidAmount));
}
function debtStatus(d) {
  if (d.paidAmount >= d.amount) return "lunas";
  if (d.paidAmount > 0) return "sebagian";
  return "belum";
}

function budgetUsedToday() { return dailyExpOn(todayISO()); }
function budgetMovedToday() {
  return sumBy(Store.get().budgetMoves.filter((m) => m.date === todayISO()), (m) => m.amount);
}
function budgetRemainingToday() {
  const s = Store.get();
  return Math.max(0, s.settings.dailyBudgetAmount - budgetUsedToday() - budgetMovedToday());
}

/* ===================== TOAST ===================== */
function toast(msg, type) {
  const c = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.remove(); }, 2800);
}

/* ===================== CONFIRM DIALOG ===================== */
function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirmOverlay");
    document.getElementById("confirmMessage").textContent = message;
    overlay.classList.add("open");
    const ok = document.getElementById("confirmOk");
    const cancel = document.getElementById("confirmCancel");
    function cleanup(result) {
      overlay.classList.remove("open");
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
  });
}

/* ===================== SHEET (bottom sheet form) ===================== */
function openSheet(title, bodyHtml, onMount) {
  document.getElementById("sheetTitle").textContent = title;
  document.getElementById("sheetBody").innerHTML = bodyHtml;
  document.getElementById("sheetOverlay").classList.add("open");
  if (onMount) onMount(document.getElementById("sheetBody"));
}
function closeSheet() {
  document.getElementById("sheetOverlay").classList.remove("open");
  document.getElementById("sheetBody").innerHTML = "";
}

/* opsi <option> rekening */
function accountOptions(selectedId) {
  return Store.get().accounts.map((a) =>
    `<option value="${a.id}" ${a.id === selectedId ? "selected" : ""}>${esc(a.name)} (${fmtRupiah(a.balance)})</option>`
  ).join("");
}

/* ===================== FORM: PEMASUKAN ===================== */
function openAddIncome() {
  const s = Store.get();
  openSheet("Tambah Pemasukan", `
    <div class="form-group"><label>Tanggal</label><input type="date" id="fDate" value="${todayISO()}"></div>
    <div class="form-group"><label>Sumber pemasukan</label>
      <select id="fSource">
        <option>Shopee Hub</option><option>Shopee Reguler</option><option>Freelance</option>
        <option>Jualan</option><option>Bonus</option><option>Lainnya</option>
      </select>
    </div>
    <div class="form-group"><label>Nominal</label><input type="number" min="1" id="fAmount" placeholder="0"></div>
    <div class="form-group"><label>Rekening tujuan</label><select id="fAccount">${accountOptions(s.accounts[0] && s.accounts[0].id)}</select></div>
    <div class="form-group"><label>Catatan (opsional)</label><input type="text" id="fNote" placeholder="Contoh: shift pagi"></div>
    <div class="form-error" id="fError">Nominal harus lebih dari 0.</div>
    <button class="btn btn-primary btn-block" id="fSubmit">Simpan pemasukan</button>
  `, () => {
    document.getElementById("fSubmit").onclick = () => {
      const amount = parseNum(document.getElementById("fAmount").value);
      const date = document.getElementById("fDate").value || todayISO();
      const accountId = document.getElementById("fAccount").value;
      if (amount <= 0 || !accountId) { document.getElementById("fError").classList.add("show"); return; }
      const income = {
        id: uid(), date, time: nowTime(),
        source: document.getElementById("fSource").value,
        amount, accountId,
        note: document.getElementById("fNote").value.trim()
      };
      Store.get().incomes.push(income);
      const acc = s.accounts.find((a) => a.id === accountId);
      if (acc) acc.balance += amount;
      addTransaction({ type: "income", label: "Pemasukan - " + income.source, accountId, amount, direction: "in", note: income.note });
      Store.save(); closeSheet(); renderAll();
      toast("Pemasukan tersimpan", "success");
    };
  });
}

/* ===================== FORM: PENGELUARAN ===================== */
function openAddExpense(kind) {
  const s = Store.get();
  const cats = kind === "work"
    ? ["Bensin", "Makan saat kerja", "Parkir", "Kuota/internet", "Perawatan kendaraan", "Lainnya"]
    : ["Makan pribadi", "Belanja", "Keperluan kecil", "Pasangan", "Kebutuhan rumah", "Lainnya"];
  openSheet(kind === "work" ? "Pengeluaran Kerja" : "Pengeluaran Harian", `
    <div class="form-group"><label>Tanggal</label><input type="date" id="fDate" value="${todayISO()}"></div>
    <div class="form-group"><label>Kategori</label><select id="fCategory">${cats.map((c) => `<option>${c}</option>`).join("")}</select></div>
    <div class="form-group"><label>Nominal</label><input type="number" min="1" id="fAmount" placeholder="0"></div>
    <div class="form-group"><label>Rekening</label><select id="fAccount">${accountOptions(s.accounts[0] && s.accounts[0].id)}</select></div>
    <div class="form-group"><label>Catatan (opsional)</label><input type="text" id="fNote"></div>
    <div class="form-error" id="fError">Nominal tidak valid atau saldo rekening tidak cukup.</div>
    <button class="btn btn-primary btn-block" id="fSubmit">Simpan pengeluaran</button>
  `, () => {
    document.getElementById("fSubmit").onclick = () => {
      const amount = parseNum(document.getElementById("fAmount").value);
      const accountId = document.getElementById("fAccount").value;
      const acc = s.accounts.find((a) => a.id === accountId);
      if (amount <= 0 || !acc || acc.balance < amount) { document.getElementById("fError").classList.add("show"); return; }
      const exp = {
        id: uid(), date: document.getElementById("fDate").value || todayISO(), time: nowTime(),
        kind, category: document.getElementById("fCategory").value, amount, accountId,
        note: document.getElementById("fNote").value.trim()
      };
      s.expenses.push(exp);
      acc.balance -= amount;
      addTransaction({ type: kind === "work" ? "work_expense" : "daily_expense", label: exp.category, accountId, amount, direction: "out", note: exp.note });
      Store.save(); closeSheet(); renderAll();
      toast("Pengeluaran tersimpan", "success");
    };
  });
}

/* ===================== FORM: BUDGET HARIAN ===================== */
function openEditBudget() {
  const s = Store.get();
  openSheet("Atur Budget Harian", `
    <div class="form-group"><label>Budget harian</label><input type="number" min="0" id="fBudget" value="${s.settings.dailyBudgetAmount}"></div>
    <button class="btn btn-primary btn-block" id="fSubmit">Simpan</button>
  `, () => {
    document.getElementById("fSubmit").onclick = () => {
      s.settings.dailyBudgetAmount = parseNum(document.getElementById("fBudget").value);
      Store.save(); closeSheet(); renderAll(); toast("Budget harian diperbarui", "success");
    };
  });
}

function openMoveToPocket() {
  const s = Store.get();
  const remaining = budgetRemainingToday();
  if (remaining <= 0) { toast("Tidak ada sisa budget untuk dipindahkan", "error"); return; }
  openSheet("Pindahkan Sisa ke Kantong", `
    <p class="muted-text">Sisa budget hari ini: <strong>${fmtRupiah(remaining)}</strong></p>
    <div class="form-group"><label>Kantong tujuan</label><select id="fPocket">${s.pockets.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
    <div class="form-group"><label>Nominal</label><input type="number" min="1" max="${remaining}" id="fAmount" value="${remaining}"></div>
    <div class="form-error" id="fError">Nominal melebihi sisa budget.</div>
    <button class="btn btn-primary btn-block" id="fSubmit">Pindahkan</button>
  `, () => {
    document.getElementById("fSubmit").onclick = () => {
      const amount = parseNum(document.getElementById("fAmount").value);
      if (amount <= 0 || amount > remaining) { document.getElementById("fError").classList.add("show"); return; }
      const pocket = s.pockets.find((p) => p.id === document.getElementById("fPocket").value);
      pocket.balance += amount;
      s.budgetMoves.push({ id: uid(), date: todayISO(), amount, pocketId: pocket.id });
      addTransaction({ type: "pocket_in", label: "Sisa harian -> " + pocket.name, pocketId: pocket.id, amount, direction: "out", note: "Dari sisa budget harian" });
      Store.save(); closeSheet(); renderAll();
      toast("Sisa budget dipindahkan ke kantong", "success");
    };
  });
}

/* ===================== FORM: PEMBAGIAN UANG ===================== */
function openAllocate() {
  const s = Store.get();
  const available = totalUnallocated();
  if (available <= 0) { toast("Belum ada pendapatan bersih untuk dibagi", "error"); return; }
  const p = s.settings.allocationPercents;
  const rows = [
    { key: "debt", label: "Hutang" },
    { key: "needs", label: "Kebutuhan kerja/harian" },
    { key: "college", label: "Kuliah" },
    { key: "laptop", label: "Laptop" },
    { key: "future", label: "Tabungan Masa Depan" },
    { key: "partner", label: "Pasangan/Lainnya" }
  ];
  openSheet("Bagi Pendapatan Bersih", `
    <div class="form-group"><label>Pendapatan bersih yang dibagi</label>
      <input type="number" min="1" max="${available}" id="fNet" value="${available}">
      <div class="form-hint">Maksimal sisa belum dibagi: ${fmtRupiah(available)}</div>
    </div>
    <div id="allocRows"></div>
    <div class="allocation-total" id="allocTotalRow"><span>Total persentase</span><span id="allocTotalPct">100%</span></div>
    <div class="form-error" id="fError">Total persentase harus 100% dan nominal harus valid.</div>
    <button class="btn btn-primary btn-block" id="fSubmit" style="margin-top:14px;">Konfirmasi Pembagian</button>
  `, () => {
    const rowsEl = document.getElementById("allocRows");
    function renderRows() {
      const net = parseNum(document.getElementById("fNet").value);
      rowsEl.innerHTML = rows.map((r) => {
        const pct = p[r.key];
        const amt = Math.round(net * pct / 100);
        return `<div class="allocation-row" data-key="${r.key}">
          <span class="a-label">${r.label}</span>
          <input type="number" min="0" max="100" class="a-pct" value="${pct}">
          <span>%</span>
          <span class="a-amount">${fmtRupiah(amt)}</span>
        </div>`;
      }).join("");
      updateTotal();
    }
    function updateTotal() {
      let total = 0;
      rowsEl.querySelectorAll(".allocation-row").forEach((row) => {
        total += parseNum(row.querySelector(".a-pct").value);
      });
      const totalEl = document.getElementById("allocTotalPct");
      const totalRow = document.getElementById("allocTotalRow");
      totalEl.textContent = total + "%";
      totalRow.classList.toggle("error", total !== 100);
      return total;
    }
    renderRows();
    document.getElementById("fNet").addEventListener("input", renderRows);
    rowsEl.addEventListener("input", (e) => {
      if (e.target.classList.contains("a-pct")) {
        const net = parseNum(document.getElementById("fNet").value);
        const row = e.target.closest(".allocation-row");
        const pct = parseNum(e.target.value);
        row.querySelector(".a-amount").textContent = fmtRupiah(Math.round(net * pct / 100));
        updateTotal();
      }
    });

    document.getElementById("fSubmit").onclick = () => {
      const net = parseNum(document.getElementById("fNet").value);
      const total = updateTotal();
      if (net <= 0 || net > available || total !== 100) {
        document.getElementById("fError").classList.add("show"); return;
      }
      const breakdown = {};
      rowsEl.querySelectorAll(".allocation-row").forEach((row) => {
        const key = row.dataset.key;
        const pct = parseNum(row.querySelector(".a-pct").value);
        breakdown[key] = Math.round(net * pct / 100);
      });
      // simpan persentase baru sebagai default berikutnya
      rows.forEach((r) => { s.settings.allocationPercents[r.key] = parseNum(rowsEl.querySelector(`[data-key="${r.key}"] .a-pct`).value); });

      Object.keys(breakdown).forEach((key) => {
        const amt = breakdown[key];
        if (amt <= 0) return;
        if (key === "future") {
          const goal = ensureFutureGoal("Dana Masa Depan");
          goal.balance += amt;
          addTransaction({ type: "future_in", label: "Setoran Masa Depan (pembagian)", amount: amt, direction: "out", note: "Dari pembagian pendapatan bersih" });
        } else {
          const nameMap = { debt: "Hutang", needs: "Kebutuhan Harian", college: "Kuliah", laptop: "Laptop", partner: "Pasangan/Lainnya" };
          const pocket = ensurePocketByName(nameMap[key]);
          pocket.balance += amt;
          addTransaction({ type: "pocket_in", label: "Masuk kantong " + pocket.name, pocketId: pocket.id, amount: amt, direction: "out", note: "Dari pembagian pendapatan bersih" });
        }
      });
      s.allocations.push({ id: uid(), date: todayISO(), netAmount: net, breakdown });
      Store.save(); closeSheet(); renderAll();
      toast("Pembagian uang berhasil dikonfirmasi", "success");
    };
  });
}

/* ===================== FORM: KANTONG ===================== */
function openAddPocket() {
  const s = Store.get();
  openSheet("Kantong Baru", `
    <div class="form-group"><label>Nama kantong</label><input type="text" id="fName" placeholder="Contoh: Laptop"></div>
    <div class="form-group"><label>Target nominal (opsional)</label><input type="number" min="0" id="fTarget" placeholder="0"></div>
    <div class="form-group"><label>Rekening penyimpanan</label><select id="fAccount">${accountOptions(s.accounts[0] && s.accounts[0].id)}</select></div>
    <div class="form-group"><label>Tanggal target (opsional)</label><input type="date" id="fDate"></div>
    <div class="form-group"><label>Catatan (opsional)</label><input type="text" id="fNote"></div>
    <div class="form-error" id="fError">Nama kantong wajib diisi.</div>
    <button class="btn btn-primary btn-block" id="fSubmit">Buat kantong</button>
  `, () => {
    document.getElementById("fSubmit").onclick = () => {
      const name = document.getElementById("fName").value.trim();
      if (!name) { document.getElementById("fError").classList.add("show"); return; }
      s.pockets.push({
        id: uid(), name, target: parseNum(document.getElementById("fTarget").value), balance: 0,
        accountId: document.getElementById("fAccount").value, targetDate: document.getElementById("fDate").value, note: document.getElementById("fNote").value.trim()
      });
      Store.save(); closeSheet(); renderAll(); toast("Kantong dibuat", "success");
    };
  });
}

function openPocketAction(pocket, mode) {
  // mode: 'in' | 'out' | 'edit'
  const s = Store.get();
  if (mode === "edit") {
    openSheet("Edit Kantong", `
      <div class="form-group"><label>Nama kantong</label><input type="text" id="fName" value="${esc(pocket.name)}"></div>
      <div class="form-group"><label>Target nominal</label><input type="number" min="0" id="fTarget" value="${pocket.target}"></div>
      <div class="form-group"><label>Tanggal target</label><input type="date" id="fDate" value="${pocket.targetDate || ""}"></div>
      <div class="form-group"><label>Catatan</label><input type="text" id="fNote" value="${esc(pocket.note || "")}"></div>
      <button class="btn btn-primary btn-block" id="fSubmit">Simpan perubahan</button>
      <button class="btn btn-danger btn-block" id="fDelete" style="margin-top:8px;">Hapus kantong</button>
    `, () => {
      document.getElementById("fSubmit").onclick = () => {
        pocket.name = document.getElementById("fName").value.trim() || pocket.name;
        pocket.target = parseNum(document.getElementById("fTarget").value);
        pocket.targetDate = document.getElementById("fDate").value;
        pocket.note = document.getElementById("fNote").value.trim();
        Store.save(); closeSheet(); renderAll(); toast("Kantong diperbarui", "success");
      };
      document.getElementById("fDelete").onclick = async () => {
        if (pocket.balance > 0) { toast("Kosongkan saldo kantong dulu sebelum menghapus", "error"); return; }
        const ok = await confirmDialog(`Hapus kantong "${pocket.name}"? Tindakan ini tidak bisa dibatalkan.`);
        if (!ok) return;
        s.pockets = s.pockets.filter((p) => p.id !== pocket.id);
        Store.save(); closeSheet(); renderAll(); toast("Kantong dihapus", "success");
      };
    });
    return;
  }
  const isIn = mode === "in";
  openSheet(isIn ? "Tambah Uang ke Kantong" : "Ambil Uang dari Kantong", `
    <p class="muted-text">Saldo kantong "${esc(pocket.name)}": <strong>${fmtRupiah(pocket.balance)}</strong></p>
    <div class="form-group"><label>Rekening</label><select id="fAccount">${accountOptions(pocket.accountId)}</select></div>
    <div class="form-group"><label>Nominal</label><input type="number" min="1" id="fAmount" placeholder="0"></div>
    <div class="form-error" id="fError">Nominal tidak valid.</div>
    <button class="btn btn-primary btn-block" id="fSubmit">${isIn ? "Tambah" : "Ambil"}</button>
  `, () => {
    document.getElementById("fSubmit").onclick = () => {
      const amount = parseNum(document.getElementById("fAmount").value);
      const accountId = document.getElementById("fAccount").value;
      const acc = s.accounts.find((a) => a.id === accountId);
      if (amount <= 0 || !acc) { document.getElementById("fError").classList.add("show"); return; }
      if (isIn) {
        if (acc.balance < amount) { document.getElementById("fError").classList.add("show"); return; }
        acc.balance -= amount; pocket.balance += amount;
        addTransaction({ type: "pocket_in", label: "Masuk kantong " + pocket.name, accountId, pocketId: pocket.id, amount, direction: "out" });
      } else {
        if (pocket.balance < amount) { document.getElementById("fError").classList.add("show"); return; }
        pocket.balance -= amount; acc.balance += amount;
        addTransaction({ type: "pocket_out", label: "Keluar kantong " + pocket.name, accountId, pocketId: pocket.id, amount, direction: "in" });
      }
      Store.save(); closeSheet(); renderAll();
      toast(isIn ? "Uang ditambahkan ke kantong" : "Uang diambil dari kantong", "success");
    };
  });
}

/* ===================== FORM: REKENING ===================== */
function openAddAccount() {
  openSheet("Rekening Baru", `
    <div class="form-group"><label>Nama rekening</label><input type="text" id="fName" placeholder="Contoh: BCA"></div>
    <div class="form-group"><label>Jenis</label>
      <select id="fType"><option>BCA</option><option>BRI</option><option>Bank Jago</option><option>SeaBank</option><option>DANA</option><option>Tunai</option><option>Lainnya</option></select>
    </div>
    <div class="form-group"><label>Saldo awal</label><input type="number" min="0" id="fBalance" value="0"></div>
    <div class="form-group"><label>Catatan (opsional)</label><input type="text" id="fNote"></div>
    <div class="form-error" id="fError">Nama rekening wajib diisi.</div>
    <button class="btn btn-primary btn-block" id="fSubmit">Simpan rekening</button>
  `, () => {
    document.getElementById("fSubmit").onclick = () => {
      const name = document.getElementById("fName").value.trim();
      if (!name) { document.getElementById("fError").classList.add("show"); return; }
      Store.get().accounts.push({
        id: uid(), name, type: document.getElementById("fType").value,
        balance: parseNum(document.getElementById("fBalance").value), note: document.getElementById("fNote").value.trim()
      });
      Store.save(); closeSheet(); renderAll(); toast("Rekening ditambahkan", "success");
    };
  });
}

/* ===================== FORM: HUTANG ===================== */
function openAddDebt() {
  openSheet("Tagihan / Hutang Baru", `
    <div class="form-group"><label>Nama</label><input type="text" id="fName" placeholder="Contoh: Cicilan HP"></div>
    <div class="form-group"><label>Nominal</label><input type="number" min="1" id="fAmount" placeholder="0"></div>
    <div class="form-group"><label>Jatuh tempo (opsional)</label><input type="date" id="fDate"></div>
    <div class="form-group"><label>Catatan (opsional)</label><input type="text" id="fNote"></div>
    <div class="form-error" id="fError">Nama dan nominal wajib diisi.</div>
    <button class="btn btn-primary btn-block" id="fSubmit">Simpan</button>
  `, () => {
    document.getElementById("fSubmit").onclick = () => {
      const name = document.getElementById("fName").value.trim();
      const amount = parseNum(document.getElementById("fAmount").value);
      if (!name || amount <= 0) { document.getElementById("fError").classList.add("show"); return; }
      Store.get().debts.push({ id: uid(), name, amount, paidAmount: 0, dueDate: document.getElementById("fDate").value, note: document.getElementById("fNote").value.trim() });
      Store.save(); closeSheet(); renderAll(); toast("Tagihan ditambahkan", "success");
    };
  });
}

function openPayDebt(debt) {
  const s = Store.get();
  const remaining = debt.amount - debt.paidAmount;
  openSheet("Bayar Hutang", `
    <p class="muted-text">${esc(debt.name)} — sisa: <strong>${fmtRupiah(remaining)}</strong></p>
    <div class="form-group"><label>Rekening sumber</label><select id="fAccount">${accountOptions(s.accounts[0] && s.accounts[0].id)}</select></div>
    <div class="form-group"><label>Nominal bayar</label><input type="number" min="1" max="${remaining}" id="fAmount" value="${remaining}"></div>
    <div class="form-error" id="fError">Nominal tidak valid atau saldo tidak cukup.</div>
    <button class="btn btn-primary btn-block" id="fSubmit">Bayar</button>
  `, () => {
    document.getElementById("fSubmit").onclick = () => {
      const amount = parseNum(document.getElementById("fAmount").value);
      const acc = s.accounts.find((a) => a.id === document.getElementById("fAccount").value);
      if (amount <= 0 || amount > remaining || !acc || acc.balance < amount) { document.getElementById("fError").classList.add("show"); return; }
      acc.balance -= amount; debt.paidAmount += amount;
      addTransaction({ type: "debt_payment", label: "Bayar hutang: " + debt.name, accountId: acc.id, amount, direction: "out" });
      Store.save(); closeSheet(); renderAll(); toast("Pembayaran tercatat", "success");
    };
  });
}

/* ===================== FORM: TABUNGAN MASA DEPAN ===================== */
function openAddFuture() {
  const s = Store.get();
  if (!s.futureGoals.length) {
    openSheet("Buat Tujuan Masa Depan", `
      <div class="form-group"><label>Nama tujuan</label><input type="text" id="fName" placeholder="Contoh: Dana Darurat Jangka Panjang"></div>
      <div class="form-group"><label>Target nominal (opsional)</label><input type="number" min="0" id="fTarget" placeholder="0"></div>
      <div class="form-group"><label>Target tanggal (opsional)</label><input type="date" id="fDate"></div>
      <div class="form-error" id="fError">Nama tujuan wajib diisi.</div>
      <button class="btn btn-primary btn-block" id="fSubmit">Lanjut ke setoran</button>
    `, () => {
      document.getElementById("fSubmit").onclick = () => {
        const name = document.getElementById("fName").value.trim();
        if (!name) { document.getElementById("fError").classList.add("show"); return; }
        const goal = { id: uid(), name, target: parseNum(document.getElementById("fTarget").value), balance: 0, accountId: s.accounts[0] ? s.accounts[0].id : "", startDate: todayISO(), targetDate: document.getElementById("fDate").value, note: "" };
        s.futureGoals.push(goal); Store.save();
        openFutureDeposit(goal);
      };
    });
  } else {
    openFutureDeposit(s.futureGoals[0]);
  }
}

function openFutureDeposit(goal) {
  const s = Store.get();
  const g = goal || s.futureGoals[0];
  if (!g) return;
  openSheet("Tambah Setoran Masa Depan", `
    <div class="form-group"><label>Tujuan</label>
      <select id="fGoal">${s.futureGoals.map((x) => `<option value="${x.id}" ${x.id === g.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
    </div>
    <div class="form-group"><label>Nominal</label><input type="number" min="1" id="fAmount" placeholder="0"></div>
    <div class="form-group"><label>Sumber uang</label>
      <select id="fSourceType"><option>Pendapatan harian</option><option>Sisa uang harian</option><option>Bonus</option><option>Transfer rekening</option><option>Lainnya</option></select>
    </div>
    <div class="form-group"><label>Rekening penyimpanan</label><select id="fAccount">${accountOptions(g.accountId)}</select></div>
    <div class="form-group"><label>Catatan (opsional)</label><input type="text" id="fNote"></div>
    <div class="form-error" id="fError">Nominal tidak valid atau saldo rekening tidak cukup.</div>
    <button class="btn btn-primary btn-block" id="fSubmit">Lanjutkan</button>
  `, () => {
    document.getElementById("fSubmit").onclick = async () => {
      const amount = parseNum(document.getElementById("fAmount").value);
      const accountId = document.getElementById("fAccount").value;
      const acc = s.accounts.find((a) => a.id === accountId);
      if (amount <= 0 || !acc || acc.balance < amount) { document.getElementById("fError").classList.add("show"); return; }
      const targetGoal = s.futureGoals.find((x) => x.id === document.getElementById("fGoal").value);
      const ok = await confirmDialog("Uang ini akan dikunci sebagai Tabungan Masa Depan dan tidak dihitung sebagai uang yang bisa digunakan. Lanjutkan?");
      if (!ok) return;
      acc.balance -= amount; targetGoal.balance += amount;
      addTransaction({ type: "future_in", label: "Setoran Masa Depan: " + targetGoal.name, accountId, amount, direction: "out", note: document.getElementById("fSourceType").value });
      Store.save(); closeSheet(); renderAll(); toast("Setoran Masa Depan tersimpan", "success");
    };
  });
}

function openFutureWithdraw(goal) {
  const s = Store.get();
  openSheet("Ajukan Pencairan", `
    <p class="muted-text" style="color:#991B1B;font-weight:600;">Tabungan ini dibuat untuk masa depan. Pastikan pencairan benar-benar diperlukan.</p>
    <div class="form-group"><label>Nominal pencairan</label><input type="number" min="1" max="${goal.balance}" id="fAmount"></div>
    <div class="form-group"><label>Alasan</label><input type="text" id="fReason" placeholder="Wajib diisi"></div>
    <div class="form-group"><label>Rekening tujuan</label><select id="fAccount">${accountOptions(s.accounts[0] && s.accounts[0].id)}</select></div>
    <div class="form-error" id="fError">Nominal tidak valid atau alasan belum diisi.</div>
    <button class="btn btn-danger btn-block" id="fSubmit">Ajukan pencairan</button>
  `, () => {
    document.getElementById("fSubmit").onclick = async () => {
      const amount = parseNum(document.getElementById("fAmount").value);
      const reason = document.getElementById("fReason").value.trim();
      const accountId = document.getElementById("fAccount").value;
      if (amount <= 0 || amount > goal.balance || !reason) { document.getElementById("fError").classList.add("show"); return; }
      const ok = await confirmDialog(`Yakin cairkan ${fmtRupiah(amount)} dari "${goal.name}"? Alasan: ${reason}`);
      if (!ok) return;
      const acc = s.accounts.find((a) => a.id === accountId);
      goal.balance -= amount; acc.balance += amount;
      addTransaction({ type: "future_out", label: "Pencairan Masa Depan: " + goal.name, accountId, amount, direction: "in", note: reason });
      Store.save(); closeSheet(); renderAll(); toast("Pencairan berhasil diproses", "success");
    };
  });
}

/* ===================== FORM: SALDO AWAL ===================== */
function openEditInitialBalance() {
  const s = Store.get();
  openSheet("Ubah Saldo Awal", `
    <div class="form-group"><label>Saldo awal</label><input type="number" min="0" id="fBalance" value="${s.settings.initialBalance}"></div>
    <p class="form-hint">Mengubah ini akan menyesuaikan saldo rekening Tunai.</p>
    <button class="btn btn-primary btn-block" id="fSubmit">Simpan</button>
  `, () => {
    document.getElementById("fSubmit").onclick = () => {
      const newVal = parseNum(document.getElementById("fBalance").value);
      const diff = newVal - s.settings.initialBalance;
      s.settings.initialBalance = newVal;
      const acc = s.accounts[0];
      if (acc) acc.balance += diff;
      Store.save(); closeSheet(); renderAll(); toast("Saldo awal diperbarui", "success");
    };
  });
}

/* ===================== RENDER: DASHBOARD ===================== */
let balanceHidden = false;

function renderDashboard() {
  const s = Store.get();
  const today = todayISO();

  document.getElementById("totalBalance").textContent = balanceHidden ? "••••••" : fmtRupiah(totalAccounts());
  document.getElementById("usableBalance").textContent = "Bisa digunakan: " + (balanceHidden ? "••••••" : fmtRupiah(usableBalance()));
  document.getElementById("futureTotalAmount").textContent = fmtRupiah(totalFuture());

  document.getElementById("statGrossToday").textContent = fmtRupiah(grossOn(today));
  document.getElementById("statWorkExpenseToday").textContent = "-" + fmtRupiah(workExpOn(today));
  document.getElementById("statNetToday").textContent = fmtRupiah(netOn(today));

  document.getElementById("budgetTotal").textContent = fmtRupiah(s.settings.dailyBudgetAmount);
  const remaining = budgetRemainingToday();
  document.getElementById("budgetRemaining").textContent = fmtRupiah(remaining);
  const usedPct = s.settings.dailyBudgetAmount > 0 ? Math.min(100, Math.round((budgetUsedToday() + budgetMovedToday()) / s.settings.dailyBudgetAmount * 100)) : 0;
  document.getElementById("budgetProgress").style.width = usedPct + "%";

  document.getElementById("unallocatedAmount").textContent = fmtRupiah(totalUnallocated());
  document.getElementById("debtsTotal") && (document.getElementById("debtsTotal").textContent = fmtRupiah(totalDebtUnpaid()));

  // Kantong ringkas
  const pocketsWrap = document.getElementById("dashboardPockets");
  pocketsWrap.innerHTML = s.pockets.length ? s.pockets.slice(0, 6).map((p) => `
    <div class="pocket-mini">
      <h4>${esc(p.name)}</h4>
      <div class="amt">${fmtRupiah(p.balance)}</div>
      <div class="progress-track"><div class="progress-fill" style="width:${p.target > 0 ? Math.min(100, Math.round(p.balance / p.target * 100)) : 0}%"></div></div>
    </div>`).join("") : `<div class="empty-state-mini">Belum ada kantong</div>`;

  // Tagihan terdekat
  const bills = [...s.debts].filter((d) => debtStatus(d) !== "lunas").sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")).slice(0, 3);
  document.getElementById("dashboardBills").innerHTML = bills.length ? bills.map(debtRowHtml).join("") : `<div class="empty-state-mini">Belum ada tagihan</div>`;

  // Transaksi terbaru
  const recent = s.transactions.slice(0, 5);
  document.getElementById("dashboardRecent").innerHTML = recent.length ? recent.map(txRowHtml).join("") : `<div class="empty-state-mini">Belum ada transaksi</div>`;

  // Rekap
  const d7 = lastNDays(7), d30 = lastNDays(30);
  const total7 = sumBy(d7, netOn), total30 = sumBy(d30, netOn);
  const avg7 = Math.round(total7 / 7);
  let bestDay = null, bestVal = -Infinity;
  d7.forEach((d) => { const v = netOn(d); if (v > bestVal) { bestVal = v; bestDay = d; } });
  document.getElementById("recap7Total").textContent = fmtRupiah(total7);
  document.getElementById("recap7Avg").textContent = fmtRupiah(avg7);
  document.getElementById("recap7Best").textContent = bestVal > 0 ? fmtDate(bestDay) : "-";
  document.getElementById("recap30Total").textContent = fmtRupiah(total30);
}

function debtRowHtml(d) {
  const status = debtStatus(d);
  const overdue = d.dueDate && daysBetween(d.dueDate, todayISO()) > 0 && status !== "lunas";
  const soon = d.dueDate && !overdue && daysBetween(todayISO(), d.dueDate) <= 3 && status !== "lunas";
  const cls = status === "lunas" ? "status-lunas" : overdue ? "status-belum" : soon ? "status-sebagian" : "status-belum";
  const label = status === "lunas" ? "Lunas" : status === "sebagian" ? "Sebagian" : "Belum dibayar";
  return `<div class="list-item">
    <div class="list-item-icon">⏰</div>
    <div class="list-item-body">
      <div class="list-item-title">${esc(d.name)}</div>
      <div class="list-item-sub">${d.dueDate ? "Jatuh tempo " + fmtDate(d.dueDate) : "Tanpa tanggal"} · <span class="status-pill ${cls}">${label}</span></div>
    </div>
    <div class="list-item-amount">${fmtRupiah(d.amount - d.paidAmount)}</div>
  </div>`;
}

const TX_ICON = {
  income: "↑", work_expense: "↓", daily_expense: "↓", pocket_in: "◆", pocket_out: "◆",
  debt_payment: "↓", future_in: "🔒", future_out: "🔓"
};
function txRowHtml(t) {
  const plus = t.direction === "in";
  return `<div class="list-item">
    <div class="list-item-icon">${TX_ICON[t.type] || "•"}</div>
    <div class="list-item-body">
      <div class="list-item-title">${esc(t.label)}</div>
      <div class="list-item-sub">${fmtDate(t.date)} · ${t.time || ""}${t.note ? " · " + esc(t.note) : ""}</div>
    </div>
    <div class="list-item-amount ${plus ? "amount-plus" : "amount-minus"}">${plus ? "+" : "-"}${fmtRupiah(t.amount)}</div>
  </div>`;
}

/* ===================== RENDER: PENDAPATAN ===================== */
function renderIncome() {
  const s = Store.get();
  const today = todayISO();
  document.getElementById("incTotalToday").textContent = fmtRupiah(grossOn(today));
  const d7 = lastNDays(7);
  const total7 = sumBy(d7, grossOn);
  document.getElementById("incTotal7").textContent = fmtRupiah(total7);
  document.getElementById("incAvg7").textContent = fmtRupiah(Math.round(total7 / 7));

  const list = [...s.incomes].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  document.getElementById("incomeList").innerHTML = list.length ? list.map((i) => `
    <div class="list-item">
      <div class="list-item-icon">↑</div>
      <div class="list-item-body">
        <div class="list-item-title">${esc(i.source)}</div>
        <div class="list-item-sub">${fmtDate(i.date)} · ${i.time}${i.note ? " · " + esc(i.note) : ""}</div>
      </div>
      <div class="list-item-amount amount-plus">+${fmtRupiah(i.amount)}</div>
    </div>`).join("") : `<div class="empty-state">Belum ada pemasukan tercatat.</div>`;
}

/* ===================== RENDER: PENGELUARAN ===================== */
let expenseTab = "work";
function renderExpense() {
  const s = Store.get();
  const list = [...s.expenses].filter((e) => e.kind === expenseTab).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  document.getElementById("expenseList").innerHTML = list.length ? list.map((e) => `
    <div class="list-item">
      <div class="list-item-icon">↓</div>
      <div class="list-item-body">
        <div class="list-item-title">${esc(e.category)}</div>
        <div class="list-item-sub">${fmtDate(e.date)} · ${e.time}${e.note ? " · " + esc(e.note) : ""}</div>
      </div>
      <div class="list-item-amount amount-minus">-${fmtRupiah(e.amount)}</div>
    </div>`).join("") : `<div class="empty-state">Belum ada pengeluaran ${expenseTab === "work" ? "kerja" : "harian"}.</div>`;
}

/* ===================== RENDER: KANTONG ===================== */
function renderPockets() {
  const s = Store.get();
  document.getElementById("pocketGrid").innerHTML = s.pockets.length ? s.pockets.map((p) => {
    const pct = p.target > 0 ? Math.min(100, Math.round(p.balance / p.target * 100)) : 0;
    return `<div class="card pocket-card">
      <div class="pocket-card-top">
        <h4>${esc(p.name)}</h4>
        ${p.target > 0 ? `<span class="pct">${pct}%</span>` : ""}
      </div>
      <div class="pocket-amounts">
        <span>${fmtRupiah(p.balance)}</span>
        <span>${p.target > 0 ? "Target " + fmtRupiah(p.target) : "Tanpa target"}</span>
      </div>
      ${p.target > 0 ? `<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>` : ""}
      ${p.targetDate ? `<div class="form-hint">Target: ${fmtDate(p.targetDate)}</div>` : ""}
      <div class="pocket-actions">
        <button class="btn btn-secondary btn-sm" data-act="in" data-id="${p.id}">+ Tambah</button>
        <button class="btn btn-secondary btn-sm" data-act="out" data-id="${p.id}">- Ambil</button>
        <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${p.id}">Edit</button>
      </div>
    </div>`;
  }).join("") : `<div class="empty-state">Belum ada kantong tabungan.</div>`;

  document.getElementById("pocketGrid").querySelectorAll("button[data-act]").forEach((btn) => {
    btn.onclick = () => {
      const pocket = s.pockets.find((p) => p.id === btn.dataset.id);
      openPocketAction(pocket, btn.dataset.act);
    };
  });
}

/* ===================== RENDER: REKENING ===================== */
function renderAccounts() {
  const s = Store.get();
  document.getElementById("accountsTotal").textContent = fmtRupiah(totalAccounts());
  document.getElementById("accountList").innerHTML = s.accounts.length ? s.accounts.map((a) => `
    <div class="list-item">
      <div class="list-item-icon">🏦</div>
      <div class="list-item-body">
        <div class="list-item-title">${esc(a.name)}</div>
        <div class="list-item-sub">${esc(a.type)}${a.note ? " · " + esc(a.note) : ""}</div>
      </div>
      <div class="list-item-amount">${fmtRupiah(a.balance)}</div>
    </div>`).join("") : `<div class="empty-state">Belum ada rekening.</div>`;
}

/* ===================== RENDER: HUTANG ===================== */
function renderDebts() {
  const s = Store.get();
  document.getElementById("debtsTotal").textContent = fmtRupiah(totalDebtUnpaid());
  const list = [...s.debts].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  document.getElementById("debtList").innerHTML = list.length ? list.map((d) => {
    const status = debtStatus(d);
    return `<div class="list-item" data-id="${d.id}" style="cursor:pointer;">
      <div class="list-item-icon">⏰</div>
      <div class="list-item-body">
        <div class="list-item-title">${esc(d.name)}</div>
        <div class="list-item-sub">${d.dueDate ? fmtDate(d.dueDate) : "Tanpa jatuh tempo"} · <span class="status-pill status-${status}">${status === "lunas" ? "Lunas" : status === "sebagian" ? "Sebagian" : "Belum dibayar"}</span></div>
      </div>
      <div class="list-item-amount">${fmtRupiah(d.amount - d.paidAmount)}</div>
    </div>`;
  }).join("") : `<div class="empty-state">Belum ada hutang/tagihan.</div>`;

  document.getElementById("debtList").querySelectorAll(".list-item").forEach((el) => {
    el.onclick = () => {
      const debt = s.debts.find((d) => d.id === el.dataset.id);
      if (debtStatus(debt) !== "lunas") openPayDebt(debt);
    };
  });
}

/* ===================== RENDER: MASA DEPAN ===================== */
function renderFuture() {
  const s = Store.get();
  document.getElementById("futureHeroTotal").textContent = fmtRupiah(totalFuture());
  document.getElementById("futureSplitTotal").textContent = fmtRupiah(totalAll());
  document.getElementById("futureSplitUsable").textContent = fmtRupiah(usableBalance());

  document.getElementById("futureGoalsList").innerHTML = s.futureGoals.length ? s.futureGoals.map((g) => {
    const pct = g.target > 0 ? Math.min(100, Math.round(g.balance / g.target * 100)) : 0;
    return `<div class="list-item" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;justify-content:space-between;width:100%;">
        <div class="list-item-title">${esc(g.name)}</div>
        <div class="list-item-amount">${fmtRupiah(g.balance)}</div>
      </div>
      ${g.target > 0 ? `<div class="progress-track" style="margin-top:8px;"><div class="progress-fill" style="width:${pct}%"></div></div><div class="list-item-sub">${pct}% dari ${fmtRupiah(g.target)}</div>` : ""}
      <button class="future-goal-withdraw" data-id="${g.id}">Ajukan pencairan</button>
    </div>`;
  }).join("") : `<div class="empty-state">Belum ada tujuan Tabungan Masa Depan.</div>`;

  document.getElementById("futureGoalsList").querySelectorAll(".future-goal-withdraw").forEach((btn) => {
    btn.onclick = () => openFutureWithdraw(s.futureGoals.find((g) => g.id === btn.dataset.id));
  });
}

/* ===================== RENDER: RIWAYAT ===================== */
function renderHistory() {
  const s = Store.get();
  const accSel = document.getElementById("filterAccount");
  if (accSel.options.length <= 1) {
    accSel.innerHTML = `<option value="">Semua rekening</option>` + s.accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  }
  const q = (document.getElementById("historySearch").value || "").toLowerCase();
  const typeF = document.getElementById("filterType").value;
  const dateF = document.getElementById("filterDate").value;
  const accF = document.getElementById("filterAccount").value;

  let list = s.transactions.filter((t) => {
    if (typeF && t.type !== typeF) return false;
    if (dateF && t.date !== dateF) return false;
    if (accF && t.accountId !== accF) return false;
    if (q && !(t.label.toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q))) return false;
    return true;
  });
  document.getElementById("historyList").innerHTML = list.length ? list.map(txRowHtml).join("") : `<div class="empty-state">Tidak ada transaksi yang cocok.</div>`;
}

/* ===================== RENDER: SETTINGS ===================== */
function renderSettings() { /* statis, tidak perlu render dinamis */ }

/* ===================== RENDER ALL ===================== */
function renderAll() {
  renderDashboard();
  renderIncome();
  renderExpense();
  renderPockets();
  renderAccounts();
  renderDebts();
  renderFuture();
  renderHistory();
}

/* ===================== NAVIGASI ===================== */
function showPage(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  document.querySelectorAll(".bnav-item").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  window.scrollTo(0, 0);
}

function wireNavigation() {
  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });
  document.querySelectorAll("[data-page-link]").forEach((el) => {
    el.addEventListener("click", () => showPage(el.dataset.pageLink));
  });
}

/* ===================== QUICK MENU (FAB) ===================== */
function wireQuickMenu() {
  const overlay = document.getElementById("quickMenuOverlay");
  function open() { overlay.classList.add("open"); }
  function close() { overlay.classList.remove("open"); }
  document.getElementById("btnAddTransaction").addEventListener("click", open);
  document.getElementById("bnavFab").addEventListener("click", open);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll("[data-quick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      close();
      const kind = btn.dataset.quick;
      if (kind === "income") openAddIncome();
      else if (kind === "work_expense") openAddExpense("work");
      else if (kind === "daily_expense") openAddExpense("daily");
      else if (kind === "pocket") { showPage("pockets"); }
      else if (kind === "future") openAddFuture();
    });
  });
}

/* ===================== EXPORT / IMPORT / RESET ===================== */
function exportData() {
  const data = JSON.stringify(Store.get(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "tabungan-rafly-backup-" + todayISO() + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("Data berhasil di-export", "success");
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.accounts) throw new Error("format tidak valid");
      Store.state = data;
      Store.save(); renderAll();
      toast("Data berhasil di-import", "success");
    } catch (e) {
      toast("File tidak valid", "error");
    }
  };
  reader.readAsText(file);
}
async function resetData() {
  const ok = await confirmDialog("Semua data akan dihapus dan tidak bisa dikembalikan. Yakin ingin reset?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  Store.load(); renderAll();
  toast("Semua data telah direset", "success");
}

/* ===================== INIT ===================== */
function wireStaticButtons() {
  document.getElementById("sheetClose").addEventListener("click", closeSheet);
  document.getElementById("sheetOverlay").addEventListener("click", (e) => { if (e.target.id === "sheetOverlay") closeSheet(); });

  document.getElementById("btnToggleBalance").addEventListener("click", toggleBalanceVisibility);
  document.getElementById("btnToggleBalanceTop").addEventListener("click", toggleBalanceVisibility);

  document.getElementById("btnAddIncome").addEventListener("click", openAddIncome);
  document.getElementById("btnAddExpense").addEventListener("click", () => openAddExpense(expenseTab));
  document.getElementById("btnAddPocket").addEventListener("click", openAddPocket);
  document.getElementById("btnAddAccount").addEventListener("click", openAddAccount);
  document.getElementById("btnAddDebt").addEventListener("click", openAddDebt);
  document.getElementById("btnAddFuture").addEventListener("click", openAddFuture);
  document.getElementById("btnEditBudget").addEventListener("click", openEditBudget);
  document.getElementById("btnMoveToPocket").addEventListener("click", openMoveToPocket);
  document.getElementById("btnAllocateNow").addEventListener("click", openAllocate);
  document.getElementById("btnEditInitialBalance").addEventListener("click", openEditInitialBalance);

  document.getElementById("btnExportData").addEventListener("click", exportData);
  document.getElementById("btnImportData").addEventListener("click", () => document.getElementById("importFileInput").click());
  document.getElementById("importFileInput").addEventListener("change", (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; });
  document.getElementById("btnResetData").addEventListener("click", resetData);

  document.getElementById("expenseTabs").querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      expenseTab = btn.dataset.tab;
      document.querySelectorAll("#expenseTabs .tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderExpense();
    });
  });

  ["historySearch", "filterType", "filterDate", "filterAccount"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderHistory);
  });
}

function toggleBalanceVisibility() {
  balanceHidden = !balanceHidden;
  document.getElementById("totalBalance").classList.toggle("balance-hidden", false);
  renderDashboard();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  Store.load();
  wireNavigation();
  wireQuickMenu();
  wireStaticButtons();
  renderAll();
  registerServiceWorker();
});

})();
