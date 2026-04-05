// ─── State ───────────────────────────────────────────────────────────────────
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

let state = loadState();

function defaultState() {
  return { entries: [], savingsGoal: 0, savingsBank: [], cryptoEntries: [] };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('budget_v2')) || defaultState();
    if (!s.savingsBank) s.savingsBank = [];
    if (!s.cryptoEntries) s.cryptoEntries = [];
    return s;
  } catch { return defaultState(); }
}

function saveState() {
  localStorage.setItem('budget_v2', JSON.stringify(state));
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
})();

function currentPeriod() {
  return { month: parseInt(monthSelect.value), year: parseInt(yearSelect.value) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function entriesForPeriod(month, year) {
  return state.entries.filter(e =>
    e.recurring === 'monthly' || (e.month === month && e.year === year)
  );
}

function savingsBankForPeriod(month, year) {
  return state.savingsBank.filter(e =>
    e.recurring === 'monthly' || (e.month === month && e.year === year)
  );
}

function cryptoForPeriod(month, year) {
  return state.cryptoEntries.filter(e =>
    e.recurring === 'monthly' || (e.month === month && e.year === year)
  );
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

function cumulUpTo(arr, month, year) {
  return arr.filter(e => {
    if (e.recurring === 'monthly') return new Date(e.year, e.month) <= new Date(year, month);
    return e.year < year || (e.year === year && e.month <= month);
  }).reduce((s, e) => {
    if (e.recurring === 'monthly') {
      const months = (year - e.year) * 12 + (month - e.month) + 1;
      return s + e.amount * Math.max(1, months);
    }
    return s + e.amount;
  }, 0);
}

function fmt(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  const { month, year } = currentPeriod();
  const entries        = entriesForPeriod(month, year);
  const inc            = totalIncome(entries);
  const exp            = totalExpenses(entries);
  const bal            = inc - exp;
  const goal           = state.savingsGoal || 0;
  const savBankEntries = savingsBankForPeriod(month, year);
  const cryptoEntries  = cryptoForPeriod(month, year);
  const savBankMonth   = totalAmount(savBankEntries);
  const cryptoMonth    = totalAmount(cryptoEntries);
  const savBankCumul   = cumulUpTo(state.savingsBank, month, year);
  const cryptoCumul    = cumulUpTo(state.cryptoEntries, month, year);
  // Reste à vivre = revenus - dépenses - épargne banque - objectif épargne - crypto
  const reste          = inc - exp - savBankMonth - goal - cryptoMonth;
  // Cumul objectif épargne sur les 12 mois de l'année
  const goalYearCumul  = goal * 12;

  // ── Cartes résumé
  document.getElementById('totalIncome').textContent      = fmt(inc);
  document.getElementById('totalExpenses').textContent    = fmt(exp);
  document.getElementById('totalSavingsBank').textContent = fmt(savBankCumul);
  document.getElementById('totalCrypto').textContent      = fmt(cryptoCumul);

  const balEl = document.getElementById('balance');
  balEl.textContent = fmt(bal);
  balEl.className = bal >= 0 ? '' : 'neg';

  document.getElementById('savings').textContent = fmt(goal > 0 ? goal : Math.max(0, bal));

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
  if (reste > 0)      { resteLabel.textContent = '✅ Vous êtes à l\'aise ce mois';       resteLabel.style.color = 'var(--green)'; }
  else if (reste === 0){ resteLabel.textContent = '⚠️ Budget pile';                       resteLabel.style.color = 'var(--yellow)'; }
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
  document.getElementById('savingsBankCumul').textContent = fmt(savBankCumul);
  document.getElementById('cryptoCumul').textContent      = fmt(cryptoCumul);

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
    li.innerHTML = `
      <span class="label">${e.label}</span>
      ${catBadge}${recBadge}
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
    li.innerHTML = `
      <span class="label">${e.label}</span>
      <span class="recurring">${e.recurring === 'monthly' ? '🔁' : '1×'}</span>
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
    li.innerHTML = `
      <span class="label">${e.label}</span>
      <span class="recurring">${e.recurring === 'monthly' ? '🔁' : '1×'}</span>
      <span class="amount" style="color:var(--orange)">${fmt(e.amount)}</span>
      <button class="btn-del" data-id="${e.id}" title="Supprimer">✕</button>
    `;
    ul.appendChild(li);
  });
}

function renderAnnual(year) {
  document.getElementById('annualYear').textContent = year;
  const tbody = document.getElementById('annualBody');
  const tfoot = document.getElementById('annualFoot');
  tbody.innerHTML = '';
  const now = new Date();
  const goal = state.savingsGoal || 0;
  let totInc = 0, totExp = 0, totSavBank = 0, totGoal = 0, totCrypto = 0, totReste = 0;

  MONTHS.forEach((m, i) => {
    const entries  = entriesForPeriod(i, year);
    const inc      = totalIncome(entries);
    const exp      = totalExpenses(entries);
    const savBank  = totalAmount(savingsBankForPeriod(i, year));
    const crypto   = totalAmount(cryptoForPeriod(i, year));
    const reste    = inc - exp - savBank - goal - crypto;
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
  saveState(); render();
  incomeForm.reset();
});

expenseForm.addEventListener('submit', e => {
  e.preventDefault();
  const { month, year } = currentPeriod();
  state.entries.push({
    id: Date.now(), type: 'expense',
    label: document.getElementById('expenseLabel').value.trim(),
    amount: parseFloat(document.getElementById('expenseAmount').value),
    category: document.getElementById('expenseCategory').value,
    recurring: document.getElementById('expenseRecurring').value,
    month, year
  });
  saveState(); render();
  expenseForm.reset();
});

savingsBankForm.addEventListener('submit', e => {
  e.preventDefault();
  const { month, year } = currentPeriod();
  state.savingsBank.push({
    id: Date.now(),
    label: document.getElementById('savingsBankLabel').value.trim(),
    amount: parseFloat(document.getElementById('savingsBankAmount').value),
    recurring: document.getElementById('savingsBankRecurring').value,
    month, year
  });
  saveState(); render();
  savingsBankForm.reset();
});

cryptoForm.addEventListener('submit', e => {
  e.preventDefault();
  const { month, year } = currentPeriod();
  state.cryptoEntries.push({
    id: Date.now(),
    label: document.getElementById('cryptoLabel').value.trim(),
    amount: parseFloat(document.getElementById('cryptoAmount').value),
    recurring: document.getElementById('cryptoRecurring').value,
    month, year
  });
  saveState(); render();
  cryptoForm.reset();
});

document.getElementById('incomeList').addEventListener('click', e => {
  const btn = e.target.closest('.btn-del');
  if (!btn) return;
  state.entries = state.entries.filter(e => e.id !== parseInt(btn.dataset.id));
  saveState(); render();
});

document.getElementById('expenseList').addEventListener('click', e => {
  const btn = e.target.closest('.btn-del');
  if (!btn) return;
  state.entries = state.entries.filter(e => e.id !== parseInt(btn.dataset.id));
  saveState(); render();
});

document.getElementById('savingsBankList').addEventListener('click', e => {
  const btn = e.target.closest('.btn-del');
  if (!btn) return;
  state.savingsBank = state.savingsBank.filter(e => e.id !== parseInt(btn.dataset.id));
  saveState(); render();
});

document.getElementById('cryptoList').addEventListener('click', e => {
  const btn = e.target.closest('.btn-del');
  if (!btn) return;
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
