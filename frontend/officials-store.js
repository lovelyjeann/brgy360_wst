// Shared Barangay Officials Store & Real-Time Synchronization Engine for Brgy360
// Synchronizes Admin Console (admin.html) and Public Website (index.html)

export const OFFICIALS_STORAGE_KEY = 'brgy360_officials';
export const OFFICIALS_SYNC_EVENT = 'brgy360_officials_changed';
export const OFFICIALS_CHANNEL_NAME = 'brgy360_officials_channel';

export const DEFAULT_OFFICIALS = [
  {
    id: 1,
    name: 'Romy D. Catilo',
    position: 'Punong Barangay',
    role: 'Executive Leadership & Council Presiding Officer',
    contact: '0917 512 8843',
    schedule: 'Monday, 8:00 AM - 5:00 PM',
    term: '2023 - 2026',
    status: 'Active',
    gridClass: 'official-r1c1',
    isLeader: true,
    avatarSvgType: 'star'
  },
  {
    id: 2,
    name: 'Ricardo C. Villestas',
    position: 'Sangguniang Barangay Member',
    role: 'Committee on Peace & Order and Public Safety',
    contact: '0918 226 7741',
    schedule: 'Tuesday, 8:00 AM - 5:00 PM',
    term: '2023 - 2026',
    status: 'Active',
    gridClass: 'official-r1c2',
    isLeader: false,
    avatarSvgType: 'user'
  },
  {
    id: 3,
    name: 'Jesus M. Bagos',
    position: 'Sangguniang Barangay Member',
    role: 'Committee on Appropriations, Ways & Means',
    contact: '0920 445 9128',
    schedule: 'Wednesday, 8:00 AM - 5:00 PM',
    term: '2023 - 2026',
    status: 'Active',
    gridClass: 'official-r1c3',
    isLeader: false,
    avatarSvgType: 'user'
  },
  {
    id: 4,
    name: 'Lucila D. Macalalad',
    position: 'Sangguniang Barangay Member',
    role: 'Committee on Health, Sanitation & Cleanliness',
    contact: '0921 337 6605',
    schedule: 'Thursday, 8:00 AM - 5:00 PM',
    term: '2023 - 2026',
    status: 'Active',
    gridClass: 'official-r1c4',
    isLeader: false,
    avatarSvgType: 'user'
  },
  {
    id: 5,
    name: 'Ma. Victoria M. Marasigan',
    position: 'Brgy. Secretary',
    role: 'Barangay Secretariat, Records & Civil Registry',
    contact: '0939 550 1186',
    schedule: 'Monday - Friday, 8:00 AM - 5:00 PM',
    term: 'Appointed',
    status: 'Active',
    gridClass: 'official-r1c5',
    isLeader: false,
    avatarSvgType: 'user'
  },
  {
    id: 6,
    name: 'Aldrin P. Abraham',
    position: 'Sangguniang Barangay Member',
    role: 'Committee on Public Works, Infrastructure & Drainage',
    contact: '0927 118 4432',
    schedule: 'Monday, 8:00 AM - 5:00 PM',
    term: '2023 - 2026',
    status: 'Active',
    gridClass: 'official-r2c1',
    isLeader: false,
    avatarSvgType: 'user'
  },
  {
    id: 7,
    name: 'Christopher M. Santos',
    position: 'Sangguniang Barangay Member',
    role: 'Committee on Education, Youth & Sports Development',
    contact: '0928 904 5576',
    schedule: 'Tuesday, 8:00 AM - 5:00 PM',
    term: '2023 - 2026',
    status: 'Active',
    gridClass: 'official-r2c2',
    isLeader: false,
    avatarSvgType: 'user'
  },
  {
    id: 8,
    name: 'Emelia C. Obsioma',
    position: 'Sangguniang Barangay Member',
    role: 'Committee on Social Services, Women & Senior Citizens',
    contact: '0935 672 3390',
    schedule: 'Wednesday, 8:00 AM - 5:00 PM',
    term: '2023 - 2026',
    status: 'Active',
    gridClass: 'official-r2c3',
    isLeader: false,
    avatarSvgType: 'user'
  },
  {
    id: 9,
    name: 'Ismael A. Catilo',
    position: 'Sangguniang Barangay Member',
    role: 'Committee on Agriculture, Livelihood & Environment',
    contact: '0936 221 8847',
    schedule: 'Thursday, 8:00 AM - 5:00 PM',
    term: '2023 - 2026',
    status: 'Active',
    gridClass: 'official-r2c4',
    isLeader: false,
    avatarSvgType: 'user'
  },
  {
    id: 10,
    name: 'Mennen M. Bolos',
    position: 'Brgy. Treasurer',
    role: 'Fiscal Management, Custody of Funds & Disbursements',
    contact: '0945 883 2274',
    schedule: 'Monday - Friday, 8:00 AM - 5:00 PM',
    term: 'Appointed',
    status: 'Active',
    gridClass: 'official-r2c5',
    isLeader: false,
    avatarSvgType: 'user'
  }
];

export function escapeOfficialHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// Current officials loaded from the PostgreSQL API.
let officialsCache = [];

const OFFICIALS_API_URL = 'http://localhost:5000/api/officials';

// Convert PostgreSQL records into the format used by the existing UI.
function normalizeOfficial(row) {
  return {
    id: Number(row.official_id ?? row.id),
    name: row.name || '',
    position: row.position || '',
    term: row.term || '',
    status: row.status || 'Active',
    role: row.role || '',
    contact: row.contact || '',
    schedule: row.schedule || '',
    isLeader: Boolean(row.is_leader ?? row.isLeader),
    gridClass: row.grid_class || row.gridClass || '',
    avatarSvgType: (row.is_leader ?? row.isLeader) ? 'star' : 'user',
    displayOrder: Number(row.display_order ?? row.displayOrder ?? 0)
  };
}

// Synchronous access to the latest successfully loaded database records.
export function loadOfficials() {
  return [...officialsCache];
}

// Notify existing Admin/Public listeners when the database data changes.
function notifyOfficialsChanged() {
  window.dispatchEvent(
    new CustomEvent(OFFICIALS_SYNC_EVENT, {
      detail: [...officialsCache]
    })
  );

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(OFFICIALS_CHANNEL_NAME);
      channel.postMessage({
        type: 'OFFICIALS_UPDATED'
      });
      channel.close();
    } catch (error) {
      console.warn('Officials broadcast failed:', error);
    }
  }
}

// Load the shared roster from PostgreSQL.
export async function loadOfficialsFromAPI() {
  const response = await fetch(OFFICIALS_API_URL, {
    method: 'GET',
    credentials: 'include'
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to load Barangay Officials.');
  }

  officialsCache = (data.officials || [])
    .map(normalizeOfficial)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  notifyOfficialsChanged();

  return [...officialsCache];
}

// Keep this export for compatibility with existing imports.
// PostgreSQL, not localStorage, is now the source of truth.
export function saveOfficials(officialsList, notify = true) {
  officialsCache = Array.isArray(officialsList)
    ? [...officialsList]
    : [];

  if (notify) notifyOfficialsChanged();

  return true;
}

// Update one official in PostgreSQL.

export async function updateOfficial(id, updatedFields) {
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error('Invalid official ID.');
  }

  const existing = officialsCache.find(
    official => Number(official.id) === numericId
  );

  if (!existing) {
    throw new Error('Official not found. Please reload the roster.');
  }

  // Preserve fields that are not included in the edit form.
  const merged = {
    ...existing,
    ...updatedFields,
    id: numericId
  };

  const payload = {
    name: merged.name,
    position: merged.position,
    term: merged.term || '',
    status: merged.status || 'Active',
    role: merged.role || '',
    contact: merged.contact || '',
    schedule: merged.schedule || '',
    is_leader: Boolean(merged.isLeader),
    grid_class: merged.gridClass || '',
    display_order: Number(merged.displayOrder || 0)
  };

  const response = await fetch(`${OFFICIALS_API_URL}/${numericId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to update official.');
  }

  // Refresh the complete roster using PostgreSQL as the source of truth.
  await loadOfficialsFromAPI();

  return officialsCache.find(
    official => official.id === numericId
  ) || null;
}

// Restore the original roster by updating existing database records.

export async function resetOfficialsToDefault() {
  for (const official of DEFAULT_OFFICIALS) {
    const response = await fetch(
      `${OFFICIALS_API_URL}/${official.id}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: official.name,
          position: official.position,
          term: official.term,
          status: official.status,
          role: official.role,
          contact: official.contact,
          schedule: official.schedule,
          is_leader: official.isLeader,
          grid_class: official.gridClass,
          display_order: official.displayOrder
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || `Failed to restore official: ${official.name}`
      );
    }
  }

  return await loadOfficialsFromAPI();
}

// Subscribe to updates from this page and other tabs.
export function subscribeOfficials(callback) {
  if (typeof callback !== 'function') return () => {};

  const handleCustom = (event) => {
    callback(event.detail || loadOfficials());
  };

  window.addEventListener(OFFICIALS_SYNC_EVENT, handleCustom);

  let broadcastChannel = null;

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(OFFICIALS_CHANNEL_NAME);

      broadcastChannel.onmessage = async (event) => {
        if (event.data?.type === 'OFFICIALS_UPDATED') {
          try {
            const officials = await loadOfficialsFromAPI();
            callback(officials);
          } catch (error) {
            console.error('Could not refresh officials:', error);
          }
        }
      };
    } catch (error) {
      console.warn('Officials subscription failed:', error);
    }
  }

  return () => {
    window.removeEventListener(OFFICIALS_SYNC_EVENT, handleCustom);

    if (broadcastChannel) {
      broadcastChannel.close();
    }
  };
}
