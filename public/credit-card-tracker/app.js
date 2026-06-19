/* ═══════════════════════════════════════════════════════════════════════════
   Credit Card Rotation & Debt Tracker — Single-Page Application
   All data persisted in localStorage. Indian Rupee (₹) formatting.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Formatting Helpers ─────────────────────────────────────────────────────

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₹0';
  const neg = amount < 0;
  let num = Math.abs(amount).toFixed(2);
  const [intPart, decPart] = num.split('.');
  let result = '';
  if (intPart.length <= 3) {
    result = intPart;
  } else {
    const last3 = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    const groups = [];
    while (remaining.length > 2) {
      groups.unshift(remaining.slice(-2));
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) groups.unshift(remaining);
    result = groups.join(',') + ',' + last3;
  }
  return (neg ? '-' : '') + '₹' + result + '.' + decPart;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = parseInt(parts[2], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parts[0];
  return `${String(d).padStart(2, '0')} ${months[m] || '???'} ${y}`;
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function nowISO() {
  return new Date().toISOString();
}

function getUtilizationColor(pct) {
  if (pct < 50) return 'green';
  if (pct < 80) return 'yellow';
  return 'red';
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Overuse / Overpay Display Helpers ──────────────────────────────────────

function getBalanceDisplayClass(balance) {
  return balance < 0 ? 'text-green' : 'text-red';
}

function getBalanceLabel(balance) {
  return balance < 0 ? 'Credit' : 'Used';
}

function getDisplayBalance(balance) {
  return balance < 0 ? formatCurrency(Math.abs(balance)) : formatCurrency(balance);
}

function getClampedUtil(util) {
  return Math.max(0, util);
}

function getOverLimitHTML(util) {
  if (util > 100) return ' <span class="badge badge--overlimit">⚠️ OVER LIMIT</span>';
  return '';
}

function getCardLabel(c, includeOwner = true) {
  if (!c) return 'Unknown';
  const ownerSuffix = includeOwner && c.owner === 'Dad' ? ' (Dad)' : '';
  return `${c.bankName} ${c.cardName}${ownerSuffix}`;
}

// ─── DataStore ──────────────────────────────────────────────────────────────

const DataStore = {
  _cardsKey: 'cct_cards',
  _txnsKey: 'cct_transactions',
  _groupsKey: 'cct_limit_groups',

  getLastUpdated() {
    return parseInt(localStorage.getItem('cct_last_updated'), 10) || 0;
  },

  setLastUpdated(timestamp) {
    const ts = timestamp || Date.now();
    localStorage.setItem('cct_last_updated', ts.toString());
  },

  getCards() {
    try {
      const cards = JSON.parse(localStorage.getItem(this._cardsKey)) || [];
      return cards.map(c => ({
        owner: 'Self',
        limitGroupId: null,
        ...c
      }));
    } catch { return []; }
  },

  saveCards(cards, skipSync = false) {
    localStorage.setItem(this._cardsKey, JSON.stringify(cards));
    if (!skipSync) {
      this.setLastUpdated();
      FirebaseSyncManager.triggerSyncDebounced();
    }
  },

  getLimitGroups() {
    try {
      return JSON.parse(localStorage.getItem(this._groupsKey)) || [];
    } catch { return []; }
  },

  saveLimitGroups(groups, skipSync = false) {
    localStorage.setItem(this._groupsKey, JSON.stringify(groups));
    if (!skipSync) {
      this.setLastUpdated();
      FirebaseSyncManager.triggerSyncDebounced();
    }
  },

  getTransactions() {
    try {
      return JSON.parse(localStorage.getItem(this._txnsKey)) || [];
    } catch { return []; }
  },

  saveTransactions(txns, skipSync = false) {
    localStorage.setItem(this._txnsKey, JSON.stringify(txns));
    if (!skipSync) {
      this.setLastUpdated();
      FirebaseSyncManager.triggerSyncDebounced();
    }
  },

  exportAll() {
    return JSON.stringify({
      cards: this.getCards(),
      limitGroups: this.getLimitGroups(),
      transactions: this.getTransactions(),
      exportDate: nowISO()
    }, null, 2);
  },

  importAll(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || !Array.isArray(data.cards) || !Array.isArray(data.transactions)) {
        return { success: false, error: 'Invalid backup format. Expected {cards[], transactions[]}.' };
      }
      for (const c of data.cards) {
        if (!c.id || !c.bankName || !c.cardName || c.creditLimit == null) {
          return { success: false, error: 'One or more cards have missing required fields.' };
        }
      }
      for (const t of data.transactions) {
        if (!t.id || !t.cardId || !t.type || t.amount == null) {
          return { success: false, error: 'One or more transactions have missing required fields.' };
        }
      }
      this.saveCards(data.cards);
      this.saveTransactions(data.transactions);
      this.saveLimitGroups(data.limitGroups || []);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed to parse JSON: ' + e.message };
    }
  },

  exportCSV() {
    const txns = this.getTransactions();
    const cards = this.getCards();
    const cardMap = {};
    cards.forEach(c => cardMap[c.id] = getCardLabel(c));
    const header = 'Date,Card,Type,Amount,Note,Friend Name,Friend Settled';
    const rows = txns.map(t => {
      const row = [
        t.date,
        '"' + (cardMap[t.cardId] || 'Unknown').replace(/"/g, '""') + '"',
        t.type,
        t.amount,
        '"' + (t.note || '').replace(/"/g, '""') + '"',
        '"' + (t.friendName || '').replace(/"/g, '""') + '"',
        t.friendSettled ? 'Yes' : (t.type === 'friend_buy' ? 'No' : '')
      ];
      return row.join(',');
    });
    return header + '\n' + rows.join('\n');
  },

  clearAll() {
    localStorage.removeItem(this._cardsKey);
    localStorage.removeItem(this._txnsKey);
    localStorage.removeItem(this._groupsKey);
  }
};

// ─── FirebaseSyncManager ────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCE6hSlSx2w-pMN2IS0RuuZDrylvA5RdEc",
  authDomain: "card-tracker-m.firebaseapp.com",
  databaseURL: "https://card-tracker-m-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "card-tracker-m",
  storageBucket: "card-tracker-m.firebasestorage.app",
  messagingSenderId: "190967790222",
  appId: "1:190967790222:web:ed13d6fd1d0f2011af27df"
};

const FirebaseSyncManager = {
  _syncEnabledKey: 'cct_sync_enabled',
  _syncKeyKey: 'cct_sync_key',
  _lastSyncTimeKey: 'cct_last_sync_time',
  _debounceTimeout: null,
  _status: 'local', // local, syncing, synced, offline, error
  _dbRef: null,
  _firebaseApp: null,

  isEnabled() {
    const enabled = localStorage.getItem(this._syncEnabledKey);
    const key = localStorage.getItem(this._syncKeyKey);
    
    // Force-enable with default key if key is missing, empty, null or undefined
    if (!key || key === 'undefined' || key === 'null') {
      localStorage.setItem(this._syncEnabledKey, 'true');
      localStorage.setItem(this._syncKeyKey, 'default_card_tracker_portfolio');
      return true;
    }
    return enabled === 'true';
  },

  getSyncKey() {
    return localStorage.getItem(this._syncKeyKey) || '';
  },

  getLastSyncTime() {
    return parseInt(localStorage.getItem(this._lastSyncTimeKey), 10) || 0;
  },

  setSyncStatus(status, details = '') {
    this._status = status;
    const badge = document.getElementById('sync-indicator-header');
    if (!badge) return;

    badge.className = 'sync-indicator-header'; // reset
    const dot = badge.querySelector('.sync-dot');
    const text = badge.querySelector('.sync-text');

    if (status === 'local') {
      badge.classList.add('mode-local');
      text.textContent = 'Local';
      badge.title = 'Offline local-only mode. Configure sync in Settings.';
    } else if (status === 'syncing') {
      badge.classList.add('mode-syncing');
      text.textContent = 'Syncing...';
      badge.title = 'Connecting to Firebase...';
    } else if (status === 'synced') {
      badge.classList.add('mode-synced');
      text.textContent = 'Synced';
      const timeStr = details ? ` (Last: ${details})` : '';
      badge.title = `Data is synced with Firebase${timeStr}. Click to sync now.`;
    } else if (status === 'offline') {
      badge.classList.add('mode-offline');
      text.textContent = 'Offline';
      badge.title = 'Offline. Will retry when connected.';
    } else if (status === 'error') {
      badge.classList.add('mode-error');
      text.textContent = 'Sync Error';
      badge.title = `Sync error: ${details}. Check settings.`;
    }
  },

  initFirebase() {
    if (this._firebaseApp) return true;
    try {
      if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded. Check connection.');
      }
      if (firebase.apps.length === 0) {
        this._firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        this._firebaseApp = firebase.app();
      }
      return true;
    } catch (err) {
      console.error('Firebase init error:', err);
      this.setSyncStatus('error', err.message);
      return false;
    }
  },

  async connect(syncKey) {
    if (!syncKey) {
      throw new Error('Sync Key cannot be empty');
    }
    localStorage.setItem(this._syncKeyKey, syncKey);
    localStorage.setItem(this._syncEnabledKey, 'true');
    this.setSyncStatus('syncing');

    if (this.initFirebase()) {
      this.listen();
    }
  },

  disconnect() {
    if (this._dbRef) {
      this._dbRef.off();
      this._dbRef = null;
    }
    localStorage.removeItem(this._syncKeyKey);
    localStorage.setItem(this._syncEnabledKey, 'false');
    localStorage.removeItem(this._lastSyncTimeKey);
    this.setSyncStatus('local');
  },

  listen() {
    if (!this.isEnabled()) return;
    const syncKey = this.getSyncKey();
    if (!syncKey) return;

    if (!this.initFirebase()) return;

    try {
      if (this._dbRef) {
        this._dbRef.off();
      }

      this._dbRef = firebase.database().ref(`sync_data/${syncKey}`);
      this.setSyncStatus('syncing');

      this._dbRef.on('value', snapshot => {
        const remoteData = snapshot.val();
        const localLastUpdated = DataStore.getLastUpdated();

        if (!remoteData) {
          this.pushData();
        } else {
          const remoteLastUpdated = remoteData.lastUpdated || 0;

          if (remoteLastUpdated > localLastUpdated) {
            DataStore.saveCards(remoteData.cards || [], true);
            DataStore.saveTransactions(remoteData.transactions || [], true);
            DataStore.saveLimitGroups(remoteData.limitGroups || [], true);
            DataStore.setLastUpdated(remoteLastUpdated);
            localStorage.setItem(this._lastSyncTimeKey, Date.now().toString());

            this.setSyncStatus('synced', new Date().toLocaleTimeString());
            
            const activeTab = localStorage.getItem('cct_activeTab') || 'dashboard';
            switchTab(activeTab); 
            showToast('Cloud Sync: Downloaded updates.');
          } else if (localLastUpdated > remoteLastUpdated) {
            this.pushData();
          } else {
            localStorage.setItem(this._lastSyncTimeKey, Date.now().toString());
            this.setSyncStatus('synced', new Date().toLocaleTimeString());
          }
        }
      }, err => {
        console.error('Firebase listen error:', err);
        if (!navigator.onLine) {
          this.setSyncStatus('offline');
        } else {
          this.setSyncStatus('error', err.message);
        }
      });
    } catch (err) {
      console.error('Firebase error:', err);
      this.setSyncStatus('error', err.message);
    }
  },

  triggerSyncDebounced() {
    if (!this.isEnabled()) return;
    if (this._debounceTimeout) clearTimeout(this._debounceTimeout);
    this._debounceTimeout = setTimeout(() => {
      this.pushData();
    }, 1500);
  },

  async pushData() {
    if (!this.isEnabled()) return;
    const syncKey = this.getSyncKey();
    if (!syncKey) return;
    if (!this.initFirebase()) return;

    try {
      const localLastUpdated = DataStore.getLastUpdated();
      const backupData = {
        cards: DataStore.getCards(),
        transactions: DataStore.getTransactions(),
        limitGroups: DataStore.getLimitGroups(),
        lastUpdated: localLastUpdated
      };

      await firebase.database().ref(`sync_data/${syncKey}`).set(backupData);
      localStorage.setItem(this._lastSyncTimeKey, Date.now().toString());
      this.setSyncStatus('synced', new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Firebase push error:', err);
      if (!navigator.onLine) {
        this.setSyncStatus('offline');
      } else {
        this.setSyncStatus('error', err.message);
      }
    }
  }
};

// ─── CardManager ────────────────────────────────────────────────────────────

const CardManager = {
  addCard(bankName, cardName, creditLimit, currentBalance, color, owner, limitGroupId = null) {
    const cards = DataStore.getCards();
    const card = {
      id: generateId(),
      bankName: bankName.trim(),
      cardName: cardName.trim(),
      creditLimit: Number(creditLimit) || 0,
      currentBalance: 0, // Starts at 0, transactions will build it
      color: color || '#06b6d4',
      owner: owner || 'Self',
      limitGroupId: limitGroupId || null,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    cards.push(card);
    DataStore.saveCards(cards);

    // Automatically create opening balance transaction if non-zero
    const openingBal = Number(currentBalance) || 0;
    if (openingBal !== 0) {
      TransactionManager.addTransaction({
        cardId: card.id,
        type: openingBal > 0 ? 'spend' : 'payment',
        amount: Math.abs(openingBal),
        date: todayISO(),
        note: 'Opening Balance'
      });
    }

    return card;
  },

  updateCard(id, updates) {
    const cards = DataStore.getCards();
    const idx = cards.findIndex(c => c.id === id);
    if (idx === -1) return null;
    Object.assign(cards[idx], updates, { updatedAt: nowISO() });
    DataStore.saveCards(cards);
    return cards[idx];
  },

  deleteCard(id) {
    let cards = DataStore.getCards();
    cards = cards.filter(c => c.id !== id);
    DataStore.saveCards(cards);
    let txns = DataStore.getTransactions();
    txns = txns.filter(t => t.cardId !== id);
    DataStore.saveTransactions(txns);
  },

  getCard(id) {
    return DataStore.getCards().find(c => c.id === id) || null;
  },

  getAvailableLimit(card) {
    if (card.limitGroupId) {
      const groups = DataStore.getLimitGroups();
      const group = groups.find(g => g.id === card.limitGroupId);
      if (group) {
        const cards = DataStore.getCards();
        const groupCards = cards.filter(c => c.limitGroupId === group.id);
        const totalUsed = groupCards.reduce((sum, c) => sum + c.currentBalance, 0);
        return group.limit - totalUsed;
      }
    }
    return card.creditLimit - card.currentBalance;
  },

  getUtilization(card) {
    if (card.limitGroupId) {
      const groups = DataStore.getLimitGroups();
      const group = groups.find(g => g.id === card.limitGroupId);
      if (group && group.limit > 0) {
        return (card.currentBalance / group.limit) * 100;
      }
    }
    if (card.creditLimit <= 0) return 0;
    return (card.currentBalance / card.creditLimit) * 100;
  },

  recalculateBalance(cardId) {
    const txns = DataStore.getTransactions();
    let balance = 0;
    txns.forEach(t => {
      if (t.cardId === cardId) {
        if (t.type === 'spend' || t.type === 'friend_buy' || t.type === 'transfer') balance += t.amount;
        else if (t.type === 'payment' || t.type === 'refund') balance -= t.amount;
      }
    });
    const cards = DataStore.getCards();
    const idx = cards.findIndex(c => c.id === cardId);
    if (idx !== -1) {
      cards[idx].currentBalance = balance;
      cards[idx].updatedAt = nowISO();
      DataStore.saveCards(cards);
    }
  }
};

// ─── TransactionManager ────────────────────────────────────────────────────

const TransactionManager = {
  addTransaction(data) {
    const txns = DataStore.getTransactions();
    const txn = {
      id: generateId(),
      cardId: data.cardId,
      type: data.type,
      amount: Number(data.amount),
      date: data.date || todayISO(),
      note: (data.note || '').trim(),
      friendName: data.friendName ? data.friendName.trim() : null,
      friendSettled: false,
      createdAt: nowISO()
    };
    txns.push(txn);
    DataStore.saveTransactions(txns);
    this._applyBalanceEffect(txn, 1);
    return txn;
  },

  deleteTransaction(id) {
    const txns = DataStore.getTransactions();
    const idx = txns.findIndex(t => t.id === id);
    if (idx === -1) return false;
    const txn = txns[idx];
    txns.splice(idx, 1);
    DataStore.saveTransactions(txns);
    this._applyBalanceEffect(txn, -1);
    return true;
  },

  _applyBalanceEffect(txn, direction) {
    const cards = DataStore.getCards();
    const srcIdx = cards.findIndex(c => c.id === txn.cardId);

    if (srcIdx !== -1) {
      switch (txn.type) {
        case 'spend':
        case 'friend_buy':
        case 'transfer':
          cards[srcIdx].currentBalance += txn.amount * direction;
          break;
        case 'payment':
        case 'refund':
          cards[srcIdx].currentBalance -= txn.amount * direction;
          break;
      }
      cards[srcIdx].updatedAt = nowISO();
      DataStore.saveCards(cards);
    }
  },

  getTransactions(filters = {}) {
    let txns = DataStore.getTransactions();
    if (filters.cardId) {
      txns = txns.filter(t => t.cardId === filters.cardId);
    }
    if (filters.type) {
      txns = txns.filter(t => t.type === filters.type);
    }
    if (filters.dateFrom) {
      txns = txns.filter(t => t.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      txns = txns.filter(t => t.date <= filters.dateTo);
    }
    txns.sort((a, b) => {
      if (b.date !== a.date) {
        return b.date > a.date ? 1 : -1;
      }
      return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1;
    });
    return txns;
  },

  getFriendDues() {
    const txns = DataStore.getTransactions().filter(t => t.type === 'friend_buy');
    const map = {};
    txns.forEach(t => {
      const name = (t.friendName || 'Unknown').trim();
      if (!map[name]) map[name] = { friendName: name, totalOwed: 0, transactions: [] };
      if (!t.friendSettled) map[name].totalOwed += t.amount;
      map[name].transactions.push(t);
    });
    return Object.values(map);
  },

  settleFriendDue(transactionId) {
    const txns = DataStore.getTransactions();
    const t = txns.find(tx => tx.id === transactionId);
    if (t) {
      t.friendSettled = true;
      DataStore.saveTransactions(txns);
    }
  }
};

// ─── Toast System ───────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const iconMap = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || '✅'}</span>
    <span class="toast-message">${escapeHTML(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Modal System ───────────────────────────────────────────────────────────

function openModal(contentHTML) {
  const overlay = document.getElementById('modal-overlay');
  const card = document.getElementById('modal-card');
  card.innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    ${contentHTML}
  `;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

// ─── Tab Navigation ─────────────────────────────────────────────────────────

const TABS = ['dashboard', 'cards', 'transactions', 'rotation', 'settings'];

function switchTab(tabName) {
  if (!TABS.includes(tabName)) tabName = 'dashboard';
  localStorage.setItem('cct_activeTab', tabName);

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Show/hide sections
  TABS.forEach(t => {
    const section = document.getElementById('tab-' + t);
    if (section) {
      section.classList.toggle('hidden', t !== tabName);
    }
  });

  // Toggle FAB
  const fab = document.getElementById('fab');
  if (fab) fab.classList.toggle('hidden', tabName !== 'transactions');

  // Render
  switch (tabName) {
    case 'dashboard':   renderDashboard(); break;
    case 'cards':       renderCards(); break;
    case 'transactions': renderTransactions(); break;
    case 'rotation':    renderRotation(); break;
    case 'settings':    renderSettings(); break;
  }
}

// ─── Dashboard Rendering ────────────────────────────────────────────────────

function setDashboardFilter(filter) {
  localStorage.setItem('cct_dashboard_filter', filter);
  renderDashboard();
}
window.setDashboardFilter = setDashboardFilter;

function getPortfolioHTML(owner, ownerCards, ownerLimit, ownerUsed, ownerAvail, ownerUtil, ownerColor, groups) {
  const icon = owner === 'Self' ? '👤' : '👨';
  const title = owner === 'Self' ? 'My Portfolio (Self)' : "Dad's Portfolio";
  const ownerBadgeClass = owner === 'Self' ? 'card-owner-badge--self' : 'card-owner-badge--dad';
  const borderColorGroup = '#64748b';

  let pHTML = `
    <div class="portfolio-section">
      <h2 class="portfolio-section-title">${icon} ${title}</h2>
      <div class="summary-row">
        <div class="glass-card glass-card--gradient summary-card">
          <div class="summary-icon">🏦</div>
          <div class="summary-label">Limit</div>
          <div class="summary-value summary-value--cyan">${formatCurrency(ownerLimit)}</div>
        </div>
        <div class="glass-card glass-card--gradient summary-card">
          <div class="summary-icon">🔥</div>
          <div class="summary-label">Used</div>
          <div class="summary-value summary-value--rose">${formatCurrency(ownerUsed)}</div>
        </div>
        <div class="glass-card glass-card--gradient summary-card">
          <div class="summary-icon">✅</div>
          <div class="summary-label">Available</div>
          <div class="summary-value summary-value--emerald">${formatCurrency(ownerAvail)}</div>
        </div>
        <div class="glass-card glass-card--gradient summary-card">
          <div class="summary-icon">📈</div>
          <div class="summary-label">Utilization</div>
          <div class="summary-value util-text-${ownerColor}">${ownerUtil.toFixed(1)}%</div>
        </div>
      </div>
      <div class="card-grid" style="margin-top: 20px;">
  `;

  // Render Groups
  const groupCardsMap = {};
  ownerCards.forEach(c => {
    if (c.limitGroupId) {
      if (!groupCardsMap[c.limitGroupId]) groupCardsMap[c.limitGroupId] = [];
      groupCardsMap[c.limitGroupId].push(c);
    }
  });

  groups.forEach(group => {
    if (group.owner !== owner) return;
    const groupCards = groupCardsMap[group.id] || [];
    if (groupCards.length === 0) return;

    const groupUsed = groupCards.reduce((sum, c) => sum + c.currentBalance, 0);
    const groupAvail = group.limit - groupUsed;
    const groupUtil = group.limit > 0 ? (groupUsed / group.limit) * 100 : 0;
    const groupColor = getUtilizationColor(groupUtil);

    pHTML += `
      <div class="glass-card credit-card shared-limit-group" style="border-top: 3px solid ${borderColorGroup};">
        <div class="card-owner-badge ${ownerBadgeClass}">${escapeHTML(group.owner)}</div>
        <div class="group-header">
          <div>
            <div class="group-title">${escapeHTML(group.name)}</div>
            <div class="group-subtitle">Shared Limit Group</div>
          </div>
        </div>
        <div class="card-details">
          <div>
            <div class="card-detail-label">Shared Limit</div>
            <div class="card-detail-value">${formatCurrency(group.limit)}</div>
          </div>
          <div>
            <div class="card-detail-label">${groupUsed < 0 ? 'Credit' : 'Total Used'}</div>
            <div class="card-detail-value ${getBalanceDisplayClass(groupUsed)}">${getDisplayBalance(groupUsed)}</div>
          </div>
          <div>
            <div class="card-detail-label">Available</div>
            <div class="card-detail-value util-text-${groupColor}">${formatCurrency(groupAvail)}</div>
          </div>
        </div>
        <div class="utilization-bar-wrap">
          <div class="utilization-header">
            <span class="utilization-label">Group Utilization${getOverLimitHTML(groupUtil)}</span>
            <span class="utilization-pct util-text-${groupColor}">${getClampedUtil(groupUtil).toFixed(1)}%</span>
          </div>
          <div class="utilization-bar">
            <div class="utilization-fill util-${groupColor}" style="width: ${Math.max(0, Math.min(groupUtil, 100))}%;"></div>
          </div>
        </div>
        <div class="group-cards-list">
          ${groupCards.map(gc => {
            const gcSharePct = group.limit > 0 ? (gc.currentBalance / group.limit) * 100 : 0;
            return `
              <div class="group-card-item">
                <div class="group-card-info">
                  <span class="group-card-color-dot" style="color: ${escapeHTML(gc.color)}; background: ${escapeHTML(gc.color)};"></span>
                  <span class="group-card-name">${escapeHTML(gc.cardName)}</span>
                </div>
                <div class="group-card-used">
                  <span class="group-card-used-val">${formatCurrency(gc.currentBalance)}</span>
                  <span class="group-card-share-pct">(${gcSharePct.toFixed(1)}% of limit)</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  // Render Individual Cards
  ownerCards.forEach(c => {
    if (c.limitGroupId) return;

    const util = CardManager.getUtilization(c);
    const avail = CardManager.getAvailableLimit(c);
    const uColor = getUtilizationColor(util);

    pHTML += `
      <div class="glass-card credit-card" style="border-top: 3px solid ${escapeHTML(c.color)};">
        <div class="card-owner-badge ${ownerBadgeClass}">${escapeHTML(c.owner)}</div>
        <div class="card-bank">${escapeHTML(c.bankName)}</div>
        <div class="card-name">${escapeHTML(c.cardName)}</div>
        <div class="card-details">
          <div>
            <div class="card-detail-label">Limit</div>
            <div class="card-detail-value">${formatCurrency(c.creditLimit)}</div>
          </div>
          <div>
            <div class="card-detail-label">${getBalanceLabel(c.currentBalance)}</div>
            <div class="card-detail-value ${getBalanceDisplayClass(c.currentBalance)}">${getDisplayBalance(c.currentBalance)}</div>
          </div>
          <div>
            <div class="card-detail-label">Available</div>
            <div class="card-detail-value util-text-${uColor}">${formatCurrency(avail)}</div>
          </div>
        </div>
        <div class="utilization-bar-wrap">
          <div class="utilization-header">
            <span class="utilization-label">Utilization${getOverLimitHTML(util)}</span>
            <span class="utilization-pct util-text-${uColor}">${getClampedUtil(util).toFixed(1)}%</span>
          </div>
          <div class="utilization-bar">
            <div class="utilization-fill util-${uColor}" style="width: ${Math.max(0, Math.min(util, 100))}%;"></div>
          </div>
        </div>
      </div>
    `;
  });

  pHTML += `</div></div>`;
  return pHTML;
}

function renderDashboard() {
  const container = document.getElementById('tab-dashboard');
  const cards = DataStore.getCards();

  if (cards.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💳</div>
        <div class="empty-title">No Cards Added</div>
        <div class="empty-desc">Go to the <strong>Cards</strong> tab to add your first credit card and start tracking.</div>
        <button class="btn-primary" onclick="switchTab('cards')">+ Add Your First Card</button>
      </div>
    `;
    return;
  }

  const groups = DataStore.getLimitGroups();
  const activeFilter = localStorage.getItem('cct_dashboard_filter') || 'all';

  // Split cards and calculate stats for Self
  const selfCards = cards.filter(c => c.owner === 'Self');
  let selfLimit = 0, selfUsed = 0;
  const selfCountedGroupIds = new Set();
  selfCards.forEach(c => {
    selfUsed += c.currentBalance;
    if (c.limitGroupId) {
      if (!selfCountedGroupIds.has(c.limitGroupId)) {
        selfCountedGroupIds.add(c.limitGroupId);
        const group = groups.find(g => g.id === c.limitGroupId);
        if (group) selfLimit += group.limit;
      }
    } else {
      selfLimit += c.creditLimit;
    }
  });
  const selfAvail = selfLimit - selfUsed;
  const selfUtil = selfLimit > 0 ? (selfUsed / selfLimit) * 100 : 0;
  const selfColor = getUtilizationColor(selfUtil);

  // Split cards and calculate stats for Dad
  const dadCards = cards.filter(c => c.owner === 'Dad');
  let dadLimit = 0, dadUsed = 0;
  const dadCountedGroupIds = new Set();
  dadCards.forEach(c => {
    dadUsed += c.currentBalance;
    if (c.limitGroupId) {
      if (!dadCountedGroupIds.has(c.limitGroupId)) {
        dadCountedGroupIds.add(c.limitGroupId);
        const group = groups.find(g => g.id === c.limitGroupId);
        if (group) dadLimit += group.limit;
      }
    } else {
      dadLimit += c.creditLimit;
    }
  });
  const dadAvail = dadLimit - dadUsed;
  const dadUtil = dadLimit > 0 ? (dadUsed / dadLimit) * 100 : 0;
  const dadColor = getUtilizationColor(dadUtil);

  // HTML Rendering
  let html = `
    <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
      <div>
        <div class="section-title">Dashboard</div>
        <div class="section-subtitle">Real-time credit cards & limit utilization tracker</div>
      </div>
      <div class="dashboard-filter-bar">
        <button class="filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all" onclick="setDashboardFilter('all')">🌐 All</button>
        <button class="filter-btn ${activeFilter === 'self' ? 'active' : ''}" data-filter="self" onclick="setDashboardFilter('self')">👤 Self</button>
        <button class="filter-btn ${activeFilter === 'dad' ? 'active' : ''}" data-filter="dad" onclick="setDashboardFilter('dad')">👨 Dad</button>
      </div>
    </div>
  `;

  // 1. COMBINED OVERVIEW CARD
  if (activeFilter === 'all') {
    html += `
      <div class="glass-card combined-summary-card" style="margin-bottom: 32px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--cyan); background: linear-gradient(135deg, rgba(6,182,212,0.05) 0%, rgba(255,255,255,0.02) 100%);">
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Combined Credit Utilization</div>
          <div style="font-size:2.0rem; font-weight:800; color:var(--text-primary); margin-top:4px; font-variant-numeric: tabular-nums;">
            ${formatCurrency(selfUsed + dadUsed)}
          </div>
          <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:4px;">
            Across ${cards.length} active credit cards
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Total Combined Limit</div>
          <div style="font-size:1.25rem; font-weight:700; color:var(--text-secondary); margin-top:4px; font-variant-numeric: tabular-nums;">
            ${formatCurrency(selfLimit + dadLimit)}
          </div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">
            Available: ${formatCurrency((selfLimit + dadLimit) - (selfUsed + dadUsed))}
          </div>
        </div>
      </div>
    `;
  }

  // 2. PORTFOLIOS RENDERING
  if (activeFilter === 'all') {
    html += `
      <div class="portfolio-split-grid">
        <div class="portfolio-column">
          ${getPortfolioHTML('Self', selfCards, selfLimit, selfUsed, selfAvail, selfUtil, selfColor, groups)}
        </div>
        <div class="portfolio-column">
          ${getPortfolioHTML('Dad', dadCards, dadLimit, dadUsed, dadAvail, dadUtil, dadColor, groups)}
        </div>
      </div>
    `;
  } else if (activeFilter === 'self') {
    html += getPortfolioHTML('Self', selfCards, selfLimit, selfUsed, selfAvail, selfUtil, selfColor, groups);
  } else if (activeFilter === 'dad') {
    html += getPortfolioHTML('Dad', dadCards, dadLimit, dadUsed, dadAvail, dadUtil, dadColor, groups);
  }

  // 3. CHART SECTION
  const displayFilterLabel = activeFilter === 'all' ? 'Combined' : activeFilter === 'self' ? 'Self' : "Dad's";
  html += `
    <div class="section-header" style="margin-top: 32px;">
      <div>
        <div class="section-title">Utilization Chart</div>
        <div class="section-subtitle">Visual overview of card usage (${displayFilterLabel})</div>
      </div>
    </div>
    <div class="glass-card" style="padding: 24px;">
      <canvas id="utilChart" height="220" style="width: 100%;"></canvas>
    </div>
  `;

  container.innerHTML = html;

  let filteredCardsForChart = cards;
  if (activeFilter === 'self') {
    filteredCardsForChart = selfCards;
  } else if (activeFilter === 'dad') {
    filteredCardsForChart = dadCards;
  }
  drawUtilizationChart(filteredCardsForChart);
}

function drawUtilizationChart(cards) {
  const canvas = document.getElementById('utilChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 220 * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = 220;
  const padding = { top: 20, right: 20, bottom: 50, left: 50 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  ctx.clearRect(0, 0, W, H);
  if (cards.length === 0) return;

  const groups = DataStore.getLimitGroups();
  const chartItems = [];

  // Group cards mapping
  const groupCardsMap = {};
  cards.forEach(c => {
    if (c.limitGroupId) {
      if (!groupCardsMap[c.limitGroupId]) groupCardsMap[c.limitGroupId] = [];
      groupCardsMap[c.limitGroupId].push(c);
    }
  });

  // Collect shared groups
  groups.forEach(g => {
    const groupCards = groupCardsMap[g.id] || [];
    if (groupCards.length === 0) return;
    const groupUsed = groupCards.reduce((sum, c) => sum + c.currentBalance, 0);
    const groupUtil = g.limit > 0 ? (groupUsed / g.limit) * 100 : 0;
    chartItems.push({
      label: g.name.replace(" Shared Limit", "").replace(" Group", ""),
      util: groupUtil,
      color: g.owner === 'Dad' ? '#a855f7' : '#06b6d4'
    });
  });

  // Collect individual cards
  cards.forEach(c => {
    if (!c.limitGroupId) {
      chartItems.push({
        label: c.cardName,
        util: CardManager.getUtilization(c),
        color: c.owner === 'Dad' ? '#a855f7' : '#06b6d4'
      });
    }
  });

  if (chartItems.length === 0) return;

  const barWidth = Math.min(60, (chartW / chartItems.length) * 0.6);
  const gap = (chartW - barWidth * chartItems.length) / (chartItems.length + 1);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + chartH - (chartH * i / 4);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();
    ctx.fillText((i * 25) + '%', 4, y + 4);
  }

  // Bars
  const colors = { green: '#10b981', yellow: '#f59e0b', red: '#f43f5e' };
  chartItems.forEach((item, i) => {
    const util = Math.max(0, Math.min(item.util, 100));
    const x = padding.left + gap + i * (barWidth + gap);
    const barH = (util / 100) * chartH;
    const y = padding.top + chartH - barH;
    const uColor = getUtilizationColor(util);

    const barColor = item.color === '#64748b' ? colors[uColor] : item.color;

    // Bar
    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
    ctx.fill();

    // Glow effect
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 8;
    ctx.fillRect(x, y, barWidth, 2);
    ctx.shadowBlur = 0;

    // Value label
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(util.toFixed(0) + '%', x + barWidth / 2, y - 5);

    // Label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, system-ui, sans-serif';
    const displayLabel = item.label.length > 10 ? item.label.slice(0, 9) + '…' : item.label;
    ctx.save();
    ctx.translate(x + barWidth / 2, padding.top + chartH + 10);
    ctx.rotate(Math.PI / 6);
    ctx.textAlign = 'left';
    ctx.fillText(displayLabel, 0, 0);
    ctx.restore();
  });
  ctx.textAlign = 'start';
}

// ─── Cards Tab ──────────────────────────────────────────────────────────────

function renderCards() {
  const container = document.getElementById('tab-cards');
  const cards = DataStore.getCards();

  let html = `
    <div class="section-header">
      <div>
        <div class="section-title">My Cards</div>
        <div class="section-subtitle">Manage your credit cards</div>
      </div>
      <button class="btn-primary" onclick="openCardModal()">+ Add Card</button>
    </div>
  `;

  if (cards.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">💳</div>
        <div class="empty-title">No Cards Yet</div>
        <div class="empty-desc">Click <strong>+ Add Card</strong> to add your first credit card.</div>
      </div>
    `;
  } else {
    html += `<div class="card-grid">`;

    const groups = DataStore.getLimitGroups();
    const groupCardsMap = {};
    cards.forEach(c => {
      if (c.limitGroupId) {
        if (!groupCardsMap[c.limitGroupId]) groupCardsMap[c.limitGroupId] = [];
        groupCardsMap[c.limitGroupId].push(c);
      }
    });

    // 1. Render Groups in Cards tab
    groups.forEach(group => {
      const groupCards = groupCardsMap[group.id] || [];
      if (groupCards.length === 0) return;

      const groupUsed = groupCards.reduce((sum, c) => sum + c.currentBalance, 0);
      const groupAvail = group.limit - groupUsed;
      const groupUtil = group.limit > 0 ? (groupUsed / group.limit) * 100 : 0;
      const groupColor = getUtilizationColor(groupUtil);
      const ownerClass = group.owner === 'Dad' ? 'card-owner-badge--dad' : 'card-owner-badge--self';

      html += `
        <div class="glass-card credit-card shared-limit-group" style="border-top: 3px solid #64748b;">
          <div class="card-owner-badge ${ownerClass}">${escapeHTML(group.owner)}</div>
          <div class="group-header">
            <div>
              <div class="group-title">
                ${escapeHTML(group.name)}
                <button class="btn-icon" onclick="openEditGroupModal('${group.id}')" title="Edit Group Limit" style="width:24px;height:24px;font-size:0.75rem;margin-left:8px;">✏️</button>
              </div>
              <div class="group-subtitle">Shared Limit Group</div>
            </div>
          </div>
          <div class="card-details">
            <div>
              <div class="card-detail-label">Shared Limit</div>
              <div class="card-detail-value">${formatCurrency(group.limit)}</div>
            </div>
            <div>
              <div class="card-detail-label">${groupUsed < 0 ? 'Credit' : 'Total Used'}</div>
              <div class="card-detail-value ${getBalanceDisplayClass(groupUsed)}">${getDisplayBalance(groupUsed)}</div>
            </div>
            <div>
              <div class="card-detail-label">Available</div>
              <div class="card-detail-value util-text-${groupColor}">${formatCurrency(groupAvail)}</div>
            </div>
          </div>
          <div class="utilization-bar-wrap">
            <div class="utilization-header">
              <span class="utilization-label">Group Utilization${getOverLimitHTML(groupUtil)}</span>
              <span class="utilization-pct util-text-${groupColor}">${getClampedUtil(groupUtil).toFixed(1)}%</span>
            </div>
            <div class="utilization-bar">
              <div class="utilization-fill util-${groupColor}" style="width: ${Math.max(0, Math.min(groupUtil, 100))}%;"></div>
            </div>
          </div>
          <div class="group-cards-list">
            ${groupCards.map(gc => {
              const gcSharePct = group.limit > 0 ? (gc.currentBalance / group.limit) * 100 : 0;
              return `
                <div class="group-card-item">
                  <div class="group-card-info">
                    <span class="group-card-color-dot" style="color: ${escapeHTML(gc.color)}; background: ${escapeHTML(gc.color)};"></span>
                    <span class="group-card-name">${escapeHTML(gc.cardName)}</span>
                  </div>
                  <div class="group-card-used">
                    <span class="group-card-used-val">${formatCurrency(gc.currentBalance)}</span>
                    <span class="group-card-share-pct">(${gcSharePct.toFixed(1)}%)</span>
                    <div class="group-card-actions">
                      <button class="btn-icon" onclick="openCardModal('${gc.id}')" title="Edit Card" style="width:24px;height:24px;font-size:0.75rem;">✏️</button>
                      <button class="btn-icon text-red" onclick="confirmDeleteCard('${gc.id}')" title="Delete Card" style="width:24px;height:24px;font-size:0.75rem;">🗑️</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    // 2. Render Individual Cards
    cards.forEach(c => {
      if (c.limitGroupId) return;

      const util = CardManager.getUtilization(c);
      const avail = CardManager.getAvailableLimit(c);
      const uColor = getUtilizationColor(util);
      const ownerClass = c.owner === 'Dad' ? 'card-owner-badge--dad' : 'card-owner-badge--self';

      html += `
        <div class="glass-card credit-card" style="border-top: 3px solid ${escapeHTML(c.color)};">
          <div class="card-owner-badge ${ownerClass}">${escapeHTML(c.owner)}</div>
          <div class="card-bank">${escapeHTML(c.bankName)}</div>
          <div class="card-name">${escapeHTML(c.cardName)}</div>
          <div class="card-details">
            <div>
              <div class="card-detail-label">Limit</div>
              <div class="card-detail-value">${formatCurrency(c.creditLimit)}</div>
            </div>
            <div>
              <div class="card-detail-label">${getBalanceLabel(c.currentBalance)}</div>
              <div class="card-detail-value ${getBalanceDisplayClass(c.currentBalance)}">${getDisplayBalance(c.currentBalance)}</div>
            </div>
            <div>
              <div class="card-detail-label">Available</div>
              <div class="card-detail-value util-text-${uColor}">${formatCurrency(avail)}</div>
            </div>
          </div>
          <div class="utilization-bar-wrap">
            <div class="utilization-header">
              <span class="utilization-label">Utilization${getOverLimitHTML(util)}</span>
              <span class="utilization-pct util-text-${uColor}">${getClampedUtil(util).toFixed(1)}%</span>
            </div>
            <div class="utilization-bar">
              <div class="utilization-fill util-${uColor}" style="width: ${Math.max(0, Math.min(util, 100))}%;"></div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:16px;">
            <button class="btn-secondary" onclick="openCardModal('${c.id}')">✏️ Edit</button>
            <button class="btn-danger" onclick="confirmDeleteCard('${c.id}')">🗑️ Delete</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  container.innerHTML = html;
}

function openEditGroupModal(groupId) {
  const groups = DataStore.getLimitGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) return;

  const html = `
    <div class="modal-title">Edit Shared Limit Group</div>
    <div class="modal-subtitle">Update aggregated limit settings</div>
    <form id="groupEditForm">
      <div class="form-group">
        <label class="form-label" for="inp-group-name">Group Name</label>
        <input type="text" id="inp-group-name" class="form-input" value="${escapeHTML(group.name)}" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="inp-group-limit">Shared Limit (₹)</label>
        <input type="number" id="inp-group-limit" class="form-input" value="${group.limit}" min="1" step="1" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="inp-group-owner">Cardholder</label>
        <select id="inp-group-owner" class="form-select" required>
          <option value="Self" ${group.owner === 'Self' ? 'selected' : ''}>Self</option>
          <option value="Dad" ${group.owner === 'Dad' ? 'selected' : ''}>Dad</option>
        </select>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `;
  openModal(html);

  document.getElementById('groupEditForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('inp-group-name').value.trim();
    const limit = parseFloat(document.getElementById('inp-group-limit').value);
    const owner = document.getElementById('inp-group-owner').value;

    if (!name || isNaN(limit) || limit <= 0) {
      showToast('Please enter valid group name and limit.', 'error');
      return;
    }

    group.name = name;
    group.limit = limit;
    group.owner = owner;

    // Update all cards in this group to match the owner
    const cards = DataStore.getCards();
    cards.forEach(c => {
      if (c.limitGroupId === group.id) {
        c.owner = owner;
      }
    });

    DataStore.saveLimitGroups(groups);
    DataStore.saveCards(cards);
    closeModal();
    showToast('Shared Limit Group updated!');
    renderCards();
  });
}

function openCardModal(cardId) {
  const card = cardId ? CardManager.getCard(cardId) : null;
  const title = card ? 'Edit Card' : 'Add New Card';
  const subtitle = card ? 'Update your card details' : 'Enter your card information';
  const groups = DataStore.getLimitGroups();

  const html = `
    <div class="modal-title">${title}</div>
    <div class="modal-subtitle">${subtitle}</div>
    <form id="cardForm">
      <div class="form-group">
        <label class="form-label" for="inp-bankName">Bank Name</label>
        <input type="text" id="inp-bankName" class="form-input" value="${card ? escapeHTML(card.bankName) : ''}" placeholder="e.g. HDFC, ICICI, SBI" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="inp-cardName">Card Name</label>
        <input type="text" id="inp-cardName" class="form-input" value="${card ? escapeHTML(card.cardName) : ''}" placeholder="e.g. Regalia, Amazon Pay" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="inp-owner">Cardholder / Owner</label>
        <select id="inp-owner" class="form-select" required>
          <option value="Self" ${card && card.owner === 'Self' ? 'selected' : ''}>Self (Me)</option>
          <option value="Dad" ${card && card.owner === 'Dad' ? 'selected' : ''}>Dad</option>
        </select>
      </div>

      <div class="form-group" style="margin-top: 16px; margin-bottom: 8px;">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500;">
          <input type="checkbox" id="inp-isShared" style="width:16px;height:16px;cursor:pointer;" ${card && card.limitGroupId ? 'checked' : ''} onchange="toggleSharedLimitFields()">
          <span>Shares limit with other cards? (Aggregated Limit)</span>
        </label>
      </div>

      <!-- Shared Limit Configuration fields -->
      <div id="shared-limit-fields" class="form-group ${card && card.limitGroupId ? '' : 'hidden'}" style="border-left: 2px solid var(--cyan); padding-left: 12px; margin-top: 8px; margin-bottom: 16px;">
        <label class="form-label" for="inp-limitGroup">Shared Limit Group</label>
        <select id="inp-limitGroup" class="form-select" onchange="onLimitGroupSelectChange()">
          <option value="">-- Create a new Shared Limit Group --</option>
          ${groups.map(g => `<option value="${g.id}" ${card && card.limitGroupId === g.id ? 'selected' : ''}>${escapeHTML(g.name)} (Limit: ${formatCurrency(g.limit)})</option>`).join('')}
        </select>

        <!-- New group inputs -->
        <div id="new-group-fields" class="form-row" style="margin-top: 8px;">
          <div class="form-group">
            <label class="form-label" for="inp-newGroupName">Group Name</label>
            <input type="text" id="inp-newGroupName" class="form-input" placeholder="e.g. ICICI Shared Limit">
          </div>
          <div class="form-group">
            <label class="form-label" for="inp-newGroupLimit">Shared Limit Amount (₹)</label>
            <input type="number" id="inp-newGroupLimit" class="form-input" placeholder="120000" min="1" step="1">
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group ${card && card.limitGroupId ? 'hidden' : ''}" id="grp-creditLimit">
          <label class="form-label" for="inp-creditLimit">Credit Limit (₹)</label>
          <input type="number" id="inp-creditLimit" class="form-input" value="${card ? card.creditLimit : ''}" placeholder="200000" min="0" step="1" ${card && card.limitGroupId ? '' : 'required'}>
        </div>
        <div class="form-group">
          <label class="form-label" for="inp-currentBalance">Outstanding (₹)</label>
          <input type="number" id="inp-currentBalance" class="form-input" value="${card ? card.currentBalance : '0'}" placeholder="0" step="0.01" ${card ? 'disabled style="opacity:0.6;cursor:not-allowed;"' : ''}>
          ${card ? '<span style="font-size:0.72rem;color:var(--text-muted);display:block;margin-top:4px;">Update outstanding balance by recording transactions.</span>' : ''}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="inp-color">Card Color</label>
        <div style="display:flex;align-items:center;gap:12px;">
          <input type="color" id="inp-color" value="${card ? card.color : '#06b6d4'}" style="width:50px;height:38px;border:none;cursor:pointer;background:none;border-radius:8px;">
          <span id="colorPreview" style="display:inline-block;width:32px;height:32px;border-radius:8px;background:${card ? card.color : '#06b6d4'};box-shadow:0 0 12px rgba(6,182,212,0.3);"></span>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">${card ? 'Update Card' : 'Add Card'}</button>
      </div>
    </form>
  `;
  openModal(html);

  // Initialize display states
  if (card && card.limitGroupId) {
    document.getElementById('grp-creditLimit').classList.add('hidden');
    onLimitGroupSelectChange();
  }

  document.getElementById('inp-color').addEventListener('input', e => {
    document.getElementById('colorPreview').style.background = e.target.value;
  });

  document.getElementById('cardForm').addEventListener('submit', e => {
    e.preventDefault();
    const bankName = document.getElementById('inp-bankName').value.trim();
    const cardName = document.getElementById('inp-cardName').value.trim();
    let owner = document.getElementById('inp-owner').value;
    const currentBalance = parseFloat(document.getElementById('inp-currentBalance').value) || 0;
    const color = document.getElementById('inp-color').value;

    const isShared = document.getElementById('inp-isShared').checked;
    let limitGroupId = null;
    let creditLimit = 0;

    if (isShared) {
      const selectedGroupId = document.getElementById('inp-limitGroup').value;
      if (selectedGroupId) {
        limitGroupId = selectedGroupId;
        const targetGroup = DataStore.getLimitGroups().find(g => g.id === selectedGroupId);
        if (targetGroup) owner = targetGroup.owner; // sync owner with group
      } else {
        const groupName = document.getElementById('inp-newGroupName').value.trim();
        const groupLimit = parseFloat(document.getElementById('inp-newGroupLimit').value);
        if (!groupName || isNaN(groupLimit) || groupLimit <= 0) {
          showToast('Please enter valid group name and limit.', 'error');
          return;
        }

        const groups = DataStore.getLimitGroups();
        const newGroup = {
          id: 'group_' + generateId(),
          name: groupName,
          limit: groupLimit,
          owner: owner
        };
        groups.push(newGroup);
        DataStore.saveLimitGroups(groups);
        limitGroupId = newGroup.id;
      }
    } else {
      creditLimit = parseFloat(document.getElementById('inp-creditLimit').value);
      if (isNaN(creditLimit) || creditLimit < 0) {
        showToast('Credit limit must be a positive number or zero.', 'error');
        return;
      }
    }

    if (!bankName || !cardName) { showToast('Bank name and card name are required.', 'error'); return; }
    if (isNaN(currentBalance)) { showToast('Balance must be a valid number.', 'error'); return; }

    if (card) {
      CardManager.updateCard(card.id, { bankName, cardName, creditLimit, color, owner, limitGroupId });
      showToast('Card updated successfully!');
    } else {
      CardManager.addCard(bankName, cardName, creditLimit, currentBalance, color, owner, limitGroupId);
      showToast('Card added successfully!');
    }
    closeModal();
    renderCards();
  });
}

function toggleSharedLimitFields() {
  const isShared = document.getElementById('inp-isShared').checked;
  const sharedFields = document.getElementById('shared-limit-fields');
  const normalLimitGrp = document.getElementById('grp-creditLimit');
  const normalLimitInp = document.getElementById('inp-creditLimit');

  if (isShared) {
    sharedFields.classList.remove('hidden');
    normalLimitGrp.classList.add('hidden');
    normalLimitInp.removeAttribute('required');
    onLimitGroupSelectChange();
  } else {
    sharedFields.classList.add('hidden');
    normalLimitGrp.classList.remove('hidden');
    normalLimitInp.setAttribute('required', 'true');
  }
}

function onLimitGroupSelectChange() {
  const select = document.getElementById('inp-limitGroup');
  const newGroupFields = document.getElementById('new-group-fields');
  const nameInp = document.getElementById('inp-newGroupName');
  const limitInp = document.getElementById('inp-newGroupLimit');

  if (!select) return;

  if (select.value === "") {
    newGroupFields.classList.remove('hidden');
    nameInp.setAttribute('required', 'true');
    limitInp.setAttribute('required', 'true');
  } else {
    newGroupFields.classList.add('hidden');
    nameInp.removeAttribute('required');
    limitInp.removeAttribute('required');
  }
}

function confirmDeleteCard(cardId) {
  const card = CardManager.getCard(cardId);
  if (!card) return;
  const html = `
    <div class="modal-title text-red">Delete Card?</div>
    <div class="modal-subtitle">This action cannot be undone.</div>
    <p style="color: var(--text-secondary); margin-bottom: 16px;">
      Are you sure you want to delete <strong>${escapeHTML(getCardLabel(card))}</strong>?<br>
      All associated transactions will also be deleted.
    </p>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="doDeleteCard('${card.id}')">Delete Card</button>
    </div>
  `;
  openModal(html);
}

function doDeleteCard(id) {
  CardManager.deleteCard(id);
  closeModal();
  showToast('Card deleted.');
  renderCards();
}

// ─── Transactions Tab ───────────────────────────────────────────────────────

function renderTransactions() {
  const container = document.getElementById('tab-transactions');
  const cards = DataStore.getCards();

  let html = `
    <div class="section-header">
      <div>
        <div class="section-title">Transactions</div>
        <div class="section-subtitle">All your card activity</div>
      </div>
    </div>
  `;

  // Filter bar
  html += `<div class="filter-bar">`;
  html += `
    <div class="filter-group">
      <label>Card</label>
      <select id="filter-card" class="form-select" onchange="applyTransactionFilters()">
        <option value="">All Cards</option>
        ${cards.map(c => `<option value="${c.id}">${escapeHTML(getCardLabel(c))}</option>`).join('')}
      </select>
    </div>
    <div class="filter-group">
      <label>Type</label>
      <select id="filter-type" class="form-select" onchange="applyTransactionFilters()">
        <option value="">All Types</option>
        <option value="spend">Spend</option>
        <option value="payment">Payment</option>
        <option value="transfer">Transfer</option>
        <option value="refund">Refund</option>
        <option value="friend_buy">Friend Buy</option>
      </select>
    </div>
    <div class="filter-group">
      <label>From</label>
      <input type="date" id="filter-dateFrom" class="form-date" onchange="applyTransactionFilters()">
    </div>
    <div class="filter-group">
      <label>To</label>
      <input type="date" id="filter-dateTo" class="form-date" onchange="applyTransactionFilters()">
    </div>
  `;
  html += `</div>`;
  html += `<div id="txn-table-wrapper"></div>`;

  container.innerHTML = html;
  applyTransactionFilters();
}

function applyTransactionFilters() {
  const filters = {};
  const cardFilter = document.getElementById('filter-card');
  const typeFilter = document.getElementById('filter-type');
  const fromFilter = document.getElementById('filter-dateFrom');
  const toFilter = document.getElementById('filter-dateTo');
  if (cardFilter && cardFilter.value) filters.cardId = cardFilter.value;
  if (typeFilter && typeFilter.value) filters.type = typeFilter.value;
  if (fromFilter && fromFilter.value) filters.dateFrom = fromFilter.value;
  if (toFilter && toFilter.value) filters.dateTo = toFilter.value;

  const txns = TransactionManager.getTransactions(filters);
  const cards = DataStore.getCards();
  const cardMap = {};
  cards.forEach(c => cardMap[c.id] = c);

  const wrapper = document.getElementById('txn-table-wrapper');
  if (!wrapper) return;

  if (txns.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state" style="padding: 40px;">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No Transactions Found</div>
        <div class="empty-desc">Click the <strong>+</strong> button to add your first transaction.</div>
      </div>
    `;
    return;
  }

  const badgeClasses = {
    spend: 'badge--spend',
    payment: 'badge--payment',
    transfer: 'badge--transfer',
    refund: 'badge--refund',
    friend_buy: 'badge--friendbuy'
  };
  const typeLabels = {
    spend: 'Spend',
    payment: 'Payment',
    transfer: 'Transfer',
    refund: 'Refund',
    friend_buy: 'Friend Buy'
  };

  let tbl = `<div class="txn-table-wrap"><table class="txn-table">
    <thead><tr>
      <th>Date</th><th>Card</th><th>Type</th><th>Amount</th><th>Note</th><th>Actions</th>
    </tr></thead><tbody>`;
  txns.forEach(t => {
    const c = cardMap[t.cardId];
    const cardLabel = c ? escapeHTML(getCardLabel(c)) : 'Unknown';
    let noteDisplay = escapeHTML(t.note || '');
    if (t.type === 'friend_buy' && t.friendName) {
      noteDisplay += (noteDisplay ? ' · ' : '') + '👤 ' + escapeHTML(t.friendName);
      if (t.friendSettled) noteDisplay += ' ✅';
    }

    const isDebit = ['spend', 'friend_buy', 'transfer'].includes(t.type);
    let dateDisplay = `<span style="font-size:0.85rem;">${formatDate(t.date)}</span>`;

    tbl += `<tr>
      <td>${dateDisplay}</td>
      <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c ? c.color : '#888'};margin-right:8px;"></span>${cardLabel}</td>
      <td><span class="badge ${badgeClasses[t.type] || ''}">${typeLabels[t.type] || t.type}</span></td>
      <td class="txn-amount ${isDebit ? 'amount-debit' : 'amount-credit'}">${formatCurrency(t.amount)}</td>
      <td style="color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${noteDisplay || '—'}</td>
      <td>
        <button class="btn-icon" onclick="redoTransaction('${t.id}')" title="Repeat / Redo Transaction">🔄</button>
        <button class="btn-icon" onclick="confirmDeleteTxn('${t.id}')" title="Delete">🗑️</button>
      </td>
    </tr>`;
  });
  tbl += `</tbody></table></div>`;
  wrapper.innerHTML = tbl;
}

function openTransactionModal(preFillData = null) {
  const cards = DataStore.getCards();
  if (cards.length === 0) {
    showToast('Add a card first before recording transactions.', 'error');
    return;
  }
  const lastCardId = preFillData ? preFillData.cardId : (localStorage.getItem('cct_lastCardId') || cards[0].id);
  const type = preFillData ? preFillData.type : 'spend';
  const amount = preFillData ? preFillData.amount : '';
  const note = preFillData ? preFillData.note : '';
  const friendName = (preFillData && preFillData.friendName) ? preFillData.friendName : '';

  const html = `
    <div class="modal-title">${preFillData ? 'Repeat' : 'Add'} Transaction</div>
    <div class="modal-subtitle">${preFillData ? 'Verify and save repeated transaction' : 'Record a new card activity'}</div>
    <form id="txnForm">
      <div class="form-group">
        <label class="form-label" for="inp-txnCard">Card</label>
        <select id="inp-txnCard" class="form-select" required>
          ${cards.map(c => `<option value="${c.id}" ${c.id === lastCardId ? 'selected' : ''}>${escapeHTML(getCardLabel(c))}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="inp-txnType">Type</label>
          <select id="inp-txnType" class="form-select" required onchange="onTxnTypeChange()">
            <option value="spend" ${type === 'spend' ? 'selected' : ''}>Spend</option>
            <option value="payment" ${type === 'payment' ? 'selected' : ''}>Payment</option>
            <option value="transfer" ${type === 'transfer' ? 'selected' : ''}>Transfer</option>
            <option value="refund" ${type === 'refund' ? 'selected' : ''}>Refund</option>
            <option value="friend_buy" ${type === 'friend_buy' ? 'selected' : ''}>Friend Buy</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="inp-txnAmount">Amount (₹)</label>
          <input type="number" id="inp-txnAmount" class="form-input" placeholder="0" min="0.01" step="0.01" value="${amount}" required>
        </div>
      </div>
      <div id="txn-friend-wrapper" class="form-group ${type === 'friend_buy' ? '' : 'hidden'}">
        <label class="form-label" for="inp-txnFriend">Friend Name</label>
        <input type="text" id="inp-txnFriend" class="form-input" placeholder="Who owes you?" value="${escapeHTML(friendName)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="inp-txnDate">Date</label>
          <input type="date" id="inp-txnDate" class="form-date" value="${todayISO()}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="inp-txnNote">Note (optional)</label>
          <input type="text" id="inp-txnNote" class="form-input" placeholder="What for?" value="${escapeHTML(note)}">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">${preFillData ? 'Save Repeated' : 'Add'} Transaction</button>
      </div>
    </form>
  `;
  openModal(html);

  document.getElementById('txnForm').addEventListener('submit', e => {
    e.preventDefault();
    const cardId = document.getElementById('inp-txnCard').value;
    const type = document.getElementById('inp-txnType').value;
    const amount = parseFloat(document.getElementById('inp-txnAmount').value);
    const date = document.getElementById('inp-txnDate').value;
    const note = document.getElementById('inp-txnNote').value;
    const friendName = document.getElementById('inp-txnFriend') ? document.getElementById('inp-txnFriend').value : '';

    if (!cardId) { showToast('Select a card.', 'error'); return; }
    if (isNaN(amount) || amount <= 0) { showToast('Amount must be positive.', 'error'); return; }
    if (!date) { showToast('Date is required.', 'error'); return; }

    if (type === 'friend_buy' && !friendName.trim()) {
      showToast("Enter the friend's name.", 'error'); return;
    }

    const data = { cardId, type, amount, date, note };
    if (type === 'friend_buy') data.friendName = friendName;

    TransactionManager.addTransaction(data);
    localStorage.setItem('cct_lastCardId', cardId);
    closeModal();
    showToast('Transaction added!');
    renderTransactions();
  });
}

function redoTransaction(txnId) {
  const txns = DataStore.getTransactions();
  const t = txns.find(tx => tx.id === txnId);
  if (t) {
    openTransactionModal(t);
  }
}
window.redoTransaction = redoTransaction;

function onTxnTypeChange() {
  const type = document.getElementById('inp-txnType').value;
  const friendWrapper = document.getElementById('txn-friend-wrapper');
  if (friendWrapper) friendWrapper.classList.toggle('hidden', type !== 'friend_buy');
}

function confirmDeleteTxn(txnId) {
  const html = `
    <div class="modal-title text-red">Delete Transaction?</div>
    <p style="color: var(--text-secondary); margin: 16px 0;">This will reverse the balance effect of this transaction.</p>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="doDeleteTxn('${txnId}')">Delete</button>
    </div>
  `;
  openModal(html);
}

function doDeleteTxn(id) {
  TransactionManager.deleteTransaction(id);
  closeModal();
  showToast('Transaction deleted.');
  renderTransactions();
}

// ─── Rotation Tab ───────────────────────────────────────────────────────────

function renderRotation() {
  const container = document.getElementById('tab-rotation');
  const cards = DataStore.getCards();
  const cardMap = {};
  cards.forEach(c => cardMap[c.id] = c);

  let html = `
    <div class="section-header">
      <div>
        <div class="section-title">Rotation & Transfers</div>
        <div class="section-subtitle">Track money movement between cards</div>
      </div>
    </div>
  `;

  // Transfer history
  const txns = DataStore.getTransactions().filter(t => t.type === 'transfer');
  if (txns.length > 0) {
    // Transfer table
    html += `
      <div class="glass-card" style="padding: 24px;">
        <div class="section-title" style="font-size: 1rem; margin-bottom: 16px;">Transfer History</div>
        <div class="txn-table-wrap">
          <table class="txn-table">
            <thead><tr><th>Date</th><th>Card</th><th>Amount</th><th>Note</th></tr></thead>
            <tbody>
    `;
    txns.sort((a, b) => b.date > a.date ? 1 : -1).forEach(t => {
      const src = cardMap[t.cardId];
      let dateDisplay = `<span style="font-size:0.85rem;">${formatDate(t.date)}</span>`;

      html += `<tr>
        <td>${dateDisplay}</td>
        <td>${src ? escapeHTML(getCardLabel(src)) : 'Unknown'}</td>
        <td class="txn-amount" style="color:var(--cyan);">${formatCurrency(t.amount)}</td>
        <td style="color:var(--text-muted);">${escapeHTML(t.note || '—')}</td>
      </tr>`;
    });
    html += `</tbody></table></div></div>`;
  } else {
    html += `
      <div class="empty-state" style="padding: 40px;">
        <div class="empty-icon">🔄</div>
        <div class="empty-title">No Transfers Yet</div>
        <div class="empty-desc">Card-to-card transfers will appear here once you record them.</div>
      </div>
    `;
  }

  // Friend dues
  html += `
    <div class="section-header" style="margin-top: 32px;">
      <div>
        <div class="section-title">Friend Dues</div>
        <div class="section-subtitle">Track who owes you money</div>
      </div>
    </div>
  `;
  const dues = TransactionManager.getFriendDues();
  if (dues.length > 0) {
    html += `<div class="card-grid">`;
    dues.forEach(d => {
      html += `
        <div class="glass-card" style="padding: 24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <span style="font-size:1.1rem;font-weight:600;">👤 ${escapeHTML(d.friendName)}</span>
            <span class="${d.totalOwed > 0 ? 'text-red' : 'text-green'}" style="font-size:1.2rem;font-weight:700;">
              ${d.totalOwed > 0 ? 'Owes: ' + formatCurrency(d.totalOwed) : '✅ Settled'}
            </span>
          </div>
          <div class="txn-table-wrap">
            <table class="txn-table" style="font-size: 0.8rem;">
              <thead><tr><th>Date</th><th>Amount</th><th>Note</th><th>Status</th></tr></thead>
              <tbody>
      `;
      d.transactions.forEach(t => {
        html += `<tr>
          <td>${formatDate(t.date)}</td>
          <td class="txn-amount">${formatCurrency(t.amount)}</td>
          <td style="color:var(--text-muted);">${escapeHTML(t.note || '—')}</td>
          <td>${t.friendSettled
            ? '<span class="badge badge--payment">Settled</span>'
            : `<button class="btn-primary" style="padding:4px 12px;font-size:0.75rem;" onclick="doSettleFriend('${t.id}')">Mark Settled</button>`
          }</td>
        </tr>`;
      });
      html += `</tbody></table></div></div>`;
    });
    html += `</div>`;
  } else {
    html += `
      <div class="empty-state" style="padding: 40px;">
        <div class="empty-icon">👥</div>
        <div class="empty-title">No Friend Dues</div>
        <div class="empty-desc">When you buy something for a friend using your card, track it here.</div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function doSettleFriend(txnId) {
  TransactionManager.settleFriendDue(txnId);
  showToast('Marked as settled!');
  renderRotation();
}

// ─── Settings Tab ───────────────────────────────────────────────────────────

function renderSettings() {
  const container = document.getElementById('tab-settings');
  const cards = DataStore.getCards();
  const txns = DataStore.getTransactions();

  let syncCardHtml = '';
  if (FirebaseSyncManager.isEnabled()) {
    const lastSyncTime = FirebaseSyncManager.getLastSyncTime();
    const lastSyncStr = lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never';
    const syncKey = FirebaseSyncManager.getSyncKey();
    const maskedSyncKey = syncKey ? (syncKey.length > 8 ? `${syncKey.slice(0, 4)}...${syncKey.slice(-4)}` : syncKey) : 'None';
    let statusColorClass = 'text-cyan';
    if (FirebaseSyncManager._status === 'synced') statusColorClass = 'text-green';
    if (FirebaseSyncManager._status === 'error' || FirebaseSyncManager._status === 'offline') statusColorClass = 'text-red';

    syncCardHtml = `
      <div class="glass-card settings-card">
        <div class="settings-card-title">🔥 Firebase Cloud Sync</div>
        <div class="settings-card-desc">Sync is enabled and connected to Firebase.</div>
        
        <div class="sync-status-details">
          <div class="sync-status-item">
            <span class="sync-status-label">Status:</span>
            <span class="sync-status-value ${statusColorClass}" style="font-weight: 700; text-transform: uppercase;">
              ${FirebaseSyncManager._status}
            </span>
          </div>
          <div class="sync-status-item">
            <span class="sync-status-label">Sync Key:</span>
            <span class="sync-status-value" style="font-family: monospace; font-size: 0.75rem;" title="${syncKey}">
              ${maskedSyncKey}
            </span>
          </div>
          <div class="sync-status-item">
            <span class="sync-status-label">Last Sync:</span>
            <span class="sync-status-value">${lastSyncStr}</span>
          </div>
        </div>

        <div class="settings-actions">
          <button class="btn-primary" onclick="triggerManualSync()">Sync Now</button>
          <button class="btn-danger" style="padding: 10px 18px;" onclick="disconnectSync()">Disconnect</button>
        </div>
      </div>
    `;
  } else {
    syncCardHtml = `
      <div class="glass-card settings-card">
        <div class="settings-card-title">🔥 Firebase Cloud Sync</div>
        <div class="settings-card-desc">Sync your data in real-time across all your devices using a simple Sync Key.</div>
        
        <div class="sync-setup-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-size: 0.7rem;">Enter Sync Key / PIN</label>
            <input type="text" id="sync-key" class="form-input" placeholder="e.g. secret-tracker-123" style="font-family: monospace; font-size: 0.8rem;">
            <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px; line-height: 1.3;">
              Choose any unique name/phrase. Use the <strong>same key</strong> on all devices to sync them.
            </div>
          </div>
          
          <div class="settings-actions" style="margin-top: 4px;">
            <button class="btn-primary" style="width: 100%; justify-content: center;" onclick="setupSync(event)">Enable Sync</button>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Settings</div>
        <div class="section-subtitle">Manage your data and backups</div>
      </div>
    </div>

    <div class="settings-grid">
      <div class="glass-card settings-card">
        <div class="settings-card-title">📊 Data Summary</div>
        <div class="settings-card-desc">
          <strong class="text-cyan">${cards.length}</strong> card${cards.length !== 1 ? 's' : ''} · 
          <strong class="text-cyan">${txns.length}</strong> transaction${txns.length !== 1 ? 's' : ''}
        </div>
      </div>

      ${syncCardHtml}

      <div class="glass-card settings-card">
        <div class="settings-card-title">💾 Export Backup</div>
        <div class="settings-card-desc">Download all your data as a JSON file. Save it to Google Drive, email, or any cloud storage.</div>
        <div class="settings-actions">
          <button class="btn-primary" onclick="doExportJSON()">Download JSON</button>
        </div>
      </div>

      <div class="glass-card settings-card">
        <div class="settings-card-title">📥 Import Backup</div>
        <div class="settings-card-desc">Restore from a previously exported JSON backup. <strong>This will overwrite current data.</strong></div>
        <div class="settings-actions">
          <input type="file" id="importFile" accept=".json" style="display:none;" onchange="doImportJSON(event)">
          <button class="btn-secondary" onclick="document.getElementById('importFile').click()">Choose File</button>
        </div>
      </div>

      <div class="glass-card settings-card">
        <div class="settings-card-title">📋 Export CSV</div>
        <div class="settings-card-desc">Download transactions as a CSV spreadsheet for Excel.</div>
        <div class="settings-actions">
          <button class="btn-primary" onclick="doExportCSV()">Download CSV</button>
        </div>
      </div>

      <div class="glass-card settings-card">
        <div class="settings-card-title">🔄 Recalculate Balances</div>
        <div class="settings-card-desc">Rebuild all card balances from transaction history. Use if data seems out of sync.</div>
        <div class="settings-actions">
          <button class="btn-secondary" onclick="doRecalculate()">Recalculate</button>
        </div>
      </div>

      <div class="glass-card settings-card" style="border: 1px solid rgba(244,63,94,0.3);">
        <div class="settings-card-title text-red">🗑️ Clear All Data</div>
        <div class="settings-card-desc">Permanently delete all cards and transactions. <strong>This cannot be undone.</strong></div>
        <div class="settings-actions">
          <button class="btn-danger" onclick="confirmClearAll()">Clear All Data</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Settings Support & Helper Functions ────────────────────────────────────

async function setupSync(event) {
  event.preventDefault();
  const keyInput = document.getElementById('sync-key');
  const syncKey = keyInput ? keyInput.value.trim() : '';

  if (!syncKey) {
    showToast('Please enter a Sync Key / PIN', 'error');
    return;
  }

  showToast('Connecting to Firebase...');
  
  try {
    await FirebaseSyncManager.connect(syncKey);
    showToast('Sync connected successfully!');
    renderSettings();
  } catch (err) {
    console.error(err);
    showToast('Failed to connect: ' + err.message, 'error');
  }
}

async function triggerManualSync() {
  showToast('Syncing data...');
  await FirebaseSyncManager.pushData();
  renderSettings();
}

function disconnectSync() {
  const html = `
    <div class="modal-title text-red">🔄 Disconnect Cloud Sync?</div>
    <p style="color: var(--text-secondary); margin: 16px 0;">We will stop syncing your data with Firebase. Your local data on this browser will remain untouched.</p>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="doActualDisconnect()">Disconnect Sync</button>
    </div>
  `;
  openModal(html);
}

function doActualDisconnect() {
  FirebaseSyncManager.disconnect();
  closeModal();
  showToast('Sync disconnected.');
  renderSettings();
}

function doExportJSON() {
  const data = DataStore.exportAll();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cct_backup_' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded!');
}

function doImportJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const result = DataStore.importAll(e.target.result);
    if (result.success) {
      showToast('Data imported successfully!');
      switchTab(localStorage.getItem('cct_activeTab') || 'dashboard');
      renderSettings();
    } else {
      showToast(result.error, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function doExportCSV() {
  const csv = DataStore.exportCSV();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cct_transactions_' + todayISO() + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded!');
}

function confirmClearAll() {
  const html = `
    <div class="modal-title text-red">⚠️ Clear All Data?</div>
    <p style="color: var(--text-secondary); margin: 16px 0;">This will <strong>permanently delete</strong> all cards and transactions.</p>
    <p class="text-red fw-600" style="margin-bottom: 16px;">This action cannot be undone!</p>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="doFinalClearAll()">Yes, Delete Everything</button>
    </div>
  `;
  openModal(html);
}

function doFinalClearAll() {
  closeModal();
  const html = `
    <div class="modal-title text-red">🚨 Final Confirmation</div>
    <p style="color: var(--text-secondary); margin: 16px 0;">Are you <strong>absolutely sure</strong>? All data will be gone forever.</p>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">No, Keep Data</button>
      <button class="btn-danger" onclick="executeFullClear()">DELETE EVERYTHING</button>
    </div>
  `;
  openModal(html);
}

function executeFullClear() {
  DataStore.clearAll();
  closeModal();
  showToast('All data cleared.');
  switchTab('dashboard');
}

function doRecalculate() {
  const cards = DataStore.getCards();
  cards.forEach(c => CardManager.recalculateBalance(c.id));
  showToast('Balances recalculated from transaction history.');
  switchTab(localStorage.getItem('cct_activeTab') || 'dashboard');
}

// ─── Initialization ─────────────────────────────────────────────────────────

function preSeedData() {
  localStorage.removeItem('cct_cards');
  localStorage.removeItem('cct_transactions');
  localStorage.removeItem('cct_limit_groups');

  // Create Shared Limit Groups
  const iciciGroup = { id: 'icici_shared', name: 'ICICI Shared Group', limit: 120000, owner: 'Self' };
  const axisGroup = { id: 'axis_shared', name: 'Axis Shared Group', limit: 56000, owner: 'Self' };
  const hdfcGroup = { id: 'hdfc_shared', name: 'HDFC Shared Group', limit: 60000, owner: 'Self' };
  const iciciGroupDad = { id: 'icici_shared_dad', name: 'ICICI Shared Group (Dad)', limit: 100000, owner: 'Dad' };
  DataStore.saveLimitGroups([iciciGroup, axisGroup, hdfcGroup, iciciGroupDad]);

  // Add Individual Cards (Self)
  CardManager.addCard('CSB Bank', 'Jupiter', 75000, 61279, '#06b6d4', 'Self');
  CardManager.addCard('Yes Bank', 'Uni', 60000, 0, '#10b981', 'Self');
  CardManager.addCard('SBI', 'Cashback', 100000, 99177.10, '#f43f5e', 'Self');

  // Add ICICI Shared Cards (Self)
  CardManager.addCard('ICICI', 'Amazon Pay', 0, 56483, '#f59e0b', 'Self', 'icici_shared');
  CardManager.addCard('ICICI', 'Adani One', 0, 45837, '#8b5cf6', 'Self', 'icici_shared');
  CardManager.addCard('ICICI', 'Coral RuPay', 0, 2904, '#ec4899', 'Self', 'icici_shared');

  // Add Axis Shared Cards (Self)
  CardManager.addCard('Axis', 'MyZone', 0, 18881, '#a855f7', 'Self', 'axis_shared');
  CardManager.addCard('Axis', 'Neo', 0, 0, '#3b82f6', 'Self', 'axis_shared');

  // Add HDFC Shared Cards (Self)
  CardManager.addCard('HDFC', 'Tata Neu', 0, 11042, '#14b8a6', 'Self', 'hdfc_shared');
  CardManager.addCard('HDFC', 'Paytm', 0, 10000.11, '#0ea5e9', 'Self', 'hdfc_shared');

  // Add Individual Cards (Dad)
  CardManager.addCard('Federal Bank', 'Scapia', 337000, 0, '#06b6d4', 'Dad');
  CardManager.addCard('RBL', 'Credit Card', 178462, 42537, '#f59e0b', 'Dad');
  CardManager.addCard('Kotak', 'League RuPay', 162000, 0, '#10b981', 'Dad');
  CardManager.addCard('SBI', 'SimplyCLICK', 100000, 28856, '#0ea5e9', 'Dad');
  CardManager.addCard('SBI', 'Cashback', 100000, 54483, '#f43f5e', 'Dad');

  // Add ICICI Shared Cards (Dad)
  CardManager.addCard('ICICI', 'Amazon Pay', 0, 0, '#f59e0b', 'Dad', 'icici_shared_dad');
  CardManager.addCard('ICICI', 'Coral', 0, 76400, '#ec4899', 'Dad', 'icici_shared_dad');
}

function migrateTransfers() {
  const cards = DataStore.getCards();
  const txns = DataStore.getTransactions();
  let migrated = false;
  const newTxns = [];

  txns.forEach(t => {
    if (t.type === 'transfer' && t.destinationCardId) {
      migrated = true;
      const srcCard = cards.find(c => c.id === t.cardId);
      const srcLabel = srcCard ? `${srcCard.bankName} ${srcCard.cardName}` : 'Unknown Card';
      
      if (t.transferStatus === 'completed') {
        const paymentTxn = {
          id: generateId(),
          cardId: t.destinationCardId,
          type: 'payment',
          amount: t.amount,
          date: t.receivedDate || t.date,
          note: `Transfer from ${srcLabel}${t.note ? ' · ' + t.note : ''}`,
          createdAt: t.createdAt || nowISO()
        };
        newTxns.push(paymentTxn);
      }
      
      delete t.destinationCardId;
      delete t.transferStatus;
      delete t.receivedDate;
    }
  });

  if (migrated) {
    const allTxns = [...txns, ...newTxns];
    DataStore.saveTransactions(allTxns);
    cards.forEach(c => CardManager.recalculateBalance(c.id));
    console.log('Migrated old transfer transactions successfully.');
  }
}

function createOpeningBalanceTransactionsForExistingCards() {
  const cards = DataStore.getCards();
  const txns = DataStore.getTransactions();
  let updated = false;

  cards.forEach(c => {
    const cardTxns = txns.filter(t => t.cardId === c.id);
    const hasOpening = cardTxns.some(t => t.note === 'Opening Balance');
    if (!hasOpening) {
      let sum = 0;
      cardTxns.forEach(t => {
        if (t.type === 'spend' || t.type === 'friend_buy' || t.type === 'transfer') sum += t.amount;
        else if (t.type === 'payment' || t.type === 'refund') sum -= t.amount;
      });
      const diff = c.currentBalance - sum;
      if (Math.abs(diff) > 0.005) {
        const txn = {
          id: generateId(),
          cardId: c.id,
          type: diff > 0 ? 'spend' : 'payment',
          amount: Math.abs(diff),
          date: todayISO(),
          note: 'Opening Balance',
          createdAt: nowISO()
        };
        txns.push(txn);
        updated = true;
      }
    }
  });

  if (updated) {
    DataStore.saveTransactions(txns);
  }
}

function init() {
  const dbVersion = localStorage.getItem('cct_db_version') || '0';
  const existingCards = DataStore.getCards();

  if (dbVersion !== '4') {
    if (existingCards.length === 0 || (existingCards.length === 2 && existingCards.some(c => c.cardName === 'Regalia'))) {
      preSeedData();
    } else {
      migrateTransfers();
      createOpeningBalanceTransactionsForExistingCards();
    }
    localStorage.setItem('cct_db_version', '4');
  }

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // FAB
  document.getElementById('fab').addEventListener('click', openTransactionModal);

  // Modal close on overlay click
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && !document.getElementById('modal-overlay').classList.contains('hidden')) {
      const form = document.querySelector('#modal-card form');
      if (form && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        form.requestSubmit();
      }
    }
  });

  // Initialize Sync Indicator badge
  const lastSyncTime = FirebaseSyncManager.getLastSyncTime();
  FirebaseSyncManager.setSyncStatus(
    FirebaseSyncManager.isEnabled() ? 'synced' : 'local',
    lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : ''
  );

  // Manual click on sync badge in header triggers sync
  document.getElementById('sync-indicator-header').addEventListener('click', () => {
    if (FirebaseSyncManager.isEnabled()) {
      triggerManualSync();
    } else {
      // Go to Settings tab if not enabled so they can configure it
      switchTab('settings');
      showToast('Configure cloud sync here!', 'info');
    }
  });

  // Restore last active tab
  const lastTab = localStorage.getItem('cct_activeTab') || 'dashboard';
  switchTab(lastTab);

  // Start Firebase listener on load if enabled
  if (FirebaseSyncManager.isEnabled()) {
    FirebaseSyncManager.listen();
  }

  // Ensure listener is active/checked on refocus
  window.addEventListener('focus', () => {
    if (FirebaseSyncManager.isEnabled()) {
      FirebaseSyncManager.listen();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
