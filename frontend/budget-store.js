// Shared Budget Management & Public Transparency Store for Brgy360
// Serves as the single source of truth synchronizing Admin Budget Management (admin.html)
// and the Public Home Page Budget & Spending Transparency Dashboard (index.html)

export const BUDGET_STORAGE_KEY = 'brgy360_budget_records';
const BUDGET_SYNC_VERSION_KEY = 'brgy360_budget_sync_v2';
const BUDGET_CHANNEL_NAME = 'brgy360_budget_sync';
const BUDGET_DOM_EVENT = 'brgy360_budget_changed';

export const BUDGET_CATEGORIES = [
  'Infrastructure',
  'Health',
  'Social Services',
  'Administration',
  'Emergency Preparedness',
  'Education, Sports & Recreation',
  'Agriculture & Livelihood',
  'Environment & Waste Management'
];

export const CORE_PUBLIC_CATEGORIES = [
  'Infrastructure',
  'Health',
  'Administration',
  'Social Services'
];

export const BUDGET_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export const BUDGET_CATEGORY_COLORS = {
  Infrastructure: '#0d47a1',
  Health: '#16a34a',
  Administration: '#f59e0b',
  'Social Services': '#7c3aed',
  'Emergency Preparedness': '#dc2626',
  'Education, Sports & Recreation': '#0284c7',
  'Agriculture & Livelihood': '#65a30d',
  'Environment & Waste Management': '#0d9488'
};

export const BUDGET_RECORD_STATUSES = [
  'Active',
  'Ongoing',
  'Completed',
  'Planned',
  'Inactive'
];

export const DEFAULT_BUDGET_RECORDS = [];

export function escapeBudgetHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCurrencyPHP(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num === 0) return '₱0';
  const rounded = Math.round(num * 100) / 100;
  const hasDecimals = Math.abs(rounded % 1) > 0.001;
  const absFormatted = Math.abs(rounded).toLocaleString('en-PH', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  });
  return (rounded < 0 ? '-₱' : '₱') + absFormatted;
}

export function formatPercentValue(rate) {
  const num = Number(rate);
  if (!Number.isFinite(num) || num === 0) return '0%';
  const rounded = Math.round(num * 10) / 10;
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + '%';
}

export function isApplicableBudgetRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const status = String(record.status || 'Active').trim().toLowerCase();
  return status !== 'inactive' && status !== 'archived';
}

export function computeBudgetMetrics(records) {
  const list = Array.isArray(records) ? records : [];
  const totalBudget = list.reduce((sum, item) => {
    const val = Number(item?.budget);
    return sum + (Number.isFinite(val) && val >= 0 ? val : 0);
  }, 0);

  const totalSpending = list.reduce((sum, item) => {
    const val = Number(item?.actual);
    return sum + (Number.isFinite(val) && val >= 0 ? val : 0);
  }, 0);

  // Remaining Budget = Total Annual Budget − Total Spending
  const remainingBudget = totalBudget - totalSpending;

  // Utilization Rate = (Total Spending ÷ Total Annual Budget) × 100 (safe zero-budget handling)
  const rawUtilization = totalBudget > 0 ? (totalSpending / totalBudget) * 100 : 0;
  const utilizationRate = Math.round(rawUtilization * 10) / 10;

  const spentBarPct =
    totalBudget > 0
      ? Math.min(100, Math.max(0, Math.round(rawUtilization * 10) / 10))
      : 0;
  const remainingBarPct =
    totalBudget > 0
      ? Math.max(0, Math.round((100 - spentBarPct) * 10) / 10)
      : 0;

  return {
    totalBudget: Math.round(totalBudget * 100) / 100,
    totalSpending: Math.round(totalSpending * 100) / 100,
    remainingBudget: Math.round(remainingBudget * 100) / 100,
    rawUtilization,
    utilizationRate,
    utilizationText: formatPercentValue(utilizationRate),
    spentBarPct,
    remainingBarPct
  };
}

function normalizeQuarter(quarter) {
  const q = String(quarter || 'Q1').trim().toUpperCase();
  return BUDGET_QUARTERS.includes(q) ? q : 'Q1';
}

function normalizeCategory(category) {
  const raw = String(category || 'Administration').trim();
  const match = BUDGET_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  return match || raw || 'Administration';
}

function normalizeStatus(status, actual = 0) {
  if (!status) {
    return Number(actual) > 0 ? 'Active' : 'Planned';
  }
  const s = String(status).trim().toLowerCase();
  if (s === 'completed') return 'Completed';
  if (s === 'ongoing') return 'Ongoing';
  if (s === 'planned') return 'Planned';
  if (s === 'inactive' || s === 'archived') return 'Inactive';
  return 'Active';
}

export function normalizeBudgetRecord(raw, index = 0) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const year = String(obj.year || '2026').trim() || '2026';
  const quarter = normalizeQuarter(obj.quarter);
  const category = normalizeCategory(obj.category);

  const rawBudget = Number(obj.budget);
  const budget = Number.isFinite(rawBudget) && rawBudget >= 0 ? Math.round(rawBudget * 100) / 100 : 0;

  const rawActual = Number(obj.actual);
  const actual = Number.isFinite(rawActual) && rawActual >= 0 ? Math.round(rawActual * 100) / 100 : 0;

  const description = String(obj.description || `${quarter} ${category} Budget Allocation`).trim();

  const remarks = typeof obj.remarks === 'string' ? obj.remarks.trim() : '';
  const status = normalizeStatus(obj.status, actual);
  const id =
    obj.id !== undefined && obj.id !== null && String(obj.id).trim() !== ''
      ? String(obj.id).trim()
      : `BGT-${year}-${String(index + 1).padStart(3, '0')}`;

  return {
    id,
    year,
    quarter,
    category,
    description,
    remarks,
    budget,
    actual,
    status,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now()
  };
}

// Convert a PostgreSQL budget record returned by the backend API
// into the format used by the dashboards.
export function normalizeBudgetApiRecord(record, index = 0) {
  if (!record) return null;

  return normalizeBudgetRecord({
    id: record.budget_id,
    year: record.fiscal_year,
    quarter: record.quarter,
    category: record.budget_category,
    description: record.budget_description,
    remarks: record.remarks,
    budget: record.allocated_budget,
    actual: record.actual_spending,
    status: record.record_status,
    updatedAt: record.updated_at
      ? new Date(record.updated_at).getTime()
      : Date.now()
  }, index);
}

// Retrieve budget records from the backend API.
export async function fetchBudgetRecords() {
  const response = await fetch('http://localhost:5000/api/budget', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json'
    }
  });

  const result = await response.json();

  if (!response.ok || !result.success || !Array.isArray(result.records)) {
    throw new Error(result.message || 'Failed to load budget records.');
  }

  return result.records
    .map((record, index) => normalizeBudgetApiRecord(record, index))
    .filter(Boolean);
}

let budgetBroadcastChannel = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    budgetBroadcastChannel = new BroadcastChannel(BUDGET_CHANNEL_NAME);
  }
} catch (_e) {
  budgetBroadcastChannel = null;
}

export function loadBudgetRecords() {
  const defaults = DEFAULT_BUDGET_RECORDS.map((r, i) => normalizeBudgetRecord(r, i));
  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(defaults));
      localStorage.setItem(BUDGET_SYNC_VERSION_KEY, 'true');
      return defaults;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(defaults));
      localStorage.setItem(BUDGET_SYNC_VERSION_KEY, 'true');
      return defaults;
    }

    const normalized = parsed.map((r, i) => normalizeBudgetRecord(r, i));
    if (!localStorage.getItem(BUDGET_SYNC_VERSION_KEY)) {
      localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(normalized));
      localStorage.setItem(BUDGET_SYNC_VERSION_KEY, 'true');
    }
    return normalized;
  } catch (err) {
    console.warn('Error loading budget records:', err);
    return defaults;
  }
}

export function saveBudgetRecords(records) {
  const normalized = Array.isArray(records)
    ? records.map((r, i) => normalizeBudgetRecord(r, i))
    : [];

  try {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(normalized));
    localStorage.setItem(BUDGET_SYNC_VERSION_KEY, 'true');
  } catch (err) {
    console.warn('Error saving budget records to localStorage:', err);
  }

  try {
    if (budgetBroadcastChannel) {
      budgetBroadcastChannel.postMessage({
        type: 'BUDGET_UPDATED',
        timestamp: Date.now()
      });
    }
  } catch (_e) {
    // Ignore BroadcastChannel errors
  }

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(BUDGET_DOM_EVENT, {
          detail: { records: normalized }
        })
      );
    }
  } catch (_e) {
    // Ignore CustomEvent errors
  }

  return normalized;
}

export function getPublicApplicableBudgetRecords(allRecords) {
  const source = Array.isArray(allRecords) ? allRecords : loadBudgetRecords();
  return source.filter(isApplicableBudgetRecord);
}

export function getAvailableFiscalYears(records) {
  const source = Array.isArray(records) ? records : loadBudgetRecords();
  const yearSet = new Set(['2026', '2025']);
  source.forEach((r) => {
    if (r && r.year && /^\d{4}$/.test(String(r.year).trim())) {
      yearSet.add(String(r.year).trim());
    }
  });
  return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
}

export function getActiveCategoriesForYear(records, year = 'all') {
  const source = Array.isArray(records) ? records : [];
  const filtered = source.filter(
    (r) => isApplicableBudgetRecord(r) && (year === 'all' || String(r.year) === String(year))
  );
  const cats = BUDGET_CATEGORIES.filter((cat) =>
    filtered.some(
      (r) => r.category === cat && ((Number(r.budget) || 0) > 0 || (Number(r.actual) || 0) > 0)
    )
  );
  filtered.forEach((r) => {
    if (
      r.category &&
      !cats.includes(r.category) &&
      ((Number(r.budget) || 0) > 0 || (Number(r.actual) || 0) > 0)
    ) {
      cats.push(r.category);
    }
  });
  return cats.length > 0 ? cats : [...CORE_PUBLIC_CATEGORIES];
}

export function generateNextBudgetId(existingRecords, year = '2026') {
  const list = Array.isArray(existingRecords) ? existingRecords : loadBudgetRecords();
  const yr = String(year || '2026').trim();
  const prefix = `BGT-${yr}-`;
  let maxSeq = 0;
  list.forEach((item) => {
    const idStr = String(item?.id || '');
    if (idStr.startsWith(prefix)) {
      const seq = parseInt(idStr.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * Proportionally distributes a target peso amount (`budget` or `actual`) across a non-empty array of records
 * so that the sum of `record[field]` equals `targetAmount` with exact peso accuracy.
 */
export function distributeTargetAmountAcrossRecords(records, field, targetAmount) {
  if (!Array.isArray(records) || records.length === 0) return [];
  const safeTarget = Math.max(0, Math.round(Number(targetAmount) || 0));

  if (safeTarget === 0) {
    records.forEach((r) => {
      r[field] = 0;
    });
    return records;
  }

  const currentWeights = records.map((r) => Math.max(0, Number(r[field]) || 0));
  let weightSum = currentWeights.reduce((a, b) => a + b, 0);

  // Fallback weights if all current values in `field` are 0 (e.g., distributing spending onto unspent records)
  let effectiveWeights = currentWeights;
  if (weightSum <= 0) {
    const altField = field === 'actual' ? 'budget' : 'actual';
    const altWeights = records.map((r) => Math.max(0, Number(r[altField]) || 0));
    const altSum = altWeights.reduce((a, b) => a + b, 0);
    if (altSum > 0) {
      effectiveWeights = altWeights;
      weightSum = altSum;
    } else {
      effectiveWeights = records.map(() => 1);
      weightSum = records.length;
    }
  }

  let runningSum = 0;
  let largestIdx = 0;
  let largestWeight = -1;

  const newValues = effectiveWeights.map((w, idx) => {
    if (w > largestWeight) {
      largestWeight = w;
      largestIdx = idx;
    }
    const share = Math.round((w / weightSum) * safeTarget);
    runningSum += share;
    return share;
  });

  const diff = safeTarget - runningSum;
  if (diff !== 0) {
    newValues[largestIdx] = Math.max(0, newValues[largestIdx] + diff);
  }

  records.forEach((r, idx) => {
    r[field] = newValues[idx];
  });

  return records;
}

export function subscribeBudgetRecords(onChange) {
  if (typeof window === 'undefined' || typeof onChange !== 'function') {
    return () => {};
  }

  const trigger = () => {
    onChange(loadBudgetRecords());
  };

  const handleStorage = (event) => {
    if (!event.key || event.key === BUDGET_STORAGE_KEY) {
      trigger();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(BUDGET_DOM_EVENT, trigger);

  let channelHandler = null;

  if (budgetBroadcastChannel) {
    channelHandler = (event) => {
      if (event?.data?.type === 'BUDGET_UPDATED') {
        trigger();
      }
    };

    budgetBroadcastChannel.addEventListener('message', channelHandler);
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(BUDGET_DOM_EVENT, trigger);

    if (budgetBroadcastChannel && channelHandler) {
      budgetBroadcastChannel.removeEventListener('message', channelHandler);
    }
  };
}