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
  return raw.replace(/Purok\s*2/gi, 'Tierra Verde');
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
      ? obj.title.trim().replace(/Purok\s*2/gi, 'Tierra Verde')
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

export const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'ANN-2026-01',
    title: 'Typhoon Preparedness Advisory',
    category: 'Emergency',
    audience: 'All Residents',
    isCritical: true,
    isEmergency: true,
    status: 'Active',
    date: '2026-09-26',
    publishedAt: Date.parse('2026-09-26T08:00:00'),
    department: 'Barangay Disaster Risk Reduction & Management Council (BDRRMC)',
    summary:
      'Residents in riverside sitios and flood-prone lowlands are advised to prepare emergency go-bags, secure roofing, and heed mandatory flood protocols. The announcement will be held on September 26, 2026, with preemptive evacuation starting promptly at 1:00 PM before typhoon landfall. Free barangay emergency shuttles are staged at Sitio Ibaba and Sitio Santolan Chapels to transport families to the Multi-Purpose Covered Court 24/7 evacuation center.',
    content: `
      <p><strong>SITUATION & STORM WARNING:</strong> The Philippine Atmospheric, Geophysical and Astronomical Services Administration (PAGASA) has raised Wind Signal No. 3 over our province due to Severe Tropical Storm 'Julian'. Critical riverbank telemetry sensors in Sitio Ibaba and Sitio Santolan have reached orange alert level. Torrential rainfall, high-velocity gale winds, and river overflows are anticipated within the next 18 to 24 hours.</p>
      <p><strong>MANDATORY EVACUATION SCHEDULE:</strong> The announcement will be held on September 26, 2026, with mandatory preemptive evacuation commencing at 1:00 PM and continuing until 5:00 PM for all residents living within 50 meters of the riverbank, low-lying waterways, and landslide-vulnerable hillsides. The Barangay Multi-Purpose Covered Court on Central Grounds serves as the primary designated 24/7 evacuation center with standby food packs, potable water stations, and medical officers.</p>
      <p><strong>CRITICAL HOUSEHOLD ACTION PROTOCOLS:</strong></p>
      <ul>
        <li><strong>Emergency Go-Bags:</strong> Prepare waterproof bags containing non-perishable canned food, 3-day bottled water supply, first-aid kits, essential prescription medicines, flashlights, power banks, battery-powered radios, and government IDs sealed in ziplock pouches.</li>
        <li><strong>Utility Precautions:</strong> Switch off the main electrical breaker and securely disconnect LPG gas regulator hoses before locking and vacating homes.</li>
        <li><strong>Free Emergency Transportation:</strong> Barangay emergency rescue trucks and transport shuttles will make continuous pickup loops at Sitio Ibaba and Sitio Santolan Chapels starting at 1:00 PM.</li>
        <li><strong>Livestock & Pets:</strong> Domestic animals must not be left tied or locked indoors; safe temporary holding corrals are set up behind the evacuation center.</li>
      </ul>
      <p><strong>24/7 COMMAND DISPATCH HOTLINES:</strong></p>
      <p>📞 BDRRMC Operations: <strong>0917-512-8843</strong> | 🚨 Tanod Emergency Rescue: <strong>0936-221-8847</strong> | 🏥 Health Station Medic: <strong>0920-445-9128</strong></p>
    `,
    attachment: {
      name: 'Official_Typhoon_Preparedness_Advisory_2026.pdf',
      size: '1.4 MB'
    }
  },
  {
    id: 'ANN-2026-06',
    title: 'SK Youth Digital Literacy & Web Development Bootcamp 2026',
    category: 'Event',
    audience: 'All Residents',
    isCritical: false,
    isEmergency: false,
    status: 'Active',
    date: '2026-10-29',
    publishedAt: Date.parse('2026-10-29T00:01:00'),
    department: 'Sangguniang Kabataan (SK) Council',
    summary:
      'The Sangguniang Kabataan Council is launching a free intensive two-day tech skills workshop designed for out-of-school youth, high school students, and aspiring creatives aged 15 to 30. The announcement will be held on November 14 to November 15, 2026 (Saturday & Sunday, 9:00 AM – 5:00 PM) at the 2nd Floor E-Library Tech Hub. Participants will learn hands-on web design, digital graphics, and online freelance portfolio building.',
    content: `
      <p>The Sangguniang Kabataan Council proudly presents the 2026 Youth Digital Empowerment and Literacy Bootcamp, a flagship hands-on weekend program created to bridge digital skills gaps and train barangay youth for remote employment opportunities.</p>
      <p><strong>BOOTCAMP SCHEDULE & VENUE:</strong> The announcement will be held on November 14 to November 15, 2026 (Saturday & Sunday, 9:00 AM – 5:00 PM) at the 2nd Floor E-Library Tech Hub. Thirty (30) fully equipped computer workstations with high-speed fiber internet connection, software suites, and free training modules are reserved for accepted attendees.</p>
      <p><strong>CURRICULUM BREAKDOWN:</strong></p>
      <ul>
        <li><strong>Day 1 (Saturday): Modern Web Architecture:</strong> Practical semantic HTML5 structuring, modern CSS3 layout and design principles, and standard JavaScript programming for interactive web applications.</li>
        <li><strong>Day 2 Morning (Sunday): Graphic Design & Canva Pro:</strong> Creating impactful community posters, social media banners, brand kits, and digital graphic assets.</li>
        <li><strong>Day 2 Afternoon (Sunday): Freelance Career Mastery:</strong> Setting up remote freelance profiles, building developer portfolios, and client presentation practices.</li>
      </ul>
      <p><strong>BENEFITS:</strong> Complimentary meals and afternoon snacks are provided across both workshop days. Registered attendees who complete all workshop exercises will receive an official Sangguniang Kabataan Certificate of Competency.</p>
    `,
    attachment: {
      name: 'SK_Tech_Bootcamp_Curriculum.pdf',
      size: '580 KB'
    }
  },
  {
    id: 'ANN-2026-05',
    title: 'Senior Citizens & PWD Social Pension Distribution (Q4 2026)',
    category: 'Social Services',
    audience: 'All Residents',
    isCritical: false,
    isEmergency: false,
    status: 'Active',
    date: '2026-10-28',
    publishedAt: Date.parse('2026-10-28T09:00:00'),
    department: 'Barangay Social Welfare & Development (BSWD)',
    summary:
      'The Barangay Social Welfare Committee, in coordination with the Department of Social Welfare and Development (DSWD), will release the 4th Quarter social pension stipend and medical assistance subsidy for registered indigent senior citizens and persons with disabilities. The announcement will be held on November 3, 2026 (Tuesday, 8:00 AM – 3:00 PM) at the Barangay Session Hall.',
    content: `
      <p>The Barangay Social Welfare and Development Office, alongside regional disbursement officers from the Department of Social Welfare and Development (DSWD), announces the schedule for the 4th Quarter Social Pension and indigent medical assistance payout.</p>
      <p><strong>PAYOUT SCHEDULE & LOCATION:</strong> The announcement will be held on November 3, 2026 (Tuesday, 8:00 AM – 3:00 PM) at the Barangay Session Hall. Numbered disbursement vouchers will be processed according to designated purok time clusters to ensure short wait times and comfortable seating.</p>
      <p><strong>MANDATORY CLAIM REQUIREMENTS:</strong></p>
      <ul>
        <li><strong>Personal Claimants:</strong> Original OSCA Senior Citizen ID card or National Council on Disability Affairs (NCDA) PWD ID card, plus one (1) photocopy of any valid government ID.</li>
        <li><strong>Free Indigency Certificate:</strong> Valid Barangay Certificate of Indigency (issued at no cost at the special social services desk).</li>
        <li><strong>Authorized Representative Claims:</strong> For bedridden, hospitalized, or frail beneficiaries, representatives must present: (1) an authorized Special Power of Attorney (SPA) or Barangay Representative Form; (2) current attending physician's medical certificate; and (3) original and photocopies of both the beneficiary's and representative's valid IDs.</li>
      </ul>
      <p>Air-conditioned rest areas, wheelchair ramps, priority seating, and standby medical blood pressure monitoring will be fully manned by volunteer Barangay Health Workers throughout the payout.</p>
    `,
    attachment: {
      name: 'Pension_Payout_Schedule_Q4.pdf',
      size: '640 KB'
    }
  },
  {
    id: 'ANN-2026-04',
    title: '2nd Semester Barangay General Assembly & Town Hall Forum',
    category: 'Event',
    audience: 'All Residents',
    isCritical: false,
    isEmergency: false,
    status: 'Active',
    date: '2026-10-20',
    publishedAt: Date.parse('2026-10-20T08:30:00'),
    department: 'Office of the Punong Barangay',
    summary:
      'Pursuant to Section 397 of the Local Government Code, all barangay residents aged 15 and above are invited to convene for the semi-annual civic assembly. The announcement will be held on October 25, 2026 (Sunday, 8:30 AM – 12:00 PM) at the Barangay Multi-Purpose Covered Court. The assembly features the State of the Barangay Address, 2026 budget utilization disclosures, project turn-overs, and an open citizen town hall.',
    content: `
      <p>Pursuant to Republic Act No. 7160 (The Local Government Code of 1991), the Sangguniang Barangay formally invites all registered residents, youth leaders, and civil society organizations to participate in the 2nd Semester Barangay General Assembly.</p>
      <p><strong>ASSEMBLY SCHEDULE & LOCATION:</strong> The announcement will be held on October 25, 2026 (Sunday, 8:30 AM – 12:00 PM) at the Barangay Multi-Purpose Covered Court on Central Grounds. Resident registration and voter profiling verification begin at 8:00 AM sharp, accompanied by complimentary civic snacks and refreshments.</p>
      <p><strong>OFFICIAL ASSEMBLY AGENDA:</strong></p>
      <ul>
        <li><strong>State of the Barangay Address (SOBA):</strong> Punong Barangay Romy D. Catilo will deliver the executive report covering executive accomplishments, peace and order indexes, and disaster readiness milestones.</li>
        <li><strong>Comprehensive Financial Transparency Report:</strong> Barangay Treasurer Mennen M. Bolos will present the itemized financial accountability statement of the 20% Barangay Development Fund, 10% SK Youth Development Fund, and General Administrative expenditures.</li>
        <li><strong>Project Turn-over & Blessing:</strong> Formal turnover and community handover of completed solar-powered LED streetlights across Sitio Ibaba, Sitio Santolan, Sitio Ilaya, Sitio Gitna, and Tierra Verde and the newly dredged drainage outfall canal.</li>
        <li><strong>Open Public Forum:</strong> An open floor where any resident can voice neighborhood petitions, public safety suggestions, and community inquiries directly to the barangay council.</li>
      </ul>
      <p>Your active voice and presence ensure honest, participatory, and transparent local governance. All attendees will receive verified attendance certificates for barangay profiling records.</p>
    `,
    attachment: {
      name: 'Barangay_Assembly_2026_Notice.pdf',
      size: '820 KB'
    }
  },
  {
    id: 'ANN-2026-03',
    title: 'Sitio Gitna Water Main Pipeline Rehabilitation & Road Re-blocking',
    category: 'Infrastructure',
    audience: 'Sitio Gitna',
    isCritical: false,
    isEmergency: false,
    status: 'Active',
    date: '2026-10-12',
    publishedAt: Date.parse('2026-10-12T08:00:00'),
    department: 'Barangay Engineering & Public Works Committee',
    summary:
      'Extensive civil engineering rehabilitation, culinary pipeline upgrade, and concrete asphalt re-blocking will be executed along Mabini Extension to resolve chronic low water pressure and roadway surface wear. The announcement will be held on October 13 to October 17, 2026 (Daily 8:00 AM – 5:00 PM). One-lane traffic flow will be enforced by barangay tanods, and two dedicated potable water tankers will be stationed at Sitio Gitna Chapel for affected households.',
    content: `
      <p>In collaborative partnership with the Municipal Water District and the City Engineering Department, major infrastructure renewal will be undertaken along Mabini Extension (spanning from corner Rizal Street to corner Luna Avenue) to replace aging galvanized water mains with high-density polyethylene pipelines and repair road pavement.</p>
      <p><strong>CONSTRUCTION SCHEDULE & WORKING HOURS:</strong> The announcement will be held on October 13 to October 17, 2026 (Daily 8:00 AM – 5:00 PM). Heavy equipment mobilization will occur between 7:00 AM and 8:00 AM daily, with excavation and trench re-blocking concluded before evening rush hours.</p>
      <p><strong>TRAFFIC SCHEME & WATER SUPPLY CONTINGENCY:</strong></p>
      <ul>
        <li><strong>One-Lane Alternate Traffic:</strong> Barangay Tanod traffic marshals will oversee stop-and-go passage along Mabini Extension. Motorists are advised to utilize secondary access routes via Bonifacio Road.</li>
        <li><strong>Potable Water Tanker Relief:</strong> During scheduled water pressure drop periods (10:00 AM to 3:00 PM daily), two 10,000-liter barangay potable water tankers will be stationed at the Sitio Gitna Chapel courtyard to supply clean household water free of charge.</li>
        <li><strong>Domestic Storage:</strong> Residents in Sitio Gitna are advised to store adequate clean drinking and cooking water in covered storage containers prior to 8:00 AM each morning.</li>
      </ul>
      <p>For urgent traffic inquiries or emergency water delivery requests, please contact the Barangay Engineering Desk at <strong>0919-482-1130</strong>.</p>
    `,
    attachment: {
      name: 'Infrastructure_Advisory_SitioGitna.pdf',
      size: '750 KB'
    }
  },
  {
    id: 'ANN-2026-02',
    title: 'Free Community Medical Mission & Flu Vaccination Drive',
    category: 'Health',
    audience: 'All Residents',
    isCritical: false,
    isEmergency: false,
    status: 'Active',
    date: '2026-10-05',
    publishedAt: Date.parse('2026-10-05T08:00:00'),
    department: 'Barangay Health Station & City Health Office',
    summary:
      'The Barangay Health Committee, in coordination with the City Health Office and volunteer physicians, is providing free comprehensive medical checkups, essential medicines, and pediatric vitamins. The announcement will be held on October 22, 2026 (Thursday, 8:00 AM – 4:00 PM) at the Sitio Ilaya Main Health Station. Free annual influenza vaccinations will also be administered for senior citizens, persons with disabilities, and young children.',
    content: `
      <p>The Barangay Health Station, in partnership with visiting volunteer doctors from the City Health Office and Philippine Medical Association, will hold its annual Community Health and Preventive Wellness Outreach for all registered barangay families.</p>
      <p><strong>OUTREACH DATE & VENUE:</strong> The announcement will be held on October 22, 2026 (Thursday, 8:00 AM – 4:00 PM) at the Sitio Ilaya Main Health Station. Numbered priority queue numbers will be released starting at 7:30 AM at the triage admission desk. Express lanes will be maintained for senior citizens, pregnant women, and persons with disabilities.</p>
      <p><strong>FREE HEALTHCARE SERVICES AVAILABLE:</strong></p>
      <ul>
        <li><strong>General Consultations:</strong> Adult internal medicine and pediatric consultations conducted by licensed physicians.</li>
        <li><strong>Annual Influenza (Flu) Vaccinations:</strong> Priority shots provided for senior citizens aged 60 and above, PWDs, and children aged 6 months to 5 years.</li>
        <li><strong>Diagnostic Screening:</strong> Free blood pressure monitoring, random blood sugar (RBS) fingerstick screening, and uric acid checks.</li>
        <li><strong>Free Pharmacy Dispensation:</strong> Full-course doctor-prescribed maintenance medicines (for hypertension and diabetes), antibiotics, and pediatric vitamin syrups.</li>
      </ul>
      <p><strong>REMINDERS FOR ATTENDEES:</strong> Please present your valid government ID, Barangay Resident Card, and Barangay Health Record Booklet (if issued previously). Fasting is recommended for patients requesting blood sugar diagnostic tests.</p>
    `,
    attachment: {
      name: 'Medical_Mission_Guidelines_Oct2026.pdf',
      size: '1.1 MB'
    }
  },
  {
    id: 'ANN-2026-00',
    title: '1st Semester Barangay Assembly & AIP 2026 Public Consultation',
    category: 'General',
    audience: 'All Residents',
    isCritical: false,
    isEmergency: false,
    date: '2026-03-28',
    publishedAt: Date.parse('2026-03-28T09:00:00'),
    department: 'Sangguniang Barangay Secretariat',
    summary:
      'First semester Barangay Assembly convened at the Multi-Purpose Covered Court to present Q1 budget execution disclosures and gather resident priorities for the Annual Investment Program.',
    content: `
      <p>The Sangguniang Barangay convened the 1st Semester Barangay Assembly to present Q1 2026 financial accountability disclosures, peace and order updates, and community consultations for the Annual Investment Program.</p>
      <p>Official minutes and attendance records remain archived for public transparency and audit reference at the Barangay Secretariat.</p>
    `
  }
];

const LEGACY_PLACEHOLDER_IDS = new Set(['ANN-2026-08', 'ANN-2026-07', 'ANN-2026-06']);
const LEGACY_PLACEHOLDER_TITLES = new Set([
  'Dengue Vector Surveillance & Larvicide Fogging Schedule',
  'Pre-Monsoon Flood Preparedness Advisory: Tierra Verde',
  'General Assembly & Sangguniang Barangay Public Consultation'
]);

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
    const syncedVersion = localStorage.getItem(ANNOUNCEMENTS_SYNC_VERSION_KEY);
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

    // One-time migration from disconnected legacy 3-item admin placeholder list
    if (!syncedVersion) {
      const customEntries = parsed.filter((item) => {
        if (!item || typeof item !== 'object') return false;
        const isLegacySeed =
          LEGACY_PLACEHOLDER_IDS.has(String(item.id)) &&
          LEGACY_PLACEHOLDER_TITLES.has(String(item.title || '').trim());
        return !isLegacySeed;
      });

      const merged = [
        ...customEntries.map((item, idx) => normalizeAnnouncement(item, idx + 100)),
        ...defaultsNormalized
      ];
      localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(merged));
      localStorage.setItem(ANNOUNCEMENTS_SYNC_VERSION_KEY, 'true');
      return merged;
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
  let maxNum = 6;
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
