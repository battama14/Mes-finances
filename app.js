// ─── State ───────────────────────────────────────────────────────────────────
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

let state = loadState();

function defaultState() {
  return { entries: [], savingsGoal: 0, savingsBank: [], cryptoEntries: [], cryptoPrices: {} };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('budget_v3')) || defaultState();
    if (!s.savingsBank)    s.savingsBank    = [];
    if (!s.cryptoEntries)  s.cryptoEntries  = [];
    if (!s.cryptoPrices)   s.cryptoPrices   = {};
    // Pré-remplir PLS et PLSX si aucune crypto n'existe encore
    if (s.cryptoEntries.length === 0) {
      const now = new Date();
      s.cryptoEntries.push({
        id: 1,
        label: 'PLS',
        amount: 75.95,
        buyPrice: 0.000007296,
        recurring: 'once',
        month: now.getMonth(),
        year: now.getFullYear()
      });
      s.cryptoEntries.push({
        id: 2,
        label: 'PLSX',
        amount: 14.7414,
        buyPrice: 0.000005822,
        recurring: 'once',
        month: now.getMonth(),
        year: now.getFullYear()
      });
      s.cryptoPrices['pls']  = 0.000007105;
      s.cryptoPrices['plsx'] = 0.000005638;
    }
    return s;
  } catch { return defaultState(); }
}

function saveState() {
  localStorage.setItem('budget_v3', JSON.stringify(state));
}

// ─── Selectors ────────────────────────────────────────────────────────────────
const monthSelect        = document.getElementById('monthSelect');
const yearSelect         = document.getElementById('yearSelect');
const incomeForm         = document.getElementById('incomeForm');
const expenseForm        = document.getElementById('expenseForm');
const savingsGoalInput   = document.getElementById('savingsGoal');
const saveSavingsGoalBtn = document.getElementById('saveSavingsGoal');
const savingsBankForm    = document.getElementById('savingsBankForm');
const cryptoForm         = document.getElementById('cryptoForm');

// ─── Init selects ─────────────────────────────────────────────────────────────
(function initSelects() {
  const now = new Date();
  MONTHS.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = m;
    if (i === now.getMonth()) o.selected = true;
    monthSelect.appendChild(o);
  });
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === now.getFullYear()) o.selected = true;
    yearSelect.appendChild(o);
  }

  // Remplir les selects de date de fin
  ['expenseEndMonth','savingsBankEndMonth'].forEach(id => {
    const sel = document.getElementById(id);
    MONTHS.forEach((m, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = m;
      sel.appendChild(o);
    });
  });
  ['expenseEndYear','savingsBankEndYear'].forEach(id => {
    const sel = document.getElementById(id);
    for (let y = now.getFullYear(); y <= now.getFullYear() + 10; y++) {
      const o = document.createElement('option');
      o.value = y; o.textContent = y;
      sel.appendChild(o);
    }
  });
})();

function currentPeriod() {
  return { month: parseInt(monthSelect.value), year: parseInt(yearSelect.value) };
}

// ─── Toggle date de fin ───────────────────────────────────────────────────────
function toggleEndDate(prefix) {
  const recurring = document.getElementById(prefix + 'Recurring').value;
  const row = document.getElementById(prefix + 'EndDateRow');
  if (row) row.style.display = recurring === 'monthly' ? 'flex' : 'none';
}
// Init visibility
toggleEndDate('expense');
toggleEndDate('savingsBank');

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Vérifie si une entrée récurrente est active pour un mois/année donné
function isActiveForPeriod(e, month, year) {
  if (e.recurring !== 'monthly') {
    return e.month === month && e.year === year;
  }
  // Doit avoir commencé
  if (new Date(e.year, e.month) > new Date(year, month)) return false;
  // Doit ne pas être terminé
  if (e.endMonth !== undefined && e.endYear !== undefined) {
    if (new Date(year, month) > new Date(e.endYear, e.endMonth)) return false;
  }
  return true;
}

function entriesForPeriod(month, year) {
  return state.entries.filter(e => isActiveForPeriod(e, month, year));
}

function savingsBankForPeriod(month, year) {
  return state.savingsBank.filter(e => isActiveForPeriod(e, month, year));
}

function cryptoForPeriod(month, year) {
  return state.cryptoEntries.filter(e => isActiveForPeriod(e, month, year));
}

function totalIncome(entries) {
  return entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
}

function totalExpenses(entries) {
  return entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
}

function totalAmount(arr) {
  return arr.reduce((s, e) => s + e.amount, 0);
}

// Cumul all-time jusqu'au mois/année donné (respecte date de fin)
function cumulUpTo(arr, month, year) {
  let total = 0;
  arr.forEach(e => {
    if (e.recurring === 'monthly') {
      const start = new Date(e.year, e.month);
      const end   = new Date(year, month);
      if (start > end) return;
      // Date de fin effective = min(endDate, targetDate)
      let endDate = end;
      if (e.endMonth !== undefined && e.endYear !== undefined) {
        const eEnd = new Date(e.endYear, e.endMonth);
        if (eEnd < endDate) endDate = eEnd;
      }
      if (start > endDate) return;
      const months = (endDate.getFullYear() - start.getFullYear()) * 12
                   + (endDate.getMonth() - start.getMonth()) + 1;
      total += e.amount * Math.max(1, months);
    } else {
      if (e.year < year || (e.year === year && e.month <= month)) {
        total += e.amount;
      }
    }
  });
  return total;
}

// Calcul P&L crypto : utilise TOUTES les entrées historiques (pas filtrées par mois)
function calcCryptoPnl() {
  const coins = {};
  state.cryptoEntries.forEach(e => {
    const key = e.label.toLowerCase();
    if (!coins[key]) coins[key] = { label: e.label, totalInvested: 0, totalQty: 0 };
    if (e.buyPrice > 0) {
      coins[key].totalQty      += e.amount / e.buyPrice;
      coins[key].totalInvested += e.amount;
    }
  });
  let totalPnl = 0;
  let hasPrices = false;
  const details = [];
  Object.values(coins).forEach(c => {
    const currentPrice = state.cryptoPrices[c.label.toLowerCase()] || 0;
    const hasPrice = currentPrice > 0;
    const currentValue = c.totalQty * currentPrice;
    const pnl = hasPrice ? currentValue - c.totalInvested : null;
    if (hasPrice) { totalPnl += pnl; hasPrices = true; }
    details.push({ label: c.label, qty: c.totalQty, invested: c.totalInvested, currentValue, pnl, currentPrice, hasPrice });
  });
  return { totalPnl, hasPrices, details };
}

function fmt(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtPrice(n) {
  // Prix crypto en $ : adapte les décimales selon la valeur
  if (n === 0) return '0 $';
  if (n >= 1)    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
  if (n >= 0.01) return n.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' $';
  if (n >= 0.0001) return n.toLocaleString('fr-FR', { minimumFractionDigits: 6, maximumFractionDigits: 6 }) + ' $';
  // Très petit prix (memecoins) : notation scientifique lisible
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 10, maximumFractionDigits: 10 }).replace(/0+$/, '') + ' $';
}

function fmtQty(n) {
  // Grande quantité (memecoins) : pas de décimales inutiles
  if (n >= 1000) return Math.round(n).toLocaleString('fr-FR') + ' unités';
  if (n >= 1)    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' unités';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 8 }) + ' unités';
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  const { month, year } = currentPeriod();
  const entries        = entriesForPeriod(month, year);
  const inc            = totalIncome(entries);
  const exp            = totalExpenses(entries);
  const goal           = state.savingsGoal || 0;
  const savBankEntries = savingsBankForPeriod(month, year);
  const cryptoEntries  = cryptoForPeriod(month, year);
  const savBankMonth   = totalAmount(savBankEntries);
  const cryptoMonth    = totalAmount(cryptoEntries);
  const savBankCumul   = cumulUpTo(state.savingsBank, month, year);
  const cryptoCumul    = cumulUpTo(state.cryptoEntries, month, year);
  const reste          = inc - exp - savBankMonth - goal - cryptoMonth;
  const goalYearCumul  = goal * 12;
  const { totalPnl, hasPrices, details } = calcCryptoPnl();

  // ── Cartes résumé
  document.getElementById('totalIncome').textContent      = fmt(inc);
  document.getElementById('totalExpenses').textContent    = fmt(exp);
  document.getElementById('totalSavingsBank').textContent = fmt(savBankCumul);
  document.getElementById('totalCrypto').textContent      = fmt(cryptoCumul);

  const balEl = document.getElementById('balance');
  balEl.textContent = fmt(inc - exp);
  balEl.className = (inc - exp) >= 0 ? '' : 'neg';

  document.getElementById('savings').textContent = fmt(goal);

  // ── Barre de progression
  const pct = inc > 0 ? Math.min(100, Math.round((exp / inc) * 100)) : 0;
  document.getElementById('progressPercent').textContent = pct + '%';
  const fill = document.getElementById('progressFill');
  fill.style.width = pct + '%';
  fill.style.background = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--yellow)' : 'var(--green)';

  // ── Reste à vivre
  const resteEl = document.getElementById('resteAVivre');
  resteEl.textContent = (reste < 0 ? '− ' : '') + fmt(Math.abs(reste));
  resteEl.style.color = reste >= 0 ? 'var(--green)' : 'var(--red)';
  const resteLabel = document.getElementById('resteLabel');
  if (reste > 0)       { resteLabel.textContent = '✅ Vous êtes à l\'aise ce mois';        resteLabel.style.color = 'var(--green)'; }
  else if (reste === 0){ resteLabel.textContent = '⚠️ Budget pile';                        resteLabel.style.color = 'var(--yellow)'; }
  else                 { resteLabel.textContent = `❌ Déficit de ${fmt(Math.abs(reste))}`; resteLabel.style.color = 'var(--red)'; }

  document.getElementById('rbIncome').textContent   = fmt(inc);
  document.getElementById('rbExpenses').textContent = '− ' + fmt(exp);
  document.getElementById('rbSavings').textContent  = '− ' + fmt(savBankMonth);
  document.getElementById('rbGoal').textContent     = '− ' + fmt(goal);
  document.getElementById('rbCrypto').textContent   = '− ' + fmt(cryptoMonth);
  const rbReste = document.getElementById('rbReste');
  rbReste.textContent = (reste < 0 ? '− ' : '') + fmt(Math.abs(reste));
  rbReste.style.color = reste >= 0 ? 'var(--green)' : 'var(--red)';

  // ── Objectif épargne
  savingsGoalInput.value = goal || '';
  const goalStats  = document.getElementById('goalStats');
  const goalStatus = document.getElementById('goalStatus');
  if (goal > 0) {
    goalStats.style.display = 'grid';
    document.getElementById('goalMonthAmount').textContent = fmt(goal);
    document.getElementById('goalYearCumul').textContent   = fmt(goalYearCumul);
    if (reste >= 0) {
      goalStatus.textContent = `✅ ${fmt(goal)}/mois déduit. Il vous reste ${fmt(reste)} pour vivre.`;
      goalStatus.style.color = 'var(--green)';
    } else {
      goalStatus.textContent = `❌ Déficit de ${fmt(Math.abs(reste))}. Réduisez vos dépenses ou l'objectif.`;
      goalStatus.style.color = 'var(--red)';
    }
  } else {
    goalStats.style.display = 'none';
    goalStatus.textContent = '';
  }

  // ── Listes
  renderList('incomeList',  entries.filter(e => e.type === 'income'),  'income');
  renderList('expenseList', entries.filter(e => e.type === 'expense'), 'expense');
  renderSavingsBankList(savBankEntries);
  renderCryptoList(cryptoEntries);
  renderCryptoPrices(details);

  document.getElementById('savingsBankCumul').textContent = fmt(savBankCumul);
  document.getElementById('cryptoCumul').textContent      = fmt(cryptoCumul);

  const pnlEl = document.getElementById('cryptoPnl');
  if (!hasPrices) {
    pnlEl.textContent = 'Saisir prix actuel →';
    pnlEl.style.color = 'var(--muted)';
  } else {
    pnlEl.textContent = (totalPnl < 0 ? '− ' : '+') + fmt(Math.abs(totalPnl));
    pnlEl.style.color = totalPnl >= 0 ? 'var(--green)' : 'var(--red)';
  }

  renderAnnual(year);
}

function renderList(listId, entries, type) {
  const ul = document.getElementById(listId);
  ul.innerHTML = '';
  if (entries.length === 0) {
    ul.innerHTML = '<li style="color:var(--muted);font-size:.85rem;justify-content:center">Aucune entrée</li>';
    return;
  }
  entries.forEach(e => {
    const li = document.createElement('li');
    const catBadge = e.category ? `<span class="cat">${e.category}</span>` : '';
    const recBadge = `<span class="recurring">${e.recurring === 'monthly' ? '🔁' : '1×'}</span>`;
    const endBadge = (e.recurring === 'monthly' && e.endMonth !== undefined)
      ? `<span class="end-badge">fin ${MONTHS[e.endMonth].slice(0,3)} ${e.endYear}</span>` : '';
    li.innerHTML = `
      <span class="label">${e.label}</span>
      ${catBadge}${recBadge}${endBadge}
      <span class="amount ${type}">${fmt(e.amount)}</span>
      <button class="btn-del" data-id="${e.id}" title="Supprimer">✕</button>
    `;
    ul.appendChild(li);
  });
}

function renderSavingsBankList(entries) {
  const ul = document.getElementById('savingsBankList');
  ul.innerHTML = '';
  if (entries.length === 0) {
    ul.innerHTML = '<li style="color:var(--muted);font-size:.85rem;justify-content:center">Aucune entrée</li>';
    return;
  }
  entries.forEach(e => {
    const li = document.createElement('li');
    const endBadge = (e.recurring === 'monthly' && e.endMonth !== undefined)
      ? `<span class="end-badge">fin ${MONTHS[e.endMonth].slice(0,3)} ${e.endYear}</span>` : '';
    li.innerHTML = `
      <span class="label">${e.label}</span>
      <span class="recurring">${e.recurring === 'monthly' ? '🔁' : '1×'}</span>
      ${endBadge}
      <span class="amount" style="color:var(--purple)">${fmt(e.amount)}</span>
      <button class="btn-del" data-id="${e.id}" title="Supprimer">✕</button>
    `;
    ul.appendChild(li);
  });
}

function renderCryptoList(entries) {
  const ul = document.getElementById('cryptoList');
  ul.innerHTML = '';
  if (entries.length === 0) {
    ul.innerHTML = '<li style="color:var(--muted);font-size:.85rem;justify-content:center">Aucune entrée</li>';
    return;
  }
  entries.forEach(e => {
    const li = document.createElement('li');
    const qty = e.buyPrice > 0 ? e.amount / e.buyPrice : 0;
    const qtyStr = e.buyPrice > 0 ? `<span class="cat">${fmtQty(qty)}</span>` : '';
    const buyStr = e.buyPrice > 0 ? `<span class="cat">achat: ${fmtPrice(e.buyPrice)}</span>` : '';
    li.innerHTML = `
      <span class="label">${e.label}</span>
      ${qtyStr}${buyStr}
      <span class="recurring">${e.recurring === 'monthly' ? '🔁' : '1×'}</span>
      <span class="amount" style="color:var(--orange)">${fmt(e.amount)}</span>
      <button class="btn-del" data-id="${e.id}" title="Supprimer">✕</button>
    `;
    ul.appendChild(li);
  });
}

function renderCryptoPrices(details) {
  const section = document.getElementById('cryptoPricesSection');
  const list    = document.getElementById('cryptoPricesList');
  if (details.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  list.innerHTML = '';
  details.forEach(d => {
    const key = d.label.toLowerCase();
    const currentPrice = state.cryptoPrices[key] || 0;
    const avgBuy = d.qty > 0 ? d.invested / d.qty : 0;
    const pnlPct = d.invested > 0 && d.pnl !== null ? ((d.pnl / d.invested) * 100).toFixed(2) : null;
    const pnlStr = d.pnl === null
      ? '<span style="color:var(--muted);font-size:.8rem">Prix actuel non renseigné</span>'
      : `<span class="cp-pnl ${d.pnl >= 0 ? 'pos' : 'neg'}">${d.pnl >= 0 ? '+' : '− '}${fmt(Math.abs(d.pnl))} (${d.pnl >= 0 ? '+' : ''}${pnlPct}%)</span>`;
    const valeurStr = d.hasPrice ? fmt(d.currentValue) : '<span style="color:var(--muted)">N/A</span>';
    const div = document.createElement('div');
    div.className = 'crypto-price-row';
    div.innerHTML = `
      <div class="cp-header">
        <span class="cp-label">${d.label}</span>
        ${pnlStr}
      </div>
      <div class="cp-details">
        <span>💰 Investi : ${fmt(d.invested)}</span>
        <span>📊 Qté : ${fmtQty(d.qty)}</span>
        <span>📍 Achat moy. : ${fmtPrice(avgBuy)}</span>
        <span>💼 Valeur : ${valeurStr}</span>
      </div>
      <div class="cp-input-wrap">
        <input type="number" class="cp-input" data-coin="${key}"
          placeholder="Prix actuel $" step="any" min="0"
          value="${d.currentPrice > 0 ? d.currentPrice : ''}" />
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll('.cp-input').forEach(input => {
    input.addEventListener('change', () => {
      const val = parseFloat(input.value);
      state.cryptoPrices[input.dataset.coin] = isNaN(val) ? 0 : val;
      saveState(); render();
    });
  });
}

function renderAnnual(year) {
  document.getElementById('annualYear').textContent = year;
  const tbody = document.getElementById('annualBody');
  const tfoot = document.getElementById('annualFoot');
  tbody.innerHTML = '';
  const now  = new Date();
  const goal = state.savingsGoal || 0;
  let totInc = 0, totExp = 0, totSavBank = 0, totGoal = 0, totCrypto = 0, totReste = 0;

  MONTHS.forEach((m, i) => {
    const entries = entriesForPeriod(i, year);
    const inc     = totalIncome(entries);
    const exp     = totalExpenses(entries);
    const savBank = totalAmount(savingsBankForPeriod(i, year));
    const crypto  = totalAmount(cryptoForPeriod(i, year));
    const reste   = inc - exp - savBank - goal - crypto;
    totInc += inc; totExp += exp; totSavBank += savBank;
    totGoal += goal; totCrypto += crypto; totReste += reste;

    const tr = document.createElement('tr');
    const isCurrent = i === now.getMonth() && year === now.getFullYear();
    if (isCurrent) tr.className = 'current-month';
    tr.innerHTML = `
      <td>${m}${isCurrent ? ' ◀' : ''}</td>
      <td class="pos">${fmt(inc)}</td>
      <td class="neg">${fmt(exp)}</td>
      <td style="color:var(--purple)">${fmt(savBank)}</td>
      <td style="color:var(--yellow)">${fmt(goal)}</td>
      <td style="color:var(--orange)">${fmt(crypto)}</td>
      <td class="${reste >= 0 ? 'pos' : 'neg'}">${reste < 0 ? '− ' : ''}${fmt(Math.abs(reste))}</td>
    `;
    tbody.appendChild(tr);
  });

  tfoot.innerHTML = `<tr>
    <td>Total année</td>
    <td class="pos">${fmt(totInc)}</td>
    <td class="neg">${fmt(totExp)}</td>
    <td style="color:var(--purple)">${fmt(totSavBank)}</td>
    <td style="color:var(--yellow)">${fmt(totGoal)}</td>
    <td style="color:var(--orange)">${fmt(totCrypto)}</td>
    <td class="${totReste >= 0 ? 'pos' : 'neg'}">${totReste < 0 ? '− ' : ''}${fmt(Math.abs(totReste))}</td>
  </tr>`;
}

// ─── Events ───────────────────────────────────────────────────────────────────
incomeForm.addEventListener('submit', e => {
  e.preventDefault();
  const { month, year } = currentPeriod();
  state.entries.push({
    id: Date.now(), type: 'income',
    label: document.getElementById('incomeLabel').value.trim(),
    amount: parseFloat(document.getElementById('incomeAmount').value),
    recurring: document.getElementById('incomeRecurring').value,
    month, year
  });
  saveState(); render(); incomeForm.reset();
});

expenseForm.addEventListener('submit', e => {
  e.preventDefault();
  const { month, year } = currentPeriod();
  const recurring = document.getElementById('expenseRecurring').value;
  const entry = {
    id: Date.now(), type: 'expense',
    label: document.getElementById('expenseLabel').value.trim(),
    amount: parseFloat(document.getElementById('expenseAmount').value),
    category: document.getElementById('expenseCategory').value,
    recurring, month, year
  };
  const em = document.getElementById('expenseEndMonth').value;
  const ey = document.getElementById('expenseEndYear').value;
  if (recurring === 'monthly' && em !== '' && ey !== '') {
    entry.endMonth = parseInt(em);
    entry.endYear  = parseInt(ey);
  }
  state.entries.push(entry);
  saveState(); render(); expenseForm.reset(); toggleEndDate('expense');
});

savingsBankForm.addEventListener('submit', e => {
  e.preventDefault();
  const { month, year } = currentPeriod();
  const recurring = document.getElementById('savingsBankRecurring').value;
  const entry = {
    id: Date.now(),
    label: document.getElementById('savingsBankLabel').value.trim(),
    amount: parseFloat(document.getElementById('savingsBankAmount').value),
    recurring, month, year
  };
  const em = document.getElementById('savingsBankEndMonth').value;
  const ey = document.getElementById('savingsBankEndYear').value;
  if (recurring === 'monthly' && em !== '' && ey !== '') {
    entry.endMonth = parseInt(em);
    entry.endYear  = parseInt(ey);
  }
  state.savingsBank.push(entry);
  saveState(); render(); savingsBankForm.reset(); toggleEndDate('savingsBank');
});

cryptoForm.addEventListener('submit', e => {
  e.preventDefault();
  const { month, year } = currentPeriod();
  const buyPrice = parseFloat(document.getElementById('cryptoBuyPrice').value);
  state.cryptoEntries.push({
    id: Date.now(),
    label: document.getElementById('cryptoLabel').value.trim(),
    amount: parseFloat(document.getElementById('cryptoAmount').value),
    buyPrice: isNaN(buyPrice) ? 0 : buyPrice,
    recurring: document.getElementById('cryptoRecurring').value,
    month, year
  });
  saveState(); render(); cryptoForm.reset();
});

document.getElementById('incomeList').addEventListener('click', e => {
  const btn = e.target.closest('.btn-del'); if (!btn) return;
  state.entries = state.entries.filter(e => e.id !== parseInt(btn.dataset.id));
  saveState(); render();
});
document.getElementById('expenseList').addEventListener('click', e => {
  const btn = e.target.closest('.btn-del'); if (!btn) return;
  state.entries = state.entries.filter(e => e.id !== parseInt(btn.dataset.id));
  saveState(); render();
});
document.getElementById('savingsBankList').addEventListener('click', e => {
  const btn = e.target.closest('.btn-del'); if (!btn) return;
  state.savingsBank = state.savingsBank.filter(e => e.id !== parseInt(btn.dataset.id));
  saveState(); render();
});
document.getElementById('cryptoList').addEventListener('click', e => {
  const btn = e.target.closest('.btn-del'); if (!btn) return;
  state.cryptoEntries = state.cryptoEntries.filter(e => e.id !== parseInt(btn.dataset.id));
  saveState(); render();
});

saveSavingsGoalBtn.addEventListener('click', () => {
  const val = parseFloat(savingsGoalInput.value);
  state.savingsGoal = isNaN(val) ? 0 : val;
  saveState(); render();
});

monthSelect.addEventListener('change', render);
yearSelect.addEventListener('change', render);

// ─── Boot ─────────────────────────────────────────────────────────────────────
render();
