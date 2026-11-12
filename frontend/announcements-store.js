// Shared Announcements Store & Real-Time Synchronization Engine for Brgy360
// Synchronizes Admin Console (admin.html) and Public Home Page (index.html)

export const ANNOUNCEMENTS_STORAGE_KEY = 'brgy360_announcements';
const ANNOUNCEMENTS_SYNC_VERSION_KEY = 'brgy360_announcements_sync_v2';
const ANNOUNCEMENTS_CHANNEL_NAME = 'brgy360_announcements_sync';
const ANNOUNCEMENTS_DOM_EVENT = 'brgy360_announcements_changed';

export const DEFAULT_DEPARTMENT_BY_CATEGORY = {
  Emergency: 'Barangay Disaster Risk Reduction & Management Council (BDRRMC)',
  Health: 'Barangay Health Station & City Health Office',
  Infrastructure: 'Barangay Engineering & Public Works Committee',
  Event: 'Office of the Punong Barangay',
  'Social Services': 'Barangay Social Welfare & Development (BSWD)',
  General: 'Sangguniang Barangay Secretariat'
};

export function getLocalTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function escapeAnnouncementHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function htmlToPlainText(htmlOrText) {
  if (!htmlOrText) return '';
  const raw = String(htmlOrText);
  if (!/<[a-z][\s\S]*>/i.test(raw)) {
    return raw.trim();
  }
  return raw
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|ul|ol)\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function plainTextToHtml(text) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (!trimmed) return '';

  const blocks = trimmed.split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) return '';

      const allBullets = lines.every((l) => /^([-*•])\s+/.test(l));
      if (allBullets) {
        const items = lines
          .map((l) => `<li>${escapeAnnouncementHtml(l.replace(/^([-*•])\s+/, ''))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }

      const paragraphContent = lines.map((l) => escapeAnnouncementHtml(l)).join('<br>');
      return `<p>${paragraphContent}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

export function deriveSummaryFromText(plainOrHtml, maxLength = 340) {
  const plain = htmlToPlainText(plainOrHtml)
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  const sliced = plain.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced).trim() + '...';
}

function normalizeSitioAudience(audience) {
  if (!audience) return 'All Residents';
  const raw = String(audience).trim();
  if (!raw || /^all\b/i.test(raw)) return 'All Residents';
  return raw;
}

function normalizeStatus(status) {
  if (!status) return 'Active';
  const s = String(status).trim().toLowerCase();
  if (s === 'unpublished' || s === 'draft' || s === 'inactive') return 'Unpublished';
  return 'Active';
}

function normalizeCategory(category) {
  if (!category) return 'General';
  const c = String(category).trim();
  const known = ['Emergency', 'Health', 'Infrastructure', 'Event', 'Social Services', 'General'];
  const match = known.find((k) => k.toLowerCase() === c.toLowerCase());
  return match || c;
}

export function normalizeAnnouncement(raw, index = 0) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const category = normalizeCategory(obj.category);
  const isCritical = Boolean(obj.isCritical ?? obj.isEmergency ?? false);
  const status = normalizeStatus(obj.status);
  const date =
    typeof obj.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.date.trim())
      ? obj.date.trim()
      : getLocalTodayISO();

  const rawContent = typeof obj.content === 'string' ? obj.content.trim() : '';
  const hasHtml = /<[a-z][\s\S]*>/i.test(rawContent);
  const plainContent =
    typeof obj.plainContent === 'string' && obj.plainContent.trim()
      ? obj.plainContent.trim()
      : htmlToPlainText(rawContent || obj.summary || '');
  const htmlContent = hasHtml ? rawContent : plainTextToHtml(plainContent || rawContent);

  const summary =
    typeof obj.summary === 'string' && obj.summary.trim()
      ? obj.summary.trim()
      : deriveSummaryFromText(plainContent || htmlContent);

  const department =
    typeof obj.department === 'string' && obj.department.trim()
      ? obj.department.trim()
      : DEFAULT_DEPARTMENT_BY_CATEGORY[category] || 'Sangguniang Barangay Secretariat';

  const audience = normalizeSitioAudience(obj.audience);
  const title =
    typeof obj.title === 'string' && obj.title.trim()
      ? obj.title.trim()
      : 'Official Barangay Advisory';

  const parsedDateMs = Date.parse(`${date}T00:00:00`);
  const publishedAt =
    typeof obj.publishedAt === 'number' && Number.isFinite(obj.publishedAt)
      ? obj.publishedAt
      : Number.isFinite(parsedDateMs)
      ? parsedDateMs + index
      : Date.now();

  const normalized = {
    id: obj.id !== undefined && obj.id !== null ? String(obj.id) : `ANN-2026-${String(index + 1).padStart(2, '0')}`,
    title,
    category,
    audience,
    department,
    date,
    status,
    isCritical,
    isEmergency: isCritical,
    summary,
    content: htmlContent,
    plainContent,
    publishedAt,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : publishedAt
  };

  if (obj.attachment && typeof obj.attachment === 'object' && obj.attachment.name) {
    normalized.attachment = {
      name: String(obj.attachment.name),
      size: String(obj.attachment.size || 'PDF Document')
    };
  }

  return normalized;
}

export const DEFAULT_ANNOUNCEMENTS = [];

let broadcastChannel = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(ANNOUNCEMENTS_CHANNEL_NAME);
  }
} catch (_e) {
  broadcastChannel = null;
}

export function loadAnnouncements() {
  const defaultsNormalized = DEFAULT_ANNOUNCEMENTS.map((item, idx) =>
    normalizeAnnouncement(item, idx)
  );

  try {
    const rawSaved = localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY);

    if (!rawSaved) {
      localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(defaultsNormalized));
      localStorage.setItem(ANNOUNCEMENTS_SYNC_VERSION_KEY, 'true');
      return defaultsNormalized;
    }

    const parsed = JSON.parse(rawSaved);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(defaultsNormalized));
      localStorage.setItem(ANNOUNCEMENTS_SYNC_VERSION_KEY, 'true');
      return defaultsNormalized;
    }

    return parsed.map((item, idx) => normalizeAnnouncement(item, idx));
  } catch (err) {
    console.warn('Error loading announcements store:', err);
    return defaultsNormalized;
  }
}

export function saveAnnouncements(list) {
  const normalizedList = Array.isArray(list)
    ? list.map((item, idx) => normalizeAnnouncement(item, idx))
    : [];

  try {
    localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(normalizedList));
    localStorage.setItem(ANNOUNCEMENTS_SYNC_VERSION_KEY, 'true');
  } catch (err) {
    console.warn('Error saving announcements to localStorage:', err);
  }

  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'ANNOUNCEMENTS_UPDATED',
        timestamp: Date.now()
      });
    }
  } catch (_e) {
    // Ignore BroadcastChannel errors in restricted contexts
  }

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ANNOUNCEMENTS_DOM_EVENT, {
          detail: { announcements: normalizedList }
        })
      );
    }
  } catch (_e) {
    // Ignore CustomEvent dispatch errors
  }

  return normalizedList;
}

export function getPublicActiveAnnouncements() {
  return loadAnnouncements().filter((item) => item.status === 'Active');
}

export function generateNextAnnouncementId(existingList) {
  const list = Array.isArray(existingList) ? existingList : loadAnnouncements();
  const year = new Date().getFullYear();
  let maxNum = 0;
  list.forEach((item) => {
    const match = String(item?.id || '').match(/ANN-\d{4}-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });
  return `ANN-${year}-${String(maxNum + 1).padStart(2, '0')}`;
}

export function subscribeAnnouncements(onChange) {
  if (typeof window === 'undefined' || typeof onChange !== 'function') {
    return () => {};
  }

  const triggerSync = () => {
    onChange(loadAnnouncements());
  };

  const handleStorage = (event) => {
    if (!event.key || event.key === ANNOUNCEMENTS_STORAGE_KEY) {
      triggerSync();
    }
  };

  const handleDomEvent = () => {
    triggerSync();
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      triggerSync();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(ANNOUNCEMENTS_DOM_EVENT, handleDomEvent);
  window.addEventListener('pageshow', triggerSync);
  window.addEventListener('focus', triggerSync);
  document.addEventListener('visibilitychange', handleVisibility);

  let channelListener = null;
  if (broadcastChannel) {
    channelListener = (event) => {
      if (event?.data?.type === 'ANNOUNCEMENTS_UPDATED') {
        triggerSync();
      }
    };
    broadcastChannel.addEventListener('message', channelListener);
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(ANNOUNCEMENTS_DOM_EVENT, handleDomEvent);
    window.removeEventListener('pageshow', triggerSync);
    window.removeEventListener('focus', triggerSync);
    document.removeEventListener('visibilitychange', handleVisibility);
    if (broadcastChannel && channelListener) {
      broadcastChannel.removeEventListener('message', channelListener);
    }
  };
}