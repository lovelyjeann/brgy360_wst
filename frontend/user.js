/**
 * Brgy360 - Resident Portal Script (user.js)
 * Single-Page Architecture (SPA) Tab Routing, State Management,
 * Form Validation, and Local Storage Persistence.
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ==========================================================
  // 1. DATA INITIALIZATION & LOCALSTORAGE MANAGEMENT
  // ==========================================================

  const DEFAULT_USER = {
  name: 'Resident',
  email: '',
  mobile: '',
  dob: '',
  civilStatus: '',
  address: '',
  sitio: '',
  city: '',
  residentId: '',
  verified: false,
  verificationTier: '',
  idOnRecord: '',
  avatarInitial: 'R',
  password: ''
};

  const DEFAULT_SERVICES = [
    {
      id: 'clearance',
      name: 'Barangay Clearance',
      fee: '₱50.00',
      isFree: false,
      turnaround: '1–2 Working Days',
      desc: 'Official clearance certifying good moral character and no pending derogatory record in Barangay Pallocan West.',
      requirements: 'Valid Govt ID, Cedula / Community Tax Certificate'
    },
    {
      id: 'residency',
      name: 'Certificate of Residency',
      fee: '₱50.00',
      isFree: false,
      turnaround: '1–2 Working Days',
      desc: 'Attestation that the applicant is a bonafide resident living at their declared address in the barangay.',
      requirements: 'Proof of Address / Utility bill, 1 Valid ID'
    },
    {
      id: 'indigency',
      name: 'Certificate of Indigency',
      fee: 'FREE',
      isFree: true,
      turnaround: 'Same Day / 1 Day',
      desc: 'Issued to low-income residents for medical, financial, burial, educational, or legal assistance.',
      requirements: 'Case study referral or Purok Leader certification'
    },
    {
      id: 'business',
      name: 'Barangay Business Clearance',
      fee: '₱200.00',
      isFree: false,
      turnaround: '2–3 Working Days',
      desc: 'Prerequisite clearance for commercial establishments, sari-sari stores, and enterprises operating in Pallocan West.',
      requirements: 'DTI / SEC Registration, Contract of Lease / Land Title'
    },
    {
      id: 'jobseeker',
      name: 'First-Time Jobseeker (RA 11261)',
      fee: 'FREE',
      isFree: true,
      turnaround: '1 Working Day',
      desc: 'Issued free of charge under RA 11261 to first-time jobseekers applying for government credentials.',
      requirements: 'Oath of Undertaking signed before Punong Barangay'
    },
    {
      id: 'mediation',
      name: 'Katarungang Pambarangay Mediation',
      fee: 'FREE',
      isFree: true,
      turnaround: '3–5 Working Days',
      desc: 'Formal filing for amicable community dispute conciliation before the Lupon Tagapamayapa.',
      requirements: 'Complete narrative of complaint and parties involved'
    }
  ];

  const DEFAULT_REQUESTS = [];

  const DEFAULT_CONCERNS = [];

  const DEFAULT_PROPOSALS = [];

  const DEFAULT_NOTIFS = [];

  // Helper to load or initialize localStorage
  function loadData(key, fallback) {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) {
        localStorage.setItem(key, JSON.stringify(fallback));
        return fallback;
      }
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error loading data for key ' + key, e);
      return fallback;
    }
  }

  function saveData(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error('Error saving data for key ' + key, e);
    }
  }

  const CANONICAL_SITIOS = [
    'Sitio Ibaba',
    'Sitio Santolan',
    'Sitio Ilaya',
    'Sitio Gitna',
    'Tierra Verde',
    'Potenciana Village',
    'G.C Berberabe'
  ];

  function normalizeSitioName(val) {
    if (!val || typeof val !== 'string') return 'Sitio Ibaba';
    const trimmed = val.trim();
    if (CANONICAL_SITIOS.includes(trimmed)) return trimmed;
    const lower = trimmed.toLowerCase();
    if (lower.includes('santolan')) return 'Sitio Santolan';
    if (lower.includes('ilaya')) return 'Sitio Ilaya';
    if (lower.includes('gitna')) return 'Sitio Gitna';
    if (lower.includes('potenciana')) return 'Potenciana Village';
    if (lower.includes('tierra verde')) return 'Tierra Verde';
    if (lower.includes('berberabe')) return 'G.C Berberabe';
    return 'Sitio Ibaba';
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeConcernUrgency(val) {
    const s = String(val || '').trim().toLowerCase();
    if (s.includes('urgent') || s.includes('critical') || s.includes('high')) {
      return 'Urgent';
    }
    return 'Standard';
  }

  function normalizeConcernStatus(val) {
    const s = String(val || '').trim().toLowerCase();
    if (s === 'resolved' || s === 'completed' || s === 'closed') {
      return 'Resolved';
    }
    if (s === 'in progress' || s === 'in review' || s === 'inspection scheduled' || s === 'under review') {
      return 'In Progress';
    }
    return 'Pending';
  }

  function normalizeConcernCategory(val) {
    const s = String(val || '').trim();
    if (!s) return 'Infrastructure';
    if (s === 'Noise') return 'Noise Disturbance';
    if (s === 'Utilities') return 'Public Utility';
    return s;
  }

  
function normalizeConcernRecord(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};

    const ref = item.ref || item.id || (
        item.concern_id
            ? `TCK-${String(item.concern_id).padStart(4, '0')}`
            : ''
    );

    const category = normalizeConcernCategory(item.category);
    const status = normalizeConcernStatus(item.concern_status || item.status);
    const urgency = normalizeConcernUrgency(item.urgency_level || item.urgency || item.severity);

    const sitio = normalizeSitioName(item.sitio_area || item.sitio || '');
    const landmark = item.landmark || item.exact_location || '';

    const location = item.location ||
        (landmark ? `${sitio} — ${landmark}` : sitio);

    const desc = item.desc ||
        item.detailed_description ||
        item.submittedDetails ||
        item.notes ||
        item.summary ||
        '';

    const title = item.title ||
        item.concern_title ||
        item.summary ||
        (desc
            ? (desc.length > 64 ? desc.slice(0, 61) + '...' : desc)
            : '');

    const dateFiled = item.dateFiled ||
        item.date_submitted ||
        item.dateLogged ||
        '';

    return {
        ref: ref,
        id: ref,
        title: title,
        desc: desc,
        category: category,
        urgency: urgency,
        status: status,
        currentStage: status === 'Resolved' ? 3 : (status === 'In Progress' ? 2 : 1),

        dateFiled: dateFiled,
        sitio: sitio,
        landmark: landmark,
        location: location,

        // Use the actual resident information returned by the database.
        reporter: item.full_legal_name || item.reporter_name || item.reporter || '',
        userEmail: item.email || item.userEmail || '',
        userMobile: item.mobile_number || item.userMobile || '',
        userAddress: item.address || item.userAddress || '',
        residentId: item.residentId || '',

        photoName: item.photo_name || item.photoName || null,
        photoData: item.photo_data || item.photoData || null,

        resolutionNote: item.resolution_notes ||
            item.resolutionNote ||
            item.actionTaken ||
            '',

        updatedAt: item.updated_at || item.updatedAt || null
    };
}

  function isConcernOwnedByUser(concern, user) {
    if (!concern || !user) return false;
    const ref = String(concern.ref || concern.id || '').trim();

    const uId = String(user.residentId || '').trim().toLowerCase();
    const cId = String(concern.residentId || '').trim().toLowerCase();
    if (uId && cId && uId === cId) return true;

    const uEmail = String(user.email || '').trim().toLowerCase();
    const cEmail = String(concern.userEmail || '').trim().toLowerCase();
    if (uEmail && cEmail && uEmail === cEmail) return true;

    if (!cId && !cEmail) {
      const uName = String(user.name || user.fullName || '').trim().toLowerCase();
      const cName = String(concern.reporter || '').trim().toLowerCase();
      if (uName && cName && uName === cName) return true;
    }

    return false;
  }

  // Load app state & sync with active session resident if available
  let currentUser = loadData('brgy360_user', null);
  try {
    const rawSession = localStorage.getItem('brgy360_session');
    if (rawSession && rawSession.startsWith('{')) {
      const parsedSession = JSON.parse(rawSession);
      const sessEmail = String(parsedSession?.email || '').trim().toLowerCase();
      if (parsedSession?.role === 'resident' && sessEmail) {
        const curEmail = String(currentUser?.email || '').trim().toLowerCase();
        const residentsDb = JSON.parse(localStorage.getItem('brgy360_residents_db') || '[]');
        const matchedResident = Array.isArray(residentsDb)
          ? residentsDb.find(u => u && u.email && u.email.trim().toLowerCase() === sessEmail)
          : null;
        if (matchedResident && curEmail !== sessEmail) {
          currentUser = { ...matchedResident };
          saveData('brgy360_user', currentUser);
        }
      }
    }
  } catch (e) {}

  if (currentUser && typeof currentUser === 'object') {
    currentUser.sitio = normalizeSitioName(currentUser.sitio);
    if (!currentUser.password) {
      try {
        const residentsDb = JSON.parse(localStorage.getItem('brgy360_residents_db') || '[]');
        const userEmail = (currentUser.email || '').trim().toLowerCase();
        const foundInDb = residentsDb.find(u => u.email && u.email.trim().toLowerCase() === userEmail);
        if (foundInDb && foundInDb.password) {
          currentUser.password = foundInDb.password;
        } else {
          currentUser.password = DEFAULT_USER.password;
        }
      } catch (e) {
        currentUser.password = DEFAULT_USER.password;
      }
    }
  }

  function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return '';

    const birthDate = new Date(dateOfBirth);

    if (isNaN(birthDate.getTime())) return '';

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const hasBirthdayPassed =
        today.getMonth() > birthDate.getMonth() ||
        (
            today.getMonth() === birthDate.getMonth() &&
            today.getDate() >= birthDate.getDate()
        );

    if (!hasBirthdayPassed) {
        age--;
    }

    return age >= 0 ? age : '';
}
  
async function loadResidentProfile() {
    try {
        const response = await fetch('http://localhost:5000/api/residents/profile', {
            method: 'GET',
            credentials: 'include'
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.user) {
            throw new Error(result.message || 'Unable to load resident profile.');
        }

        const resident = result.user;

        // Use the authenticated resident's database record as the source of truth.
        currentUser = {
            user_id: resident.user_id,
            name: resident.full_legal_name || 'Resident',
            fullName: resident.full_legal_name || 'Resident',
            email: resident.email || '',
            mobile: resident.mobile_number || '',
            dob: resident.date_of_birth || '',
            age: calculateAge(resident.date_of_birth),
            gender: resident.gender || '',
            civilStatus: resident.civil_status || '',
            address: resident.address || '',
            sitio: normalizeSitioName(resident.sitio_purok || ''),
            idOnRecord: resident.id_type || '',
            verificationStatus: resident.verification_status || '',
            verified: String(resident.verification_status || '').toLowerCase() === 'verified',
            avatarInitial: (resident.full_legal_name || 'R').trim().charAt(0).toUpperCase()
        };

        saveData('brgy360_user', currentUser);

        console.log('Authenticated resident profile loaded:', currentUser);

        syncUserDisplays();

    } catch (error) {
        console.error('Load resident profile error:', error);
    }
}

  function normalizeUserRequestRecord(r) {
    if (!r) return null;
    const id = r.id || r.ref || ('REQ-2026-' + Math.floor(10000 + Math.random() * 90000));
    const ref = r.ref || r.id || id;

    let fullName = r.fullName || r.resident || 'Verified Resident';
    let resident = r.resident || fullName;
    let userEmail = r.userEmail || r.email || '';
    let residentId = r.residentId || '';

    const docType = r.docType || r.documentType || 'Barangay Clearance';
    const documentType = r.documentType || docType;
    const sitio = r.sitio || r.purokSitio || 'Sitio Ibaba';
    const purokSitio = r.purokSitio || sitio;
    const address = r.address || (sitio + ', Barangay Pallocan West');
    const purpose = r.purpose || 'Barangay Certification';
    const dateFiled = r.dateFiled || (r.date ? r.date : new Date().toISOString().slice(0, 10));
    const date = r.date || dateFiled;
    const status = r.status || 'In Review';
    const age = r.age || '';
    const contact = r.contact || r.mobile || r.phone || '';
    const idOnRecord = r.idOnRecord || (r.attachmentName ? `Attached: ${r.attachmentName}` : '');
    const residencySince = r.residencySince || '';
    const claimMethod = r.claimMethod || 'Physical Pickup at Barangay Hall';
    const claimTarget = r.claimTarget || 'Estimated within 1–2 business days';
    const notes = r.notes || (status === 'Ready for Pickup' ? 'Cleared by Lupong Tagapamayapa. Document printed and sealed. Ready for collection.' : 'Application received online. Document being prepared for validation by Barangay Secretary.');

    return {
      ...r,
      id,
      ref,
      fullName,
      resident,
      docType,
      documentType,
      sitio,
      purokSitio,
      address,
      purpose,
      dateFiled,
      date,
      status,
      age,
      contact,
      idOnRecord,
      userEmail,
      residentId,
      residencySince,
      claimMethod,
      claimTarget,
      notes
    };
  }

  function isRequestOwnedByUser(req, user) {
    if (!req || !user) return false;
    const id = String(req.id || '').trim();
    const ref = String(req.ref || '').trim();

    const uId = String(user.residentId || '').trim().toLowerCase();
    const rId = String(req.residentId || '').trim().toLowerCase();
    if (uId && rId && uId === rId) return true;

    const uEmail = String(user.email || '').trim().toLowerCase();
    const rEmail = String(req.userEmail || req.email || '').trim().toLowerCase();
    if (uEmail && rEmail && uEmail === rEmail) return true;

    if (!rId && !rEmail) {
      const uName = String(user.name || user.fullName || '').trim().toLowerCase();
      const rName = String(req.fullName || req.resident || '').trim().toLowerCase();
      if (uName && rName && uName === rName) return true;
    }

    return false;
  }

  function loadAllServiceRequests() {
    let list = loadData('brgy360_service_requests', null);
    if (!Array.isArray(list) || list.length === 0) {
      list = loadData('brgy360_requests', null);
    }
    if (!Array.isArray(list) || list.length === 0) {
      list = DEFAULT_REQUESTS.map(normalizeUserRequestRecord);
      saveData('brgy360_service_requests', list);
      saveData('brgy360_requests', list);
    } else {
      list = list.map(normalizeUserRequestRecord);
      if (!localStorage.getItem('brgy360_requests_owner_sanitized_v2')) {
        saveData('brgy360_service_requests', list);
        saveData('brgy360_requests', list);
        saveData('brgy360_user_requests', list);
        localStorage.setItem('brgy360_requests_owner_sanitized_v2', 'true');
      }
    }
    return list;
  }

  let allServiceRequests = loadAllServiceRequests();
  let userRequests = allServiceRequests.filter(r => isRequestOwnedByUser(r, currentUser));

  async function loadMyServiceRequestsFromAPI() {
  try {
    const response = await fetch('http://localhost:5000/api/resident/requests', {
      method: 'GET',
      credentials: 'include'
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to load service requests.');
    }

    allServiceRequests = (result.requests || []).map(r =>
      normalizeUserRequestRecord({
        ...r,
        id: r.request_id,
        ref: `REQ-${r.request_id}`,
        docType: r.document_type,
        purpose: r.purpose_category,
        dateFiled: r.created_at,
        status: r.request_status
      })
    );

    // The backend already returns only this resident's requests.
    userRequests = allServiceRequests;

    renderRequestsTable();
    renderDashboardKPIs();
    renderDashboardActivityTable();

  } catch (error) {
    console.error('Load resident service requests error:', error);
    showToast('Unable to Load Requests', error.message, true);
  }
}

async function refreshUserRequestsState() {
  await loadMyServiceRequestsFromAPI();
}

  async function loadMyConcernsFromAPI() {
  try {
    const response = await fetch('http://localhost:5000/api/concerns/my', {
      method: 'GET',
      credentials: 'include'
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
    console.error('Profile update response:', {
        status: response.status,
        result: result
    });

    throw new Error(
        result.message || `Profile update failed (HTTP ${response.status}).`
    );
}

    console.log(
    'My Concerns API returned:',
    Array.isArray(result.concerns) ? result.concerns.length : 0,
    'records'
);

// ADD THIS HERE
console.table(result.concerns.map(c => ({
    id: c.concern_id,
    title: c.concern_title,
    status: c.concern_status
})));

return Array.isArray(result.concerns)
    ? result.concerns.map(normalizeConcernRecord)
    : [];

  } catch (error) {
    console.error('Load resident concerns error:', error);
    return null;
  }
}

  function loadAndSyncAllConcerns() {
    let rawList = loadData('brgy360_concerns', DEFAULT_CONCERNS);
    if (!Array.isArray(rawList)) rawList = [...DEFAULT_CONCERNS];
    let normalized = rawList.map(normalizeConcernRecord);

    saveData('brgy360_concerns', normalized);
    return normalized;
  }

  let allConcerns = loadAndSyncAllConcerns();
  let userConcerns = allConcerns.filter(c => isConcernOwnedByUser(c, currentUser));
  
  async function refreshUserConcernsState() {
    const apiConcerns = await loadMyConcernsFromAPI();

    if (apiConcerns !== null) {
        allConcerns = apiConcerns;
        userConcerns = apiConcerns;

        console.table(userConcerns.map(c => ({
    title: c.title,
    status: c.status
})));

console.log(
    'Pending:', userConcerns.filter(c => c.status === 'Pending').length,
    'In Progress:', userConcerns.filter(c => c.status === 'In Progress').length,
    'Resolved:', userConcerns.filter(c => c.status === 'Resolved').length
);

    } else {
        console.error('Unable to load concerns from the database.');

        allConcerns = [];
        userConcerns = [];
    }
}

  function isUserProposal(p, user) {
    if (!p || !user) return false;
    const id = String(p.id || '').trim();
    const ref = String(p.ref || '').trim();

    const uId = String(user.residentId || '').trim().toLowerCase();
    const pId = String(p.residentId || '').trim().toLowerCase();
    if (uId && pId && uId === pId) return true;

    const uEmail = String(user.email || '').trim().toLowerCase();
    const pEmail = String(p.email || p.userEmail || '').trim().toLowerCase();
    if (uEmail && pEmail && uEmail === pEmail) return true;

    if (!pId && !pEmail) {
      const uName = String(user.name || user.fullName || '').trim().toLowerCase();
      const pName = String(p.proponent || '').trim().toLowerCase();
      if (uName && pName && uName === pName) return true;
    }

    return false;
  }

  function normalizeUserProposalRecord(p) {
    if (!p) return null;
    const id = p.id || p.ref || ('PROP-' + Math.floor(1000 + Math.random() * 9000));
    const ref = p.ref || p.id || id;

    const title = p.title || 'Community Project Proposal';
    const category = p.category || 'Infrastructure';
    const location = normalizeSitioName(p.location || p.sitio || 'Sitio Ibaba');
    const sitio = location;

    let proponent = p.resident_full_name || p.full_legal_name || p.guest_full_name || p.proponent || currentUser?.full_legal_name || currentUser?.name || 'Community Resident';
    let email = p.email || p.userEmail || '';
    let residentId = p.residentId || '';

    const dateFiled = p.dateFiled || (p.date ? p.date : new Date().toISOString().split('T')[0]);
    const date = p.date || dateFiled;
    const year = p.year || (p.dateFiled ? String(p.dateFiled).slice(0, 4) : '2026');

    let rawBudget = 0;
    if (typeof p.rawBudget === 'number' && !isNaN(p.rawBudget)) {
      rawBudget = p.rawBudget;
    } else if (typeof p.budget === 'number' && !isNaN(p.budget)) {
      rawBudget = p.budget;
    } else if (typeof p.budget === 'string') {
      const cleaned = p.budget.replace(/[^0-9.]/g, '');
      rawBudget = parseFloat(cleaned) || 0;
    }
    const budgetFormatted = '₱' + rawBudget.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const timeline = p.timeline || 'Q1 2027 (3 months implementation)';
    const rationale = p.rationale || p.description || 'Community proposal submitted to the Barangay Development Council.';
    const description = p.description || p.rationale || rationale;

    let status = p.status || 'Pending';
    const sLow = String(status).toLowerCase();
    if (sLow.includes('review')) {
      status = 'Under Review';
    } else if (sLow.includes('approve')) {
      status = 'Approved';
    } else if (sLow.includes('reject')) {
      status = 'Rejected';
    } else {
      status = 'Pending';
    }

    const councilNote = p.councilNote || p.councilNotes || '';
    const councilNotes = p.councilNotes || p.councilNote || councilNote;

    const norm = {
      ...p,
      id,
      ref,
      title,
      category,
      location,
      sitio,
      proponent,
      email,
      userEmail: email,
      residentId,
      dateFiled,
      date,
      year,
      budget: rawBudget,
      rawBudget: rawBudget,
      budgetFormatted: budgetFormatted,
      timeline,
      rationale,
      description,
      status,
      councilNote,
      councilNotes
    };
    delete norm.votes;
    delete norm.targetVotes;
    return norm;
  }

  function loadAndSyncAllProposals() {
    let all = loadData('brgy360_proposals', null);
    if (!Array.isArray(all) || all.length === 0) {
      all = [];
      saveData('brgy360_proposals', all);
      return all;
    }
    const normalized = all.map(normalizeUserProposalRecord);
    if (!localStorage.getItem('brgy360_proposals_owner_sanitized_v2')) {
      saveData('brgy360_proposals', normalized);
      localStorage.setItem('brgy360_proposals_owner_sanitized_v2', 'true');
    }
    return normalized;
  }

  let allProposals = loadAndSyncAllProposals();
  let userProposals = allProposals.filter(p => isUserProposal(p, currentUser));
  let currentProposalView = 'mine'; // 'mine' or 'all'

  async function loadMyProposalsFromAPI() {
  const container = document.getElementById('proposalsFeedContainer');

  if (container) {
    container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;">Loading your proposals...</div>';
  }

  try {
    const response = await fetch('http://localhost:5000/api/proposals/mine', {
      method: 'GET',
      credentials: 'include'
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to load your proposals.');
    }

    const databaseProposals = Array.isArray(result.proposals)
      ? result.proposals
      : [];

    userProposals = databaseProposals.map(p => normalizeUserProposalRecord({
      id: p.tracking_code,
      ref: p.tracking_code,
      proposalId: p.proposal_id,
      title: p.project_title,
      category: p.sector_category,
      location: p.location_sitio,
      budget: Number(p.estimated_budget),
      timeline: p.proposed_target_timeline,
      rationale: p.rationale_community_impact,
      description: p.rationale_community_impact,
      dateFiled: p.submitted_at
        ? String(p.submitted_at).slice(0, 10)
        : '',
      date: p.submitted_at
        ? new Date(p.submitted_at).toLocaleDateString('en-PH')
        : '',
      year: String(p.fiscal_year),
      status: p.proposal_status,
      proponent: p.guest_full_name,
      email: p.guest_email,
      councilNote: p.council_review_notes || '',
      councilNotes: p.council_review_notes || '',
      supportingDocument: p.supporting_documents_path
    }));

    renderProposalsFeed();

  } catch (error) {
    console.error('Load resident proposals error:', error);

    if (container) {
      container.innerHTML = '<div style="text-align:center; padding:30px; color:#dc2626;">Unable to load your proposals. Please refresh the page and try again.</div>';
    }
  }
}

  function refreshUserProposalsState() {
    allProposals = loadAndSyncAllProposals();
    userProposals = allProposals.filter(p => isUserProposal(p, currentUser));
  }

  function getProposalStatusBadge(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('approved')) {
      return '<span class="status-pill status-approved">Approved</span>';
    }
    if (s.includes('review')) {
      return '<span class="status-pill status-under-review">Under Review</span>';
    }
    if (s.includes('reject')) {
      return '<span class="status-pill status-rejected">Rejected</span>';
    }
    return '<span class="status-pill status-pending">Pending</span>';
  }

  function getNotifsStorageKey() {
    const cleanEmail = String(currentUser?.email || '').trim().toLowerCase();
    if (cleanEmail) {
      return 'brgy360_notifs_' + cleanEmail;
    }
    const cleanId = String(currentUser?.residentId || '').trim().toLowerCase();
    return cleanId ? ('brgy360_notifs_' + cleanId) : 'brgy360_notifs_guest';
  }

  function loadUserNotifications() {
    const key = getNotifsStorageKey();
    const fallback = DEFAULT_NOTIFS;
    const loaded = loadData(key, fallback);
    return Array.isArray(loaded) ? loaded : fallback;
  }

  function saveUserNotifications() {
    saveData(getNotifsStorageKey(), userNotifications);
  }

  // Preserve JSON session object if present
  if (!localStorage.getItem('brgy360_session')) {
    localStorage.setItem('brgy360_session', JSON.stringify({
      role: 'resident',
      email: currentUser?.email || '',
      name: currentUser?.name || currentUser?.fullName || 'Resident User',
      loginTime: new Date().toISOString()
    }));
  }

  // ==========================================================
  // 2. DOM ELEMENT SELECTORS
  // ==========================================================

  // Tab buttons and panels
  const sidebarNavLinks = document.querySelectorAll('.sidebar-nav-link');
  const userTabPanels = document.querySelectorAll('.user-tab-panel');
  const breadcrumbTitle = document.getElementById('breadcrumbTitle');

  // Topbar dropdowns
  const notifBellBtn = document.getElementById('notifBellBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifList = document.getElementById('notifList');
  const notifCountBadge = document.getElementById('notifCountBadge');
  const notifUnreadCount = document.getElementById('notifUnreadCount');
  const markAllReadBtn = document.getElementById('markAllReadBtn');

  const userProfileBtn = document.getElementById('userProfileBtn');
  const profileDropdown = document.getElementById('profileDropdown');
  const topbarLogoutBtn = document.getElementById('topbarLogoutBtn');
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');

  // Mobile sidebar
  const sidebarToggle = document.getElementById('sidebarToggle');
  const userSidebar = document.getElementById('userSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  // Toast
  const portalToast = document.getElementById('portalToast');
  const toastTitle = document.getElementById('toastTitle');
  const toastDesc = document.getElementById('toastDesc');
  let toastTimer = null;

  // Modals
  const docRequestModal = document.getElementById('docRequestModal');
  const closeDocModalBtn = document.getElementById('closeDocModalBtn');
  const btnCancelDocModal = document.getElementById('btnCancelDocModal');
  const btnOpenNewDocModal = document.getElementById('btnOpenNewDocModal');
  const docApplicationForm = document.getElementById('docApplicationForm');
  const modalDocType = document.getElementById('modalDocType');

  const concernModal = document.getElementById('concernModal');
  const closeConcernModalBtn = document.getElementById('closeConcernModalBtn');
  const btnCancelConcernModal = document.getElementById('btnCancelConcernModal');
  const btnOpenNewConcernModal = document.getElementById('btnOpenNewConcernModal');
  const concernReportForm = document.getElementById('concernReportForm');

  const proposalModal = document.getElementById('proposalModal');
  const closeProposalModalBtn = document.getElementById('closeProposalModalBtn');
  const btnCancelPropModal = document.getElementById('btnCancelPropModal');
  const btnOpenNewProposalModal = document.getElementById('btnOpenNewProposalModal');
  const proposalSubmitForm = document.getElementById('proposalSubmitForm');

  const detailViewerModal = document.getElementById('detailViewerModal');
  const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
  const detailModalTitle = document.getElementById('detailModalTitle');
  const detailModalKicker = document.getElementById('detailModalKicker');
  const detailModalBody = document.getElementById('detailModalBody');

  // Confirmation Modal Elements
  const actionConfirmModal = document.getElementById('actionConfirmModal');
  const closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');
  const btnCancelConfirmModal = document.getElementById('btnCancelConfirmModal');
  const btnExecuteConfirmAction = document.getElementById('btnExecuteConfirmAction');
  const confirmModalKicker = document.getElementById('confirmModalKicker');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalIconBox = document.getElementById('confirmModalIconBox');
  const confirmModalMessage = document.getElementById('confirmModalMessage');
  const confirmModalDetailsBox = document.getElementById('confirmModalDetailsBox');

  let pendingActionCallback = null;

  // Quick Action triggers on dashboard
  const btnDashNewRequest = document.getElementById('btnDashNewRequest');
  const btnDashNewConcern = document.getElementById('btnDashNewConcern');
  const scRequestDoc = document.getElementById('scRequestDoc');
  const scFileConcern = document.getElementById('scFileConcern');
  const scProposeProj = document.getElementById('scProposeProj');

  // Account forms
  const updateProfileForm = document.getElementById('updateProfileForm');
  const changePasswordForm = document.getElementById('changePasswordForm');
  const idUploadForm = document.getElementById('idUploadForm');

  // File input labels
  const modalDocAttachment = document.getElementById('modalDocAttachment');
  const modalDocAttachmentName = document.getElementById('modalDocAttachmentName');
  const modalConcernPhoto = document.getElementById('modalConcernPhoto');
  const modalConcernPhotoName = document.getElementById('modalConcernPhotoName');
  const newIdFile = document.getElementById('newIdFile');
  const newIdFileName = document.getElementById('newIdFileName');

  // ==========================================================
  // 3. TOAST NOTIFICATION UTILITY
  // ==========================================================

  function showToast(title, desc, isError = false) {
    if (!portalToast) return;
    if (toastTimer) clearTimeout(toastTimer);

    if (toastTitle) toastTitle.textContent = title;
    if (toastDesc) toastDesc.textContent = desc;

    portalToast.style.display = 'flex';
    portalToast.style.borderColor = isError ? '#fecaca' : '#bbf7d0';

    const iconWrap = document.getElementById('toastIcon');
    if (iconWrap) {
      iconWrap.style.background = isError ? '#dc2626' : '#16a34a';
    }

    toastTimer = setTimeout(function () {
      portalToast.style.display = 'none';
    }, 4000);
  }

  // ==========================================================
  // 4. TAB ROUTING (SPA NAVIGATION)
  // ==========================================================

  const TAB_NAMES = {
    dashboard: 'Dashboard Home',
    services: 'My Service Requests',
    reports: 'My Concerns & Complaints',
    proposals: 'Propose a Project',
    account: 'My Account & Verification'
  };

  function switchTab(tabId) {
    if (!tabId || !TAB_NAMES[tabId]) tabId = 'dashboard';

    // Update active nav links
    sidebarNavLinks.forEach(function (link) {
      if (link.getAttribute('data-tab') === tabId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update active panels
    userTabPanels.forEach(function (panel) {
      if (panel.id === 'user-' + tabId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Update breadcrumb
    if (breadcrumbTitle) {
      breadcrumbTitle.textContent = TAB_NAMES[tabId];
    }

    // Update URL hash without full reload
    window.location.hash = tabId;

    // Close mobile drawer if open
    closeMobileSidebar();

    // Scroll to top of main viewport
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainEl = document.getElementById('userMain');
    if (mainEl) mainEl.scrollTop = 0;
  }

  // Attach click listeners to sidebar tabs
  sidebarNavLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      const tab = this.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Attach click listeners to any element with data-goto-tab
  document.querySelectorAll('[data-goto-tab]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      const targetTab = this.getAttribute('data-goto-tab');
      switchTab(targetTab);
      // Close profile dropdown if open
      if (profileDropdown) profileDropdown.classList.remove('active');
    });
  });

  // Handle URL hash on page load
  function handleInitialHash() {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && TAB_NAMES[hash]) {
      switchTab(hash);
    } else {
      switchTab('dashboard');
    }
  }

  window.addEventListener('hashchange', function () {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && TAB_NAMES[hash]) {
      switchTab(hash);
    }
  });

  // ==========================================================
  // 5. MOBILE DRAWER NAVIGATION
  // ==========================================================

  function openMobileSidebar() {
    if (userSidebar) userSidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileSidebar() {
    if (userSidebar) userSidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function () {
      if (userSidebar && userSidebar.classList.contains('open')) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileSidebar);
  }

// ==========================================================
// 6. TOPBAR DROPDOWNS (DATABASE NOTIFICATIONS & PROFILE)
// ==========================================================

const RESIDENT_NOTIFICATIONS_API =
    'http://localhost:5000/api/residents/notifications';

let userNotifications = [];

function toggleDropdown(menu) {
    const isOpen = menu.classList.contains('active');

    if (notifDropdown) notifDropdown.classList.remove('active');
    if (profileDropdown) profileDropdown.classList.remove('active');

    if (!isOpen) {
        menu.classList.add('active');

        if (menu === notifDropdown) {
            loadResidentNotifications();
        }
    }
}

// Notification bell
if (notifBellBtn && notifDropdown) {
    notifBellBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDropdown(notifDropdown);
    });
}

// Profile dropdown
if (userProfileBtn && profileDropdown) {
    userProfileBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDropdown(profileDropdown);
    });
}

// Close dropdowns on outside click
document.addEventListener('click', function (e) {
    if (
        notifDropdown &&
        !notifDropdown.contains(e.target) &&
        !notifBellBtn?.contains(e.target)
    ) {
        notifDropdown.classList.remove('active');
    }

    if (
        profileDropdown &&
        !profileDropdown.contains(e.target) &&
        !userProfileBtn?.contains(e.target)
    ) {
        profileDropdown.classList.remove('active');
    }
});

// Safely escape database content before displaying it
function escapeResidentNotificationHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
}

// Format notification date and time
function formatResidentNotificationTime(dateValue) {
    if (!dateValue) return '';

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

// Update unread badge and subtitle
function updateResidentNotificationCount(unreadCount) {
    const count = Number(unreadCount) || 0;

    if (notifCountBadge) {
        notifCountBadge.textContent = count > 99 ? '99+' : count;
        notifCountBadge.style.display =
            count > 0 ? 'inline-block' : 'none';
    }

    if (notifUnreadCount) {
        notifUnreadCount.textContent =
            `${count} unread notice${count === 1 ? '' : 's'}`;
    }
}

// Retrieve and manage resident data through the Brgy360 backend API.
// Resident records are stored and managed in Supabase PostgreSQL.
function renderNotifications() {
    if (!notifList) return;

    if (userNotifications.length === 0) {
        notifList.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">
                No notifications yet.
            </div>
        `;
        return;
    }

    notifList.innerHTML = userNotifications.map(notification => {
        const isUnread = Number(notification.is_read) === 0;

        return `
            <div
                class="notif-item ${isUnread ? 'unread' : ''}"
                data-notif-id="${Number(notification.notification_id)}"
                style="cursor: pointer;"
            >
                <div class="notif-item-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16"
                        fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                </div>

                <div class="notif-item-text">
                    <h5 class="notif-item-title">
                        ${escapeResidentNotificationHTML(notification.title)}
                    </h5>

                    <p class="notif-item-desc">
                        ${escapeResidentNotificationHTML(notification.message)}
                    </p>

                    <span class="notif-item-time">
                        ${escapeResidentNotificationHTML(
                            formatResidentNotificationTime(notification.created_at)
                        )}
                    </span>

                    ${isUnread
                        ? '<span class="notif-item-time">Unread</span>'
                        : ''}
                </div>
            </div>
        `;
    }).join('');

    // Mark an individual notification as read
    notifList.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', async function () {
            const notificationId = this.dataset.notifId;

            await markResidentNotificationAsRead(notificationId);
        });
    });
}

// Load resident notifications from backend
async function loadResidentNotifications() {
    if (!notifList) return;

    try {
        const response = await fetch(RESIDENT_NOTIFICATIONS_API, {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'Unable to load notifications.'
            );
        }

        userNotifications = data.notifications || [];

        updateResidentNotificationCount(data.unreadCount);
        renderNotifications();

    } catch (error) {
        console.error('Load resident notifications error:', error);

        notifList.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #dc2626; font-size: 13px;">
                Unable to load notifications. Please try again.
            </div>
        `;
    }
}

// Mark one notification as read
async function markResidentNotificationAsRead(notificationId) {
    try {
        const response = await fetch(
            `${RESIDENT_NOTIFICATIONS_API}/${notificationId}/read`,
            {
                method: 'PATCH',
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'Unable to update notification.'
            );
        }

        await loadResidentNotifications();

    } catch (error) {
        console.error('Mark resident notification as read error:', error);

        showToast(
            'Notification Error',
            'Unable to mark notification as read.'
        );
    }
}

// Mark all notifications as read
if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', async function () {
        try {
            const response = await fetch(
                `${RESIDENT_NOTIFICATIONS_API}/read-all`,
                {
                    method: 'PATCH',
                    credentials: 'include'
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Unable to update notifications.'
                );
            }

            await loadResidentNotifications();

            showToast(
                'Notifications Updated',
                'All notifications have been marked as read.'
            );

        } catch (error) {
            console.error('Mark all resident notifications as read error:', error);

            showToast(
                'Notification Error',
                'Unable to mark all notifications as read.'
            );
        }
    });
}

// Load notifications when the page opens
loadResidentNotifications();

// Refresh notifications every 30 seconds
setInterval(loadResidentNotifications, 30000);


  // ==========================================================
  // 7. USER PROFILE SYNCHRONIZATION
  // ==========================================================

  function syncUserDisplays() {
    const name = currentUser.full_legal_name || currentUser.name || currentUser.fullName || 'Resident User';
    const residentId = currentUser.user_id
    ? `PW-${new Date().getFullYear()}-${String(currentUser.user_id).padStart(4, '0')}`
    : '—';
    const initial = currentUser.avatarInitial || name.charAt(0).toUpperCase();
    const sitio = normalizeSitioName(currentUser.sitio);
    const email = currentUser.email || '';
    const mobile = currentUser.mobile || '';
    const address = currentUser.address || '';

    // Topbar
    const topbarAvatar = document.getElementById('topbarAvatar');
    const topbarUserName = document.getElementById('topbarUserName');
    if (topbarAvatar) topbarAvatar.textContent = initial;
    if (topbarUserName) topbarUserName.textContent = name;

    // Dropdown
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    const dropdownUserTier = document.getElementById('dropdownUserTier');
    if (dropdownAvatar) dropdownAvatar.textContent = initial;
    if (dropdownUserName) dropdownUserName.textContent = name;
    if (dropdownUserEmail) dropdownUserEmail.textContent = email;


    if (dropdownUserTier) {
        dropdownUserTier.textContent = sitio + ' • Resident ID: ' + residentId;
    }

    // Sidebar
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserStatus = document.getElementById('sidebarUserStatus');
    if (sidebarAvatar) sidebarAvatar.textContent = initial;
    if (sidebarUserName) sidebarUserName.textContent = name;
    if (sidebarUserStatus) {
    sidebarUserStatus.textContent =
        (currentUser.verified ? 'Verified Resident' : 'Verification Pending') + ' • ' + sitio;
}

    // Dashboard Welcome
    const welcomeUserName = document.getElementById('welcomeUserName');
    const welcomeVerificationBadge = document.getElementById('welcomeVerificationBadge');
    if (welcomeUserName) welcomeUserName.textContent = name;
    if (welcomeVerificationBadge) {
    welcomeVerificationBadge.textContent =
        (currentUser.verified ? 'Verified Resident' : 'Verification Pending') + ' • ' + sitio;
}

    // Account tab
    const accountAvatar = document.getElementById('accountAvatar');
    const accountFullName = document.getElementById('accountFullName');
    const accountSitio = document.getElementById('accountSitio');
    const accountDob = document.getElementById('accountDob');
    const accountGender = document.getElementById('accountGender');
    const accountCivilStatus = document.getElementById('accountCivilStatus');
    const accountMemberSince = document.getElementById('accountMemberSince');
    const accountResidentId = document.getElementById('accountResidentId');
    const accountIdDocTitle = document.getElementById('accountIdDocTitle');
    const accountIdDocNum = document.getElementById('accountIdDocNum');
    if (accountAvatar) accountAvatar.textContent = initial;
    if (accountFullName) accountFullName.textContent = name;
    if (accountSitio) accountSitio.textContent = sitio;
    if (accountResidentId) {
    accountResidentId.textContent = residentId;
}
    
    if (accountDob) accountDob.textContent = currentUser.dob
    ? new Date(currentUser.dob).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    })
    : 'Not provided';
    if (accountGender) accountGender.textContent = currentUser.gender || 'Not Specified';
    if (accountCivilStatus) accountCivilStatus.textContent = currentUser.civilStatus || 'Not provided';
    if (accountMemberSince) {
      if (currentUser.submittedAt) {
        const regDate = new Date(currentUser.submittedAt);
        accountMemberSince.textContent = !isNaN(regDate.getTime())
          ? regDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : 'October 2026';
      } else {
        accountMemberSince.textContent = 'October 2026';
      }
    }
    if (accountIdDocTitle) {
    accountIdDocTitle.textContent = currentUser.idOnRecord || currentUser.idType || 'Not provided';
}

    if (accountIdDocNum) {
        if (currentUser.idNumber) {
            const tail = String(currentUser.idNumber).slice(-4);
            accountIdDocNum.textContent = '****-****-' + tail;
        } else {
            accountIdDocNum.textContent = currentUser.idOnRecord || 'Verified on File';
        }
    }

    // Edit form inputs
    const profileMobile = document.getElementById('profileMobile');
    const profileEmail = document.getElementById('profileEmail');
    const profileAddress = document.getElementById('profileAddress');
    const profileSitio = document.getElementById('profileSitio');
    const profileAge = document.getElementById('profileAge');

    if (profileMobile) profileMobile.value = mobile;
    if (profileEmail) profileEmail.value = email;
    if (profileAddress) profileAddress.value = address;
    if (profileSitio) profileSitio.value = sitio;

    // Automatically display age calculated from date of birth.
    if (profileAge) {
        profileAge.value = currentUser.age !== undefined && currentUser.age !== ''
            ? currentUser.age
            : calculateAge(currentUser.dob);
    }

    // Request Modal Prefills
    const modalDocFullName = document.getElementById('modalDocFullName');
    const modalDocMobile = document.getElementById('modalDocMobile');
    const modalDocSitio = document.getElementById('modalDocSitio');
    const modalDocAddress = document.getElementById('modalDocAddress');
    if (modalDocFullName) modalDocFullName.value = name;
    if (modalDocMobile) modalDocMobile.value = mobile;
    if (modalDocSitio) modalDocSitio.value = sitio;
    if (modalDocAddress) modalDocAddress.value = address;

    // Concern Modal Prefills
    const modalConcernReporter = document.getElementById('modalConcernReporter');
    const modalConcernContact = document.getElementById('modalConcernContact');
    const modalConcernSitio = document.getElementById('modalConcernSitio');
    const modalConcernDate = document.getElementById('modalConcernDate');
    if (modalConcernReporter) modalConcernReporter.value = name;
    if (modalConcernContact) modalConcernContact.value = mobile + ' • ' + email;
    if (modalConcernSitio && !modalConcernSitio.value) modalConcernSitio.value = sitio;
    if (modalConcernDate && !modalConcernDate.value) modalConcernDate.value = new Date().toISOString().split('T')[0];
  }

  // Date banner update
  function updateDateBanner() {
    const dateEl = document.getElementById('welcomeCurrentDate');
    if (!dateEl) return;
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('en-PH', options);
  }

  // ==========================================================
  // 8. RENDER DASHBOARD KPIS & ACTIVITY FEED
  // ==========================================================

  function renderDashboardKPIs() {
    // 1. Service requests
    const activeReqs = userRequests.filter(r => r.status !== 'Completed' && r.status !== 'Rejected' && r.status !== 'Cancelled');
    const kpiActiveRequests = document.getElementById('kpiActiveRequests');
    if (kpiActiveRequests) kpiActiveRequests.textContent = activeReqs.length;

    // Sidebar counter
    const sidebarServicesCount = document.getElementById('sidebarServicesCount');
    if (sidebarServicesCount) sidebarServicesCount.textContent = activeReqs.length;

    // 2. Concerns
    const kpiTotalConcerns = document.getElementById('kpiTotalConcerns');
    if (kpiTotalConcerns) kpiTotalConcerns.textContent = userConcerns.length;

    const pendingConcernsCount = userConcerns.filter(c => c.status === 'Pending').length;
    const inProgressConcernsCount = userConcerns.filter(c => c.status === 'In Progress').length;
    const resolvedConcernsCount = userConcerns.filter(c => c.status === 'Resolved').length;
    const openConcernsCount = pendingConcernsCount + inProgressConcernsCount;

    const sidebarReportsCount = document.getElementById('sidebarReportsCount');
    if (sidebarReportsCount) sidebarReportsCount.textContent = openConcernsCount;

    const kpiConcernsStatusSub = document.getElementById('kpiConcernsStatusSub');
    if (kpiConcernsStatusSub) {
      const pills = [];
      if (pendingConcernsCount > 0) {
        pills.push(`<span class="status-pill status-pending">${pendingConcernsCount} Pending</span>`);
      }
      if (inProgressConcernsCount > 0) {
        pills.push(`<span class="status-pill status-in-review">${inProgressConcernsCount} In Progress</span>`);
      }
      if (resolvedConcernsCount > 0 || pills.length === 0) {
        pills.push(`<span class="status-pill status-resolved">${resolvedConcernsCount} Resolved</span>`);
      }
      kpiConcernsStatusSub.innerHTML = pills.join('');
    }

    // 3. Proposals
    const kpiTotalProposals = document.getElementById('kpiTotalProposals');
    if (kpiTotalProposals) kpiTotalProposals.textContent = userProposals.length;
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'Ready for Pickup': return 'status-ready';
      case 'In Progress':
      case 'In Review': return 'status-in-review';
      case 'Pending':
      case 'New': return 'status-pending';
      case 'Completed': return 'status-completed';
      case 'Resolved': return 'status-resolved';
      case 'Cancelled': return 'status-cancelled';
      case 'Standard': return 'status-standard';
      case 'Rejected':
      case 'Urgent': return 'status-urgent';
      default: return 'status-pending';
    }
  }

  function renderDashboardActivityTable() {
    const tbody = document.getElementById('dashActivityTableBody');
    if (!tbody) return;

    // Combine recent items
    const combined = [];

    userRequests.forEach(function (r) {
      combined.push({
        ref: r.ref,
        subject: r.docType,
        subtext: r.purpose,
        date: r.dateFiled,
        status: r.status,
        type: 'Service Request',
        raw: r
      });
    });

    userConcerns.forEach(function (c) {
      combined.push({
        ref: c.ref,
        subject: c.title || (c.category + ' Concern'),
        subtext: c.category + ' • ' + c.location,
        date: c.dateFiled,
        status: c.status,
        type: 'Citizen Concern',
        raw: c
      });
    });

    userProposals.forEach(function (p) {
      combined.push({
        ref: p.ref,
        subject: p.title,
        subtext: 'Budget: ₱' + Number(p.budget).toLocaleString(),
        date: p.dateFiled,
        status: p.status,
        type: 'Project Proposal',
        raw: p
      });
    });

    // Sort by date descending
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (combined.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 24px;">No recent transactions on record.</td></tr>';
      return;
    }

    let rowsHtml = '';
    combined.slice(0, 5).forEach(function (item) {
      const badgeClass = getStatusBadgeClass(item.status);
      rowsHtml += `
        <tr>
          <td style="vertical-align: middle;"><span class="table-ref-code">${item.ref}</span></td>
          <td style="vertical-align: middle;">
            <div class="table-subject-meta">
              <span class="table-subject-title">${item.subject}</span>
              <span class="table-subject-sub">${item.subtext}</span>
            </div>
          </td>
          <td style="white-space: nowrap; vertical-align: middle;">${item.date}</td>
          <td style="white-space: nowrap; vertical-align: middle;"><span class="status-pill ${badgeClass}">${item.status}</span></td>
          <td style="white-space: nowrap; vertical-align: middle;">
            <button type="button" class="btn-table-action" data-view-ref="${item.ref}">View</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = rowsHtml;

    // Attach listeners to View buttons
    tbody.querySelectorAll('[data-view-ref]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const ref = this.getAttribute('data-view-ref');
        openDetailViewer(ref);
      });
    });
  }

  // ==========================================================
  // 9. TAB 2: SERVICES CATALOG & REQUEST TRACKER
  // ==========================================================

  function renderServicesCatalog() {
    const grid = document.getElementById('servicesCatalogGrid');
    if (!grid) return;

    let html = '';
    DEFAULT_SERVICES.forEach(function (s) {
      html += `
        <div class="service-card-apply">
          <div class="service-apply-header">
            <h4 class="service-apply-title">${s.name}</h4>
            <span class="service-fee-tag ${s.isFree ? 'free' : ''}">${s.fee}</span>
          </div>
          <p class="service-apply-desc">${s.desc}</p>
          <div class="service-apply-meta">
            <span class="service-turnaround">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>${s.turnaround}</span>
            </span>
            <button type="button" class="btn-service-start" data-request-doc="${s.name}">Apply Now</button>
          </div>
        </div>
      `;
    });
    grid.innerHTML = html;

    // Attach click to "Apply Now"
    grid.querySelectorAll('[data-request-doc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const docName = this.getAttribute('data-request-doc');
        openDocModalWithPreset(docName);
      });
    });
  }

  // ==========================================================
  // ACTION CONFIRMATION & DIALOG UTILITIES
  // ==========================================================

  function showActionConfirmModal({
    kicker = 'APPLICATION ACTION',
    title = 'Confirm Action',
    type = 'default',
    message = '',
    detailsHtml = '',
    confirmText = 'Confirm',
    cancelText = 'Go Back',
    isAlertOnly = false,
    onConfirm = null
  }) {
    if (!actionConfirmModal) return;

    if (confirmModalKicker) confirmModalKicker.textContent = kicker;
    if (confirmModalTitle) confirmModalTitle.textContent = title;
    if (confirmModalMessage) confirmModalMessage.innerHTML = message;

    if (confirmModalDetailsBox) {
      if (detailsHtml) {
        confirmModalDetailsBox.innerHTML = detailsHtml;
        confirmModalDetailsBox.style.display = 'block';
      } else {
        confirmModalDetailsBox.innerHTML = '';
        confirmModalDetailsBox.style.display = 'none';
      }
    }

    if (confirmModalIconBox) {
      if (type === 'delete') {
        confirmModalIconBox.innerHTML = `
          <div style="width: 44px; height: 44px; border-radius: 10px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
          <div>
            <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #0f172a; font-weight: 700;">Permanent Deletion</h4>
            <p style="margin: 0; font-size: 12.5px; color: #64748b;">This completed application will be permanently removed from your history.</p>
          </div>
        `;
      } else if (type === 'cancel') {
        confirmModalIconBox.innerHTML = `
          <div style="width: 44px; height: 44px; border-radius: 10px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <div>
            <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #0f172a; font-weight: 700;">Cancel Document Application</h4>
            <p style="margin: 0; font-size: 12.5px; color: #64748b;">Processing will be halted immediately.</p>
          </div>
        `;
      } else {
        confirmModalIconBox.innerHTML = `
          <div style="width: 44px; height: 44px; border-radius: 10px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div>
            <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #0f172a; font-weight: 700;">Notice</h4>
            <p style="margin: 0; font-size: 12.5px; color: #64748b;">Barangay service processing rule</p>
          </div>
        `;
      }
    }

    if (btnExecuteConfirmAction) {
      btnExecuteConfirmAction.textContent = confirmText;
      btnExecuteConfirmAction.className = type === 'delete' ? 'btn-dash-danger' : (type === 'cancel' ? 'btn-dash-warning' : 'btn-dash-primary');
      if (isAlertOnly) {
        btnExecuteConfirmAction.style.display = 'none';
      } else {
        btnExecuteConfirmAction.style.display = 'inline-flex';
      }
    }

    if (btnCancelConfirmModal) {
      btnCancelConfirmModal.textContent = isAlertOnly ? 'Close' : cancelText;
    }

    pendingActionCallback = onConfirm;
    openModal(actionConfirmModal);
  }

  function handleCancelRequest(ref) {
    const req = userRequests.find(r => r.ref === ref);
    if (!req) return;

    if (req.status === 'Ready for Pickup') {
      showActionConfirmModal({
        kicker: 'CANCELLATION NOT ALLOWED',
        title: 'Document Already Ready for Pickup',
        type: 'warning',
        isAlertOnly: true,
        message: `Application <strong>${req.ref}</strong> for <strong>${req.docType}</strong> cannot be cancelled because it is already marked <strong>Ready for Pickup</strong> at Barangay Hall (Window 2). The official document has already been verified, printed, and dry-sealed. If you no longer need this certificate, please inform the staff at Window 2.`,
        detailsHtml: `
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Reference No.:</span>
            <strong class="table-ref-code">${req.ref}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Document:</span>
            <strong>${req.docType}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Status:</span>
            <span class="status-pill status-ready">${req.status}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Claiming Mode:</span>
            <span>${req.claimMethod}</span>
          </div>
        `,
        cancelText: 'Understood'
      });
      return;
    }

    if (req.status === 'Completed') {
      showToast('Cannot Cancel', 'This request is already completed and claimed.', true);
      return;
    }

    if (req.status === 'Cancelled') {
      showToast('Already Cancelled', 'This application was already cancelled.', true);
      return;
    }

    // Eligible for cancellation (e.g. 'In Review', 'Pending')
    showActionConfirmModal({
      kicker: 'CANCEL APPLICATION REQUEST',
      title: 'Cancel Document Request?',
      type: 'cancel',
      message: `Are you sure you want to cancel your application for <strong>${req.docType}</strong>? This will stop further review and processing by barangay staff.`,
      detailsHtml: `
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748b;">Reference No.:</span>
          <strong class="table-ref-code">${req.ref}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748b;">Document:</span>
          <strong>${req.docType}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748b;">Current Status:</span>
          <span class="status-pill ${getStatusBadgeClass(req.status)}">${req.status}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b;">Date Submitted:</span>
          <span>${req.dateFiled}</span>
        </div>
      `,
      confirmText: 'Yes, Cancel Request',
      cancelText: 'Keep Request',
      onConfirm: async function () {
  try {
    // Extract the numeric database request ID from the reference
    const requestId = String(req.id || req.ref).replace(/^REQ-/, '');

    if (!/^\d+$/.test(requestId)) {
      throw new Error('Invalid database request ID.');
    }

    const response = await fetch(
      `http://localhost:5000/api/resident/requests/${requestId}/cancel`,
      {
        method: 'PATCH',
        credentials: 'include'
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to cancel request.');
    }

    // Update the frontend record only after the database confirms success
    req.status = 'Cancelled';

    const todayStr = new Date().toISOString().split('T')[0];
    req.notes = (req.notes ? req.notes + ' ' : '') +
      `Cancelled by resident on ${todayStr}.`;

    const updateRequest = (list) => {
      const index = list.findIndex(r =>
        r.ref === req.ref || r.id === req.id
      );

      if (index !== -1) {
        list[index].status = 'Cancelled';
        list[index].notes = req.notes;
      }
    };

    updateRequest(allServiceRequests);
    updateRequest(userRequests);

    renderRequestsTable();
    renderDashboardKPIs();
    renderDashboardActivityTable();

    showToast(
      'Request Cancelled',
      `Application ${req.ref} has been cancelled successfully.`
    );

  } catch (error) {
    console.error('Cancel service request error:', error);

    showToast(
      'Cancellation Failed',
      error.message || 'Unable to cancel your request. Please try again.',
      true
    );
  }
}
    });
  }

  function handleDeleteRequest(ref) {
    const req = userRequests.find(r => r.ref === ref);
    if (!req) return;

    if (req.status !== 'Completed') {
      showActionConfirmModal({
        kicker: 'DELETION NOT ALLOWED',
        title: 'Only Completed Applications Can Be Deleted',
        type: 'warning',
        isAlertOnly: true,
        message: `Application <strong>${req.ref}</strong> currently has status <strong>${req.status}</strong>. Per barangay auditing policy, applications can only be deleted from your history once they are marked <strong>Completed</strong>. Active, in-review, and ready-for-pickup requests must remain on record to track issuance.`,
        detailsHtml: `
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Reference No.:</span>
            <strong class="table-ref-code">${req.ref}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Document:</span>
            <strong>${req.docType}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Current Status:</span>
            <span class="status-pill ${getStatusBadgeClass(req.status)}">${req.status}</span>
          </div>
        `,
        cancelText: 'Understood'
      });
      return;
    }

    // Eligible for deletion (status === 'Completed')
    showActionConfirmModal({
      kicker: 'PERMANENT DELETION',
      title: 'Delete Completed Application?',
      type: 'delete',
      message: `Are you sure you want to permanently remove completed application <strong>${req.ref}</strong> (<strong>${req.docType}</strong>) from your application history?`,
      detailsHtml: `
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748b;">Reference No.:</span>
          <strong class="table-ref-code">${req.ref}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748b;">Document:</span>
          <strong>${req.docType}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748b;">Status:</span>
          <span class="status-pill status-completed">${req.status}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b;">Date Claimed:</span>
          <span>${req.claimTarget || req.dateFiled}</span>
        </div>
      `,
      confirmText: 'Yes, Delete Record',
      cancelText: 'Keep Record',
      onConfirm: function () {
        let latestAll = loadAllServiceRequests();
        latestAll = latestAll.filter(r => r.ref !== ref && r.id !== ref);
        saveData('brgy360_service_requests', latestAll);
        saveData('brgy360_requests', latestAll);
        saveData('brgy360_user_requests', latestAll);
        window.dispatchEvent(new CustomEvent('brgy360_requests_changed', { detail: latestAll }));

        refreshUserRequestsState();

        userNotifications.unshift({
          id: 'notif-' + Date.now(),
          title: 'Record Deleted',
          desc: `Completed application record ${req.ref} (${req.docType}) was removed from your history.`,
          time: 'Just now',
          unread: false,
          type: 'blue'
        });
        saveUserNotifications();

        renderRequestsTable();
        renderDashboardKPIs();
        renderDashboardActivityTable();
        renderNotifications();
        showToast('Record Deleted', `Application ${req.ref} has been removed from your history.`);
      }
    });
  }

  function renderRequestsTable() {
    const tbody = document.getElementById('servicesRequestsTableBody');
    if (!tbody) return;

    const searchVal = (document.getElementById('requestsSearchInput')?.value || '').toLowerCase().trim();
    const activeFilterBtn = document.querySelector('#requestsFilterPills .filter-pill-btn.active');
    const filter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'All';

    // Update filter counts
    const countAll = userRequests.length;
    const countReady = userRequests.filter(r => r.status === 'Ready for Pickup').length;
    const countReview = userRequests.filter(r => r.status === 'In Review').length;
    const countDone = userRequests.filter(r => r.status === 'Completed').length;
    const countCancel = userRequests.filter(r => r.status === 'Cancelled').length;

    const countAllEl = document.getElementById('countAllReq');
    const countReadyEl = document.getElementById('countReadyReq');
    const countReviewEl = document.getElementById('countReviewReq');
    const countDoneEl = document.getElementById('countDoneReq');
    const countCancelEl = document.getElementById('countCancelReq');
    if (countAllEl) countAllEl.textContent = countAll;
    if (countReadyEl) countReadyEl.textContent = countReady;
    if (countReviewEl) countReviewEl.textContent = countReview;
    if (countDoneEl) countDoneEl.textContent = countDone;
    if (countCancelEl) countCancelEl.textContent = countCancel;

    // Filter requests
    const filtered = userRequests.filter(function (r) {
      const matchFilter = filter === 'All' || r.status === filter;
      const matchSearch = !searchVal || 
        r.ref.toLowerCase().includes(searchVal) ||
        r.docType.toLowerCase().includes(searchVal) ||
        r.purpose.toLowerCase().includes(searchVal) ||
        r.status.toLowerCase().includes(searchVal);
      return matchFilter && matchSearch;
    });

    if (filtered.length === 0) {
      const emptyMsg = userRequests.length === 0
        ? 'You have no service requests yet. Click "+ New Application" or select a document above to submit your first request.'
        : 'No requests found matching your filter criteria.';
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 32px;">${emptyMsg}</td></tr>`;
      return;
    }

    let rowsHtml = '';
    filtered.forEach(function (r) {
      const badgeClass = getStatusBadgeClass(r.status);
      const isPickup = r.status === 'Ready for Pickup';
      const isCompleted = r.status === 'Completed';
      const isCancelled = r.status === 'Cancelled';
      const canCancel = !isPickup && !isCompleted && !isCancelled;
      const canDelete = isCompleted;

      // Cancel button rendering
      let cancelBtnHtml = '';
      if (canCancel) {
        cancelBtnHtml = `<button type="button" class="btn-table-action btn-table-cancel" data-cancel-ref="${r.ref}" title="Cancel this application">Cancel</button>`;
      } else if (isPickup) {
        cancelBtnHtml = `<button type="button" class="btn-table-action btn-table-cancel disabled" data-cancel-ref="${r.ref}" title="Cannot be cancelled: document is already ready for pickup at Barangay Hall">Cancel</button>`;
      } else if (isCancelled) {
        cancelBtnHtml = `<button type="button" class="btn-table-action btn-table-cancel disabled" data-cancel-ref="${r.ref}" title="This request has already been cancelled" disabled>Cancelled</button>`;
      } else {
        cancelBtnHtml = `<button type="button" class="btn-table-action btn-table-cancel disabled" data-cancel-ref="${r.ref}" title="Completed request cannot be cancelled" disabled>Cancel</button>`;
      }

      // Delete button rendering
      let deleteBtnHtml = '';
      if (canDelete) {
        deleteBtnHtml = `<button type="button" class="btn-table-action btn-table-delete" data-delete-ref="${r.ref}" title="Delete completed application from history">Delete</button>`;
      } else {
        deleteBtnHtml = `<button type="button" class="btn-table-action btn-table-delete disabled" data-delete-ref="${r.ref}" title="Can only be deleted once marked Completed (current status: ${r.status})">Delete</button>`;
      }

      rowsHtml += `
        <tr>
          <td style="vertical-align: middle;"><span class="table-ref-code">${r.ref}</span></td>
          <td style="vertical-align: middle;"><strong>${r.docType}</strong></td>
          <td style="vertical-align: middle;"><span style="font-size: 12.5px; color: #475569;">${r.purpose}</span></td>
          <td style="white-space: nowrap; vertical-align: middle;">${r.dateFiled}</td>
          <td style="vertical-align: middle;"><span style="font-size: 12px; color: #334155;">${r.claimMethod}</span></td>
          <td style="white-space: nowrap; vertical-align: middle;"><span class="status-pill ${badgeClass}">${r.status}</span></td>
          <td style="white-space: nowrap; vertical-align: middle;">
            <div class="table-actions-group">
              <button type="button" class="btn-table-action" data-view-ref="${r.ref}" title="View Details">Details</button>
              ${cancelBtnHtml}
              ${deleteBtnHtml}
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = rowsHtml;

    tbody.querySelectorAll('[data-view-ref]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const ref = this.getAttribute('data-view-ref');
        openDetailViewer(ref);
      });
    });

    tbody.querySelectorAll('[data-cancel-ref]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const ref = this.getAttribute('data-cancel-ref');
        handleCancelRequest(ref);
      });
    });

    tbody.querySelectorAll('[data-delete-ref]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const ref = this.getAttribute('data-delete-ref');
        handleDeleteRequest(ref);
      });
    });
  }

  // Filter pills events for requests
  const reqFilterPills = document.querySelectorAll('#requestsFilterPills .filter-pill-btn');
  reqFilterPills.forEach(function (btn) {
    btn.addEventListener('click', function () {
      reqFilterPills.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderRequestsTable();
    });
  });

  const requestsSearchInput = document.getElementById('requestsSearchInput');
  if (requestsSearchInput) {
    requestsSearchInput.addEventListener('input', renderRequestsTable);
  }

  // ==========================================================
  // 10. TAB 3: CONCERNS FEED & TRACKER
  // ==========================================================

  function renderConcernsFeed() {
    const container = document.getElementById('concernsFeedContainer');
    if (!container) return;

    const searchVal = (document.getElementById('concernsSearchInput')?.value || '').toLowerCase().trim();
    const activeFilterBtn = document.querySelector('#concernsFilterPills .filter-pill-btn.active');
    const filter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'All';

    // Update counts (Pending, In Progress, Resolved)
    const countAll = userConcerns.length;
    const countPending = userConcerns.filter(c => c.status === 'Pending').length;
    const countProgress = userConcerns.filter(c => c.status === 'In Progress').length;
    const countResolved = userConcerns.filter(c => c.status === 'Resolved').length;

    const countAllEl = document.getElementById('countAllConcerns');
    const countPendingEl = document.getElementById('countPendingConcerns');
    const countProgressEl = document.getElementById('countProgressConcerns');
    const countResolvedEl = document.getElementById('countResolvedConcerns');
    if (countAllEl) countAllEl.textContent = countAll;
    if (countPendingEl) countPendingEl.textContent = countPending;
    if (countProgressEl) countProgressEl.textContent = countProgress;
    if (countResolvedEl) countResolvedEl.textContent = countResolved;

    const filtered = userConcerns.filter(function (c) {
      const matchFilter = filter === 'All' || c.status === filter;
      const matchSearch = !searchVal ||
        c.ref.toLowerCase().includes(searchVal) ||
        (c.title || '').toLowerCase().includes(searchVal) ||
        c.category.toLowerCase().includes(searchVal) ||
        c.desc.toLowerCase().includes(searchVal) ||
        c.location.toLowerCase().includes(searchVal) ||
        c.urgency.toLowerCase().includes(searchVal) ||
        c.status.toLowerCase().includes(searchVal);
      return matchFilter && matchSearch;
    });

    if (filtered.length === 0) {
      const emptyConcernMsg = userConcerns.length === 0
        ? 'You have not submitted any concerns yet. Click "+ Submit New Concern" above to file a report.'
        : 'No concerns found matching your selected filter.';
      container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 40px; background: #ffffff; border-radius: 12px; border: 1px dashed var(--border);">${emptyConcernMsg}</div>`;
      return;
    }

    let cardsHtml = '';
    filtered.forEach(function (c) {
      const urgencyLevel = normalizeConcernUrgency(c.urgency);
      const isUrgent = urgencyLevel === 'Urgent';
      const statusBadgeClass = getStatusBadgeClass(c.status);
      const stage = c.status === 'Resolved' ? 3 : (c.status === 'In Progress' ? 2 : 1);

      cardsHtml += `
        <div class="concern-item-card">
          <div class="concern-item-header">
            <div class="concern-ref-wrap">
              <span class="concern-ticket-id">${escapeHtml(c.ref)}</span>
              <span class="concern-cat-tag">${escapeHtml(c.category)}</span>
              <span class="status-pill ${isUrgent ? 'status-urgent' : 'status-standard'}">${escapeHtml(urgencyLevel)}</span>
              <span class="status-pill ${statusBadgeClass}">${escapeHtml(c.status)}</span>
              <span class="concern-date">Submitted on ${escapeHtml(c.dateFiled)}</span>
            </div>
            <button type="button" class="btn-table-action" data-view-ref="${escapeHtml(c.ref)}">View Details</button>
          </div>

          <h4 class="concern-title-heading">${escapeHtml(c.title || (c.category + ' Concern'))}</h4>

          <div class="concern-location-row">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${escapeHtml(c.location)}</span>
          </div>

          <p class="concern-desc-text">${escapeHtml(c.desc)}</p>

          <!-- 3-Step Visual Progress Stepper -->
          <div class="concern-progress-stepper">
            <div class="stepper-stage ${stage >= 1 ? (stage === 1 ? 'active' : 'completed') : ''}">
              <div class="stage-bullet">${stage > 1 ? '✓' : '1'}</div>
              <span>Pending</span>
            </div>
            <div class="stepper-line ${stage >= 2 ? 'filled' : ''}"></div>
            <div class="stepper-stage ${stage >= 2 ? (stage === 2 ? 'active' : 'completed') : ''}">
              <div class="stage-bullet">${stage > 2 ? '✓' : '2'}</div>
              <span>In Progress</span>
            </div>
            <div class="stepper-line ${stage >= 3 ? 'filled' : ''}"></div>
            <div class="stepper-stage ${stage >= 3 ? 'completed' : ''}">
              <div class="stage-bullet">${stage === 3 ? '✓' : '3'}</div>
              <span>Resolved</span>
            </div>
          </div>

          ${c.resolutionNote ? `
            <div class="concern-resolution-box">
              <div class="resolution-header">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span>Barangay Admin Status &amp; Action Notes:</span>
              </div>
              <p class="resolution-text">${escapeHtml(c.resolutionNote)}</p>
            </div>
          ` : ''}
        </div>
      `;
    });

    container.innerHTML = cardsHtml;

    container.querySelectorAll('[data-view-ref]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const ref = this.getAttribute('data-view-ref');
        openDetailViewer(ref);
      });
    });
  }

  const concernFilterPills = document.querySelectorAll('#concernsFilterPills .filter-pill-btn');
  concernFilterPills.forEach(function (btn) {
    btn.addEventListener('click', function () {
      concernFilterPills.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderConcernsFeed();
    });
  });

  const concernsSearchInput = document.getElementById('concernsSearchInput');
  if (concernsSearchInput) {
    concernsSearchInput.addEventListener('input', renderConcernsFeed);
  }

  // ==========================================================
  // 11. TAB 4: PROJECT PROPOSALS FEED
  // ==========================================================

  function renderProposalsFeed() {
    const container = document.getElementById('proposalsFeedContainer');
    if (!container) return;

    // Update pill counts
    const countMineEl = document.getElementById('userPropCountMine');
    const countAllEl = document.getElementById('userPropCountAll');
    if (countMineEl) countMineEl.textContent = userProposals.length;
    if (countAllEl) countAllEl.textContent = allProposals.length;

    const cardTitle = document.getElementById('userProposalsCardTitle');
    const displayList = currentProposalView === 'all' ? allProposals : userProposals;

    if (cardTitle) {
      cardTitle.textContent = currentProposalView === 'all' ? 'All Community Proposals' : 'My Submitted Proposals';
    }

    if (displayList.length === 0) {
      if (currentProposalView === 'all') {
        container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 40px; background: #ffffff; border-radius: 12px; border: 1px dashed var(--border);">No community proposals recorded yet.</div>';
      } else {
        container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 40px; background: #ffffff; border-radius: 12px; border: 1px dashed var(--border);">No proposals submitted yet under your resident account. Click "Submit Proposal" above to pitch an initiative, or switch to "All Community Proposals" to browse citizen ideas.</div>';
      }
      return;
    }

    let html = '';
    displayList.forEach(function (p) {
      const budgetDisplay = p.budgetFormatted || ('₱' + Number(p.rawBudget || p.budget).toLocaleString());
      const councilNote = p.councilNote || p.councilNotes;
      const proponentName =
          p.resident_full_name ||
          p.full_legal_name ||
          p.guest_full_name ||
          p.proponent ||
          'Community Resident';

      const proponentTag = currentProposalView === 'all'
          ? `<span style="font-size: 11.5px; font-weight: 600; color: #0d47a1;">By: ${escapeHtml(proponentName)}</span>`
          : '';
      
      html += `

        <div class="proposal-item-card" data-ref="${escapeHtml(p.ref || p.id)}">
          <div class="proposal-item-top">
            <div>
              <h4 class="proposal-title">${escapeHtml(p.title)}</h4>
              <div class="proposal-meta-tags">
                <span class="proposal-id-tag">${escapeHtml(p.ref || p.id)}</span>
                <span class="proposal-cat-tag">${escapeHtml(p.category)}</span>
                <span class="proposal-budget-tag">${escapeHtml(budgetDisplay)}</span>
                ${getProposalStatusBadge(p.status)}
                <span style="font-size: 11.5px; color: #94a3b8;">Submitted ${escapeHtml(p.dateFiled || p.date)}</span>
                ${proponentTag}
              </div>
            </div>
            <button type="button" class="btn-table-action" data-view-ref="${escapeHtml(p.ref || p.id)}">Full Proposal</button>
          </div>

          <div style="font-size: 12.5px; color: #475569; margin-bottom: 8px;">
            <strong>Target Location:</strong> ${escapeHtml(p.location || p.sitio)} ${p.timeline ? `&bull; <strong>Timeline:</strong> ${escapeHtml(p.timeline)}` : ''}
          </div>

          <p class="proposal-rationale">${escapeHtml(p.rationale || p.description)}</p>

          ${councilNote ? `
            <div class="proposal-council-note">
              <div class="council-note-title">Barangay Development Council (BDC) Review Note:</div>
              <p class="council-note-text">${escapeHtml(councilNote)}</p>
            </div>
          ` : ''}
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('[data-view-ref]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const ref = this.getAttribute('data-view-ref');
        openDetailViewer(ref);
      });
    });
  }

  // Filter pills event listeners for User Proposals Tab
  const filterMyProposalsBtn = document.getElementById('filterMyProposals');
  const filterAllProposalsBtn = document.getElementById('filterAllProposals');
  if (filterMyProposalsBtn && filterAllProposalsBtn) {
    filterMyProposalsBtn.addEventListener('click', function () {
      currentProposalView = 'mine';
      filterMyProposalsBtn.classList.add('active');
      filterMyProposalsBtn.style.background = '#0d47a1';
      filterMyProposalsBtn.style.color = '#ffffff';
      filterMyProposalsBtn.style.borderColor = '#0d47a1';
      filterAllProposalsBtn.classList.remove('active');
      filterAllProposalsBtn.style.background = '#ffffff';
      filterAllProposalsBtn.style.color = '#475569';
      filterAllProposalsBtn.style.borderColor = '#cbd5e1';
      renderProposalsFeed();
    });

    filterAllProposalsBtn.addEventListener('click', function () {
      currentProposalView = 'all';
      filterAllProposalsBtn.classList.add('active');
      filterAllProposalsBtn.style.background = '#0d47a1';
      filterAllProposalsBtn.style.color = '#ffffff';
      filterAllProposalsBtn.style.borderColor = '#0d47a1';
      filterMyProposalsBtn.classList.remove('active');
      filterMyProposalsBtn.style.background = '#ffffff';
      filterMyProposalsBtn.style.color = '#475569';
      filterMyProposalsBtn.style.borderColor = '#cbd5e1';
      renderProposalsFeed();
    });
  }

  // ==========================================================
  // 12. MODAL CONTROLS & SUBMISSION HANDLERS
  // ==========================================================

  function openModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (!modal) return;

    // Move keyboard focus outside the modal before hiding it.
    if (modal.contains(document.activeElement)) {
        document.activeElement.blur();
    }

    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

  // File picker labels
  if (modalDocAttachment && modalDocAttachmentName) {
    modalDocAttachment.addEventListener('change', function () {
      if (this.files && this.files.length > 0) {
        modalDocAttachmentName.textContent = 'Attached: ' + this.files[0].name;
      }
    });
  }
  if (modalConcernPhoto && modalConcernPhotoName) {
    modalConcernPhoto.addEventListener('change', function () {
      if (this.files && this.files.length > 0) {
        modalConcernPhotoName.textContent = 'Attached: ' + this.files[0].name;
      }
    });
  }
  if (newIdFile && newIdFileName) {
    newIdFile.addEventListener('change', function () {
      if (this.files && this.files.length > 0) {
        newIdFileName.textContent = 'Selected: ' + this.files[0].name;
      }
    });
  }

  // A. Document Request Modal
  function openDocModalWithPreset(docName) {
    if (modalDocType && docName) {
      modalDocType.value = docName;
    }
    syncUserDisplays();
    openModal(docRequestModal);
  }

  if (btnOpenNewDocModal) {
    btnOpenNewDocModal.addEventListener('click', () => openDocModalWithPreset('Barangay Clearance'));
  }
  if (btnDashNewRequest) {
    btnDashNewRequest.addEventListener('click', () => openDocModalWithPreset('Barangay Clearance'));
  }
  if (scRequestDoc) {
    scRequestDoc.addEventListener('click', () => openDocModalWithPreset('Barangay Clearance'));
  }
  if (closeDocModalBtn) closeDocModalBtn.addEventListener('click', () => closeModal(docRequestModal));
  if (btnCancelDocModal) btnCancelDocModal.addEventListener('click', () => closeModal(docRequestModal));

  if (docApplicationForm) {
    const specificInput = document.getElementById('modalDocPurposeSpecific');
    const specificErr = document.getElementById('modalDocPurposeSpecificError');

    if (specificInput) {
      specificInput.addEventListener('input', function () {
        if (this.value.trim().length >= 3) {
          this.classList.remove('input-error');
          if (specificErr) {
            specificErr.textContent = '';
            specificErr.style.display = 'none';
          }
        }
      });
    }

    docApplicationForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const docType = modalDocType ? modalDocType.value : 'Barangay Clearance';
      const cat = document.getElementById('modalDocPurposeCategory')?.value || 'General';
      const specific = (specificInput?.value || '').trim();

      if (!specific || specific.length < 3) {
        if (specificInput) {
          specificInput.classList.add('input-error');
          specificInput.focus();
        }
        if (specificErr) {
          specificErr.textContent = 'Please enter specific purpose details (at least 3 characters).';
          specificErr.style.display = 'block';
        }
        return;
      }

      const claimMethod = 'Physical Pickup at Barangay Hall';
      // Submit the request to the backend first
      let apiRequest;

      try {
        const response = await fetch('http://localhost:5000/api/resident/requests', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            document_type: docType,
            purpose_category: cat,
            specific_details: specific
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to submit your service request.');
        }

        apiRequest = result.request;
      } catch (error) {
        console.error('Service request submission failed:', error);

        showToast(
          'Submission Failed',
          error.message || 'Please check your connection and try again.'
        );

        return;
      }

      // Use the database-generated request ID instead of a random ID
      const refCode = `SR-${apiRequest.request_id}`;
      const today = new Date().toISOString().split('T')[0];
      const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      // Gather applicant resident information from form / current user
      const applicantName = (document.getElementById('modalDocFullName')?.value || currentUser?.name || currentUser?.fullName || '').trim();
      const applicantContact = (document.getElementById('modalDocMobile')?.value || currentUser?.phone || currentUser?.mobile || '').trim();
      const applicantSitio = (document.getElementById('modalDocSitio')?.value || currentUser?.sitio || 'Sitio Ibaba').trim();
      const applicantAddress = (document.getElementById('modalDocAddress')?.value || currentUser?.address || (applicantSitio + ', Barangay Pallocan West')).trim();
      const applicantEmail = currentUser?.email || '';
      const applicantResidentId = currentUser?.residentId || '';
      const applicantAge = currentUser?.age || '';

      const attachEl = document.getElementById('modalDocAttachment');
      const attachName = attachEl && attachEl.files && attachEl.files[0] ? attachEl.files[0].name : '';
      const applicantIdOnRecord = attachName ? `Attached: ${attachName}` : (currentUser?.idOnRecord || '');

      const newRequest = normalizeUserRequestRecord({
        id: refCode,
        ref: refCode,
        fullName: applicantName,
        resident: applicantName,
        age: applicantAge,
        contact: applicantContact,
        address: applicantAddress,
        sitio: applicantSitio,
        purokSitio: applicantSitio,
        docType: docType,
        documentType: docType,
        purpose: `${cat} (${specific})`,
        dateFiled: today,
        date: todayFormatted,
        claimMethod: claimMethod,
        claimTarget: 'Estimated within 1–2 business days',
        status: apiRequest.request_status || 'In Review',
        idOnRecord: applicantIdOnRecord,
        userEmail: applicantEmail,
        residentId: applicantResidentId,
        attachmentName: attachName,
        notes: 'Application received online. Document being prepared for validation by Barangay Secretary.'
      });

      // Synchronize with master service requests list
      let latestAll = loadAllServiceRequests();
      latestAll = latestAll.filter(r => r.ref !== newRequest.ref && r.id !== newRequest.id);
      latestAll.unshift(newRequest);

      saveData('brgy360_service_requests', latestAll);
      saveData('brgy360_requests', latestAll);
      saveData('brgy360_user_requests', latestAll);
      window.dispatchEvent(new CustomEvent('brgy360_requests_changed', { detail: latestAll }));

      allServiceRequests = latestAll;
      userRequests = allServiceRequests.filter(r => isRequestOwnedByUser(r, currentUser));

      // Add notification
      userNotifications.unshift({
        id: Date.now(),
        title: 'New Document Request Filed',
        desc: `Application for ${docType} has been submitted. Reference: ${refCode}. Forwarded to Barangay Admin Service Request Desk.`,
        time: 'Just now',
        unread: true,
        type: 'blue'
      });
      saveUserNotifications();

      // Refresh UI
      renderDashboardKPIs();
      renderDashboardActivityTable();
      renderRequestsTable();
      renderNotifications();

      closeModal(docRequestModal);
      docApplicationForm.reset();
      const attachLabel = document.getElementById('modalDocAttachmentName');
      if (attachLabel) attachLabel.textContent = 'Attach Valid ID or proof of residence (Click to browse)';

      showToast('Application Submitted!', `Reference: ${refCode}. Forwarded to Barangay Admin Service Request Desk.`);
      switchTab('services');
    });
  }

  // B. Concern Modal
  const concernSuccessBanner = document.getElementById('concernSuccessBanner');
  const concernSuccessTitle = document.getElementById('concernSuccessTitle');
  const concernSuccessDesc = document.getElementById('concernSuccessDesc');
  const closeConcernSuccessBanner = document.getElementById('closeConcernSuccessBanner');

  if (closeConcernSuccessBanner && concernSuccessBanner) {
    closeConcernSuccessBanner.addEventListener('click', function () {
      concernSuccessBanner.style.display = 'none';
    });
  }

  function setConcernModalUrgency(level) {
    const normalized = normalizeConcernUrgency(level);
    const hiddenUrgency = document.getElementById('modalConcernUrgency');
    if (hiddenUrgency) hiddenUrgency.value = normalized;

    document.querySelectorAll('#concernUrgencyCards .urgency-card').forEach(function (card) {
      const cardVal = card.getAttribute('data-urgency-card');
      const radio = card.querySelector('input[type="radio"]');
      const isMatch = cardVal === normalized;
      card.classList.toggle('is-selected', isMatch);
      if (radio) radio.checked = isMatch;
    });
  }

  document.querySelectorAll('#concernUrgencyCards input[name="concernUrgencyRadio"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (this.checked) {
        setConcernModalUrgency(this.value);
      }
    });
  });

  function openConcernModalPrepared() {
    syncUserDisplays();
    const dateInput = document.getElementById('modalConcernDate');
    const sitioSelect = document.getElementById('modalConcernSitio');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (sitioSelect && currentUser?.sitio) sitioSelect.value = normalizeSitioName(currentUser.sitio);
    setConcernModalUrgency('Standard');
    openModal(concernModal);
  }

  if (btnOpenNewConcernModal) {
    btnOpenNewConcernModal.addEventListener('click', openConcernModalPrepared);
  }
  if (btnDashNewConcern) {
    btnDashNewConcern.addEventListener('click', openConcernModalPrepared);
  }
  if (scFileConcern) {
    scFileConcern.addEventListener('click', openConcernModalPrepared);
  }
  if (closeConcernModalBtn) closeConcernModalBtn.addEventListener('click', () => closeModal(concernModal));
  if (btnCancelConcernModal) btnCancelConcernModal.addEventListener('click', () => closeModal(concernModal));

  if (concernReportForm) {
    const concernTitleInput = document.getElementById('modalConcernTitle');
    const concernCategoryInput = document.getElementById('modalConcernCategory');
    const concernDateInput = document.getElementById('modalConcernDate');
    const concernSitioInput = document.getElementById('modalConcernSitio');
    const concernLocationInput = document.getElementById('modalConcernLocation');
    const concernDescInput = document.getElementById('modalConcernDesc');

    const concernTitleErr = document.getElementById('modalConcernTitleError');
    const concernCategoryErr = document.getElementById('modalConcernCategoryError');
    const concernDateErr = document.getElementById('modalConcernDateError');
    const concernSitioErr = document.getElementById('modalConcernSitioError');
    const concernLocationErr = document.getElementById('modalConcernLocationError');
    const concernDescErr = document.getElementById('modalConcernDescError');

    // Real-time clearing
    [
      [concernTitleInput, concernTitleErr, 3],
      [concernLocationInput, concernLocationErr, 3],
      [concernDescInput, concernDescErr, 10]
    ].forEach(item => {
      const el = item[0];
      const err = item[1];
      const min = item[2];
      if (el) {
        el.addEventListener('input', function () {
          if (this.value.trim().length >= min) {
            this.classList.remove('input-error');
            if (err) { err.textContent = ''; err.style.display = 'none'; }
          }
        });
      }
    });

    [
      [concernCategoryInput, concernCategoryErr],
      [concernDateInput, concernDateErr],
      [concernSitioInput, concernSitioErr]
    ].forEach(item => {
      const el = item[0];
      const err = item[1];
      if (el) {
        el.addEventListener('change', function () {
          if (this.value) {
            this.classList.remove('input-error');
            if (err) { err.textContent = ''; err.style.display = 'none'; }
          }
        });
      }
    });

    concernReportForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      let isValid = true;
      let firstInvalid = null;

      function markInvalid(inputEl, errorEl, message) {
        if (inputEl) inputEl.classList.add('input-error');
        if (errorEl) {
          errorEl.textContent = message;
          errorEl.style.display = 'block';
        }
        if (!firstInvalid && inputEl) firstInvalid = inputEl;
        isValid = false;
      }

      function markValid(inputEl, errorEl) {
        if (inputEl) inputEl.classList.remove('input-error');
        if (errorEl) {
          errorEl.textContent = '';
          errorEl.style.display = 'none';
        }
      }

      const title = (concernTitleInput?.value || '').trim();
      const category = normalizeConcernCategory(concernCategoryInput?.value || '');
      const checkedRadio = document.querySelector(
        '#concernUrgencyCards input[name="concernUrgencyRadio"]:checked'
      );
      const urgency = normalizeConcernUrgency(
        checkedRadio?.value ||
        document.getElementById('modalConcernUrgency')?.value ||
        'Standard'
      );

      const dateFiled = concernDateInput?.value || '';
      const sitio = normalizeSitioName(concernSitioInput?.value || '');
      const landmark = (concernLocationInput?.value || '').trim();
      const desc = (concernDescInput?.value || '').trim();

      // Validate the form
      if (!title || title.length < 3) {
        markInvalid(concernTitleInput, concernTitleErr, 'Please enter a concern title (at least 3 characters).');
      } else {
        markValid(concernTitleInput, concernTitleErr);
      }

      if (!concernCategoryInput?.value) {
        markInvalid(concernCategoryInput, concernCategoryErr, 'Please select an incident category.');
      } else {
        markValid(concernCategoryInput, concernCategoryErr);
      }

      if (!dateFiled) {
        markInvalid(concernDateInput, concernDateErr, 'Please select the date of occurrence.');
      } else {
        markValid(concernDateInput, concernDateErr);
      }

      if (!sitio) {
        markInvalid(concernSitioInput, concernSitioErr, 'Please select the Sitio or Purok.');
      } else {
        markValid(concernSitioInput, concernSitioErr);
      }

      if (!landmark || landmark.length < 3) {
        markInvalid(concernLocationInput, concernLocationErr, 'Please enter exact landmark or location (at least 3 characters).');
      } else {
        markValid(concernLocationInput, concernLocationErr);
      }

      if (!desc || desc.length < 10) {
        markInvalid(concernDescInput, concernDescErr, 'Please provide a detailed description (at least 10 characters).');
      } else {
        markValid(concernDescInput, concernDescErr);
      }

      if (!isValid) {
        if (firstInvalid) {
          firstInvalid.focus();
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Get reporter details from the logged-in resident
      const reporterName =
        currentUser.full_legal_name ||
        currentUser.name ||
        currentUser.fullName ||
        'Resident User';

      const reporterContact =
        currentUser.mobile_number ||
        currentUser.mobile ||
        '';

      // Retrieve and manage resident data through the Brgy360 backend API.
      // Resident records are stored and managed in Supabase PostgreSQL.
      try {
          // Get the selected photo
          const photoFile = modalConcernPhoto?.files?.[0] || null;

          // Convert the photo to Base64
          let photoData = null;

          if (photoFile) {
              if (photoFile.size > 1500000) {
                  alert('Please choose a photo smaller than 1.5 MB.');
                  return;
              }

              photoData = await new Promise((resolve, reject) => {
                  const reader = new FileReader();

                  reader.onload = () => resolve(reader.result);
                  reader.onerror = () => reject(
                      new Error('Unable to read the selected photo.')
                  );

                  reader.readAsDataURL(photoFile);
              });
          }

          const response = await fetch('http://localhost:5000/api/concerns', {
              method: 'POST',
              credentials: 'include',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  concern_title: title,
                  category: category,
                  urgency_level: urgency,
                  sitio_area: sitio,
                  exact_location: landmark,
                  detailed_description: desc,
                  reporter_name: reporterName,
                  reporter_contact: reporterContact,
                  photo_name: photoFile ? photoFile.name : null,
                  photo_data: photoData
              })
          });

          const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to submit your concern.');
        }

        // Retrieve and manage resident data through the Brgy360 backend API.
        // Resident records are stored and managed in Supabase PostgreSQL.
        const ticketRef = result.ticket_ref;
        const concernId = result.concern_id;

        const newConcern = normalizeConcernRecord({
          ref: ticketRef,
          id: ticketRef,
          concern_id: concernId,
          title: title,
          category: category,
          urgency: urgency,
          sitio: sitio,
          landmark: landmark,
          location: `${sitio} — ${landmark}`,
          dateFiled: dateFiled,
          status: 'Pending',
          currentStage: 1,
          desc: desc,
          reporter: reporterName,
          userEmail: currentUser.email || '',
          userMobile: reporterContact,
          userAddress: currentUser.address || (sitio + ', Barangay Pallocan West'),
          photoName: photoFile ? photoFile.name : null,
          photoData: photoData,
          resolutionNote: ''
        });

        // Update the local display after the database confirms the save
        let latestAll = loadData('brgy360_concerns', DEFAULT_CONCERNS);
        if (!Array.isArray(latestAll)) latestAll = [];

        latestAll = latestAll.map(normalizeConcernRecord);
        latestAll.unshift(newConcern);
        saveData('brgy360_concerns', latestAll);

        allConcerns = latestAll;
        userConcerns = allConcerns.filter(c =>
          isConcernOwnedByUser(c, currentUser)
        );

        userNotifications.unshift({
          id: Date.now(),
          title: 'Concern Submitted Successfully',
          desc: `Ticket ${ticketRef} ("${title}") has been submitted (${urgency}) and forwarded to the Admin Concern Desk.`,
          time: 'Just now',
          unread: true,
          type: 'amber'
        });
        saveUserNotifications();

        const allFilterBtn = document.querySelector(
          '#concernsFilterPills .filter-pill-btn[data-filter="All"]'
        );

        if (allFilterBtn) {
          document.querySelectorAll('#concernsFilterPills .filter-pill-btn')
            .forEach(b => b.classList.remove('active'));
          allFilterBtn.classList.add('active');
        }

        renderDashboardKPIs();
        renderDashboardActivityTable();
        renderConcernsFeed();
        renderNotifications();

        closeModal(concernModal);
        concernReportForm.reset();
        setConcernModalUrgency('Standard');

        if (modalConcernPhotoName) {
          modalConcernPhotoName.textContent = 'Upload photo of the issue (JPG, PNG)';
        }

        switchTab('reports');

        if (concernSuccessBanner) {
          if (concernSuccessTitle) {
            concernSuccessTitle.textContent =
              `Concern Submitted Successfully — Ticket #${ticketRef}`;
          }

          if (concernSuccessDesc) {
            concernSuccessDesc.textContent =
              `"${title}" (${category} • ${urgency}) has been sent to Barangay Admin for review.`;
          }

          concernSuccessBanner.style.display = 'flex';
        }

        showToast(
          'Concern Submitted Successfully!',
          `Ticket #${ticketRef} (${urgency}) saved successfully.`
        );

      } catch (error) {
        console.error('Concern submission error:', error);

        showToast(
          'Concern Submission Failed',
          error.message || 'Please try again.'
        );
      }
    });
  }

  // C. Proposal Modal
  if (btnOpenNewProposalModal) {
    btnOpenNewProposalModal.addEventListener('click', () => openModal(proposalModal));
  }
  if (scProposeProj) {
    scProposeProj.addEventListener('click', () => openModal(proposalModal));
  }
  if (closeProposalModalBtn) closeProposalModalBtn.addEventListener('click', () => closeModal(proposalModal));
  if (btnCancelPropModal) btnCancelPropModal.addEventListener('click', () => closeModal(proposalModal));

  if (proposalSubmitForm) {
    const propTitleInput = document.getElementById('modalPropTitle');
    const propCatInput = document.getElementById('modalPropCategory');
    const propLocInput = document.getElementById('modalPropLocation');
    const propBudgetInput = document.getElementById('modalPropBudget');
    const propRationaleInput = document.getElementById('modalPropRationale');

    const propTitleErr = document.getElementById('modalPropTitleError');
    const propCatErr = document.getElementById('modalPropCategoryError');
    const propLocErr = document.getElementById('modalPropLocationError');
    const propBudgetErr = document.getElementById('modalPropBudgetError');
    const propRationaleErr = document.getElementById('modalPropRationaleError');

    // Real-time restriction: Budget (Numeric digits only)
    if (propBudgetInput) {
      propBudgetInput.addEventListener('input', function () {
        const original = this.value;
        const sanitized = original.replace(/\D/g, '');
        if (original !== sanitized) {
          this.value = sanitized;
          if (propBudgetErr) {
            propBudgetErr.textContent = 'Estimated budget must contain numeric digits only. Letters and special characters are not allowed.';
            propBudgetErr.style.display = 'block';
          }
          this.classList.add('input-error');
          return;
        }
        if (Number(sanitized) > 0) {
          this.classList.remove('input-error');
          if (propBudgetErr) {
            propBudgetErr.textContent = '';
            propBudgetErr.style.display = 'none';
          }
        }
      });
    }

    // Real-time clearing
    if (propTitleInput) {
      propTitleInput.addEventListener('input', function () {
        if (this.value.trim().length >= 3) {
          this.classList.remove('input-error');
          if (propTitleErr) { propTitleErr.textContent = ''; propTitleErr.style.display = 'none'; }
        }
      });
    }
    if (propRationaleInput) {
      propRationaleInput.addEventListener('input', function () {
        if (this.value.trim().length >= 10) {
          this.classList.remove('input-error');
          if (propRationaleErr) { propRationaleErr.textContent = ''; propRationaleErr.style.display = 'none'; }
        }
      });
    }
    if (propLocInput) {
      propLocInput.addEventListener('change', function () {
        if (this.value) {
          this.classList.remove('input-error');
          if (propLocErr) { propLocErr.textContent = ''; propLocErr.style.display = 'none'; }
        }
      });
    }

    proposalSubmitForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      let isValid = true;
      let firstInvalid = null;

      function markInvalid(inputEl, errorEl, message) {
        if (inputEl) inputEl.classList.add('input-error');
        if (errorEl) {
          errorEl.textContent = message;
          errorEl.style.display = 'block';
        }
        if (!firstInvalid && inputEl) firstInvalid = inputEl;
        isValid = false;
      }

      function markValid(inputEl, errorEl) {
        if (inputEl) inputEl.classList.remove('input-error');
        if (errorEl) {
          errorEl.textContent = '';
          errorEl.style.display = 'none';
        }
      }

      const title = (propTitleInput?.value || '').trim();
      const category = propCatInput?.value || '';
      const location = propLocInput?.value || '';
      const rawBudget = (propBudgetInput?.value || '').trim();
      const budget = parseFloat(rawBudget || 0);
      const timeline = (document.getElementById('modalPropTimeline')?.value || '').trim();
      const rationale = (propRationaleInput?.value || '').trim();

      if (!title || title.length < 3) {
        markInvalid(propTitleInput, propTitleErr, 'Please enter a project title (at least 3 characters).');
      } else {
        markValid(propTitleInput, propTitleErr);
      }

      if (!category) {
        markInvalid(propCatInput, propCatErr, 'Please select a sector category.');
      } else {
        markValid(propCatInput, propCatErr);
      }

      if (!location) {
        markInvalid(propLocInput, propLocErr, 'Please select a target location or sitio.');
      } else {
        markValid(propLocInput, propLocErr);
      }

      if (!rawBudget || !/^\d+$/.test(rawBudget) || budget <= 0) {
        markInvalid(propBudgetInput, propBudgetErr, 'Estimated budget must contain numeric digits only and be greater than ₱0.');
      } else {
        markValid(propBudgetInput, propBudgetErr);
      }

      if (!rationale || rationale.length < 10) {
        markInvalid(propRationaleInput, propRationaleErr, 'Please explain the rationale and community impact (at least 10 characters).');
      } else {
        markValid(propRationaleInput, propRationaleErr);
      }

      if (!isValid) {
        if (firstInvalid) {
          firstInvalid.focus();
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      
      const submitButton = document.getElementById('btnSubmitProposal');

      try {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Submitting...';
        }

        // Submit proposal to the backend.
                const formData = new FormData();

        formData.append('projectTitle', title);
        formData.append('sectorCategory', category);
        formData.append('locationSitio', location);
        formData.append('estimatedBudget', String(budget));
        formData.append(
          'proposedTimeline',
          timeline || 'Q1 2027 (3 months implementation)'
        );
        formData.append('rationale', rationale);
        formData.append('submissionType', 'resident');

        const response = await fetch('http://localhost:5000/api/proposals', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to submit your proposal.');
        }

        // Use the actual tracking code generated by the backend.
        const propRef = result.trackingCode;

        const today = new Date().toISOString().split('T')[0];
        const todayFormatted = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric'
        });

        // Keep the existing local dashboard synchronization
        // while the database becomes the confirmed submission source.
        const newProposal = normalizeUserProposalRecord({
          id: propRef,
          ref: propRef,
          proposalId: result.proposalId,
          title: title,
          category: category,
          location: location,
          sitio: location,
          budget: budget,
          rawBudget: budget,
          timeline: timeline || 'Q1 2027 (3 months implementation)',
          dateFiled: today,
          date: todayFormatted,
          year: String(new Date().getFullYear()),
          status: 'Pending',
          rationale: rationale,
          description: rationale,
          proponent: currentUser?.full_legal_name || currentUser?.name || 'Resident',
          email: currentUser?.email || '',
          userEmail: currentUser?.email || '',
          councilNote: 'Received by Barangay Development Council Secretariat. Queued for technical review.',
          councilNotes: 'Received by Barangay Development Council Secretariat. Queued for technical review.'
        });

        let latestAll = loadAndSyncAllProposals();
        latestAll.unshift(newProposal);
        saveData('brgy360_proposals', latestAll);

        allProposals = latestAll;
        userProposals = allProposals.filter(p => isUserProposal(p, currentUser));

        // Notify other tabs / admin console.
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('brgy360_proposals_changed', {
          detail: latestAll
        }));

        userNotifications.unshift({
          id: Date.now(),
          title: 'Project Proposal Received',
          desc: `Proposal "${title}" (${propRef}) submitted to the Development Council.`,
          time: 'Just now',
          unread: true,
          type: 'green'
        });

        saveUserNotifications();

        renderDashboardKPIs();
        renderDashboardActivityTable();
        renderProposalsFeed();
        renderNotifications();

        closeModal(proposalModal);
        proposalSubmitForm.reset();

        showToast(
          'Proposal Submitted!',
          `Reference ID: ${propRef}. Your proposal was successfully saved.`
        );

        switchTab('proposals');

      } catch (error) {
        console.error('Resident proposal submission error:', error);
        alert(error.message || 'Unable to submit your proposal. Please try again.');

      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Submit Proposal';
        }
      }
    });
  }

  // D. Detail Viewer Modal
  function openDetailViewer(refCode) {
    if (!detailViewerModal || !detailModalBody) return;

    let item = userRequests.find(r => r.ref === refCode);
    let itemType = 'request';

    if (!item) {
      item = userConcerns.find(c => c.ref === refCode);
      itemType = 'concern';
    }
    if (!item) {
      item = userProposals.find(p => p.ref === refCode || p.id === refCode) || allProposals.find(p => p.ref === refCode || p.id === refCode);
      itemType = 'proposal';
    }

    if (!item) return;

    if (itemType === 'request') {
      const isPickup = item.status === 'Ready for Pickup';
      if (detailModalKicker) detailModalKicker.textContent = 'SERVICE APPLICATION SLIP';
      if (detailModalTitle) detailModalTitle.textContent = item.docType;

      detailModalBody.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Official Reference Code</span>
            <span class="table-ref-code" style="font-size: 14px;">${item.ref}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12.5px; color: #475569;">Application Status:</span>
            <span class="status-pill ${getStatusBadgeClass(item.status)}">${item.status}</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; margin-bottom: 18px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
            <span style="color: #64748b;">Applicant Name:</span>
            ${`<div><strong style="color: #64748b;"></strong> ${escapeHtml(item.full_legal_name || 'Unknown Resident')} </div>`}
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
            <span style="color: #64748b;">Purpose of Application:</span>
            <span>${item.purpose}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
            <span style="color: #64748b;">Date Submitted:</span>
            <span>${item.dateFiled}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
            <span style="color: #64748b;">Claiming Mode:</span>
            <span>${item.claimMethod}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Target Release:</span>
            <strong>${item.claimTarget || '1-2 Working Days'}</strong>
          </div>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; font-size: 12.5px; color: #14532d;">
          <strong>Official Processing Note:</strong>
          <p style="margin: 4px 0 0 0; line-height: 1.45;">${item.notes || 'Document verified and logged in the Barangay Database.'}</p>
        </div>

        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
          ${!isPickup && item.status !== 'Completed' && item.status !== 'Cancelled' ? `
            <button type="button" class="btn-table-action btn-table-cancel" id="btnModalCancelReq" data-modal-cancel="${item.ref}">Cancel Request</button>
          ` : ''}
          ${isPickup ? `
            <button type="button" class="btn-table-action btn-table-cancel disabled" id="btnModalCancelReq" data-modal-cancel="${item.ref}" title="Cannot be cancelled: document is already ready for pickup at Barangay Hall">Cancel (Locked for Pickup)</button>
          ` : ''}
          ${item.status === 'Completed' ? `
            <button type="button" class="btn-table-action btn-table-delete" id="btnModalDeleteReq" data-modal-delete="${item.ref}">Delete Record</button>
          ` : `
            <button type="button" class="btn-table-action btn-table-delete disabled" id="btnModalDeleteReq" data-modal-delete="${item.ref}" title="Can only be deleted once Completed">Delete (Completed Only)</button>
          `}
        </div>
      `;

      setTimeout(() => {
        const modalCancelBtn = document.getElementById('btnModalCancelReq');
        if (modalCancelBtn) {
          modalCancelBtn.addEventListener('click', function () {
            const refToCancel = this.getAttribute('data-modal-cancel');
            closeModal(detailViewerModal);
            handleCancelRequest(refToCancel);
          });
        }
        const modalDeleteBtn = document.getElementById('btnModalDeleteReq');
        if (modalDeleteBtn) {
          modalDeleteBtn.addEventListener('click', function () {
            const refToDelete = this.getAttribute('data-modal-delete');
            closeModal(detailViewerModal);
            handleDeleteRequest(refToDelete);
          });
        }
      }, 0);
    } else if (itemType === 'concern') {
      const urgencyLevel = normalizeConcernUrgency(item.urgency);
      if (detailModalKicker) detailModalKicker.textContent = 'CITIZEN CONCERN RECORD';
      if (detailModalTitle) detailModalTitle.textContent = item.title || (item.category + ' Concern');

      detailModalBody.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Ticket Number</span>
            <span class="table-ref-code" style="font-size: 14px;">${escapeHtml(item.ref)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12.5px; color: #475569;">Current Status:</span>
            <span class="status-pill ${getStatusBadgeClass(item.status)}">${escapeHtml(item.status)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12.5px; color: #475569;">Urgency Level:</span>
            <span class="status-pill ${urgencyLevel === 'Urgent' ? 'status-urgent' : 'status-standard'}">${escapeHtml(urgencyLevel)}</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; margin-bottom: 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; gap: 12px;">
            <span style="color: #64748b;">Category:</span>
            <strong>${escapeHtml(item.category)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 12px;">
            <span style="color: #64748b;">Date Submitted:</span>
            <span>${escapeHtml(item.dateFiled)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 12px;">
            <span style="color: #64748b;">Submitted By:</span>
            <strong>${escapeHtml(item.reporter || currentUser.name)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 12px;">
            <span style="color: #64748b;">Location / Sitio:</span>
            <span>${escapeHtml(item.location)}</span>
          </div>
        </div>

        <div style="font-size: 13px; margin-bottom: 16px;">
          <strong style="color: #0f172a; display: block; margin-bottom: 6px;">Detailed Description:</strong>
          <p style="color: #475569; margin: 0; line-height: 1.55; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px;">${escapeHtml(item.desc)}</p>
        </div>

        ${item.photoData ? `
          <div style="margin-bottom: 16px;">
            <strong style="font-size: 12.5px; color: #0f172a; display: block; margin-bottom: 6px;">Attached Photo Evidence:</strong>
            <img src="${item.photoData}" alt="Attached concern photo" style="max-width: 100%; max-height: 220px; border-radius: 8px; border: 1px solid var(--border); object-fit: cover;">
          </div>
        ` : (item.photoName ? `
          <div style="font-size: 12px; color: #64748b; margin-bottom: 16px;">
            <strong>Attached File:</strong> ${escapeHtml(item.photoName)}
          </div>
        ` : '')}

        ${item.resolutionNote ? `
          <div class="concern-resolution-box">
            <div class="resolution-header">Barangay Admin Response &amp; Action Notes:</div>
            <p class="resolution-text">${escapeHtml(item.resolutionNote)}</p>
          </div>
        ` : `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 12.5px; color: #92400e;">
            <strong>Status Note:</strong> Your concern is currently marked <strong>${escapeHtml(item.status)}</strong>. Updates from Barangay Admin will appear here automatically.
          </div>
        `}
      `;
    } else {
      if (detailModalKicker) detailModalKicker.textContent = 'DEVELOPMENT PROPOSAL';
      if (detailModalTitle) detailModalTitle.textContent = item.title;

      const budgetDisplay = item.budgetFormatted || ('₱' + Number(item.rawBudget || item.budget).toLocaleString());
      const councilNote = item.councilNote || item.councilNotes;

      detailModalBody.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Proposal ID</span>
            <span class="table-ref-code" style="font-size: 14px;">${escapeHtml(item.ref || item.id)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12.5px; color: #475569;">Council Status:</span>
            ${getProposalStatusBadge(item.status)}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; margin-bottom: 16px;">
          <div><strong style="color: #64748b;">Sector:</strong> ${escapeHtml(item.category)}</div>
          <div><strong style="color: #64748b;">Target Location:</strong> ${escapeHtml(item.location || item.sitio)}</div>
          <div><strong style="color: #64748b;">Estimated Budget:</strong> ${escapeHtml(budgetDisplay)}</div>
          <div><strong style="color: #64748b;">Proposed Timeline:</strong> ${escapeHtml(item.timeline || 'Not specified')}</div>
          <div><strong style="color: #64748b;">Submitted by:</strong> ${escapeHtml(item.resident_full_name || item.full_legal_name || item.guest_full_name || item.proponent || currentUser?.full_legal_name || currentUser?.name || 'Community Resident')} · ${escapeHtml(item.dateFiled || item.date)}
</div>
        </div>

        <div style="font-size: 13px; margin-bottom: 16px;">
          <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Rationale & Community Impact:</strong>
          <p style="color: #475569; margin: 0; line-height: 1.55;">${escapeHtml(item.rationale || item.description)}</p>
        </div>

        ${councilNote ? `
          <div class="proposal-council-note">
            <div class="council-note-title">Barangay Development Council Evaluation:</div>
            <p class="council-note-text">${escapeHtml(councilNote)}</p>
          </div>
        ` : ''}
      `;
    }

    openModal(detailViewerModal);
  }

  if (closeDetailModalBtn) closeDetailModalBtn.addEventListener('click', () => closeModal(detailViewerModal));

  // Action Confirmation Modal event handlers
  if (closeConfirmModalBtn) closeConfirmModalBtn.addEventListener('click', () => closeModal(actionConfirmModal));
  if (btnCancelConfirmModal) btnCancelConfirmModal.addEventListener('click', () => closeModal(actionConfirmModal));
  if (btnExecuteConfirmAction) {
    btnExecuteConfirmAction.addEventListener('click', function () {
      if (typeof pendingActionCallback === 'function') {
        const cb = pendingActionCallback;
        pendingActionCallback = null;
        closeModal(actionConfirmModal);
        cb();
      } else {
        closeModal(actionConfirmModal);
      }
    });
  }

  // Close modals on clicking overlay backdrop
  [docRequestModal, concernModal, proposalModal, detailViewerModal, actionConfirmModal].forEach(function (modal) {
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          closeModal(modal);
        }
      });
    }
  });

  // ESC key closes modals
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal(docRequestModal);
      closeModal(concernModal);
      closeModal(proposalModal);
      closeModal(detailViewerModal);
      closeModal(actionConfirmModal);
      if (notifDropdown) notifDropdown.classList.remove('active');
      if (profileDropdown) profileDropdown.classList.remove('active');
    }
  });

  // ==========================================================
  // 13. ACCOUNT TAB: FORMS HANDLING
  // ==========================================================

  // A. Contact info form
  if (updateProfileForm) {
    const profileMobileInput = document.getElementById('profileMobile');
    const profileEmailInput = document.getElementById('profileEmail');
    const profileAgeInput = document.getElementById('profileAge');
    const profileAddressInput = document.getElementById('profileAddress');
    const profileSitioInput = document.getElementById('profileSitio');

    const profileMobileErr = document.getElementById('profileMobileError');
    const profileEmailErr = document.getElementById('profileEmailError');
    const profileAgeErr = document.getElementById('profileAgeError');
    const profileAddressErr = document.getElementById('profileAddressError');
    const profileSitioErr = document.getElementById('profileSitioError');

    // Populate initial age if present in currentUser
    if (profileAgeInput && currentUser) {
      if (currentUser.age) {
        profileAgeInput.value = currentUser.age;
      } else if (currentUser.dob) {
        const birth = new Date(currentUser.dob);
        const now = new Date();
        let a = now.getFullYear() - birth.getFullYear();
        profileAgeInput.value = (a > 0 && a < 120) ? a : '28';
      }
    }

    // Real-time restriction: Contact Number (Numeric digits only)
    if (profileMobileInput) {
    profileMobileInput.addEventListener('input', function () {
        const mobileDigits = this.value.replace(/\D/g, '');

        if (mobileDigits.length > 11) {
            this.value = mobileDigits.slice(0, 11);
        }

        if (profileMobileErr) {
            profileMobileErr.textContent = '';
            profileMobileErr.style.display = 'none';
        }

        this.classList.remove('input-error');
    });
}

    // Real-time restriction: Age (Numeric digits only)
    if (profileAgeInput) {
      profileAgeInput.addEventListener('input', function () {
        const original = this.value;
        const sanitized = original.replace(/\D/g, '');
        if (original !== sanitized) {
          this.value = sanitized;
          if (profileAgeErr) {
            profileAgeErr.textContent = 'Age must contain numeric digits only. Letters and special characters are not allowed.';
            profileAgeErr.style.display = 'block';
          }
          this.classList.add('input-error');
          return;
        }
        const num = parseInt(sanitized, 10);
        if (!isNaN(num) && num >= 1 && num <= 120) {
          this.classList.remove('input-error');
          if (profileAgeErr) {
            profileAgeErr.textContent = '';
            profileAgeErr.style.display = 'none';
          }
        }
      });
    }

    // Real-time validation: Email Address
    if (profileEmailInput) {
      profileEmailInput.addEventListener('input', function () {
        const val = this.value.trim();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (emailRegex.test(val)) {
          this.classList.remove('input-error');
          if (profileEmailErr) {
            profileEmailErr.textContent = '';
            profileEmailErr.style.display = 'none';
          }
        }
      });
    }

    // Real-time clear on address & sitio
    if (profileAddressInput) {
      profileAddressInput.addEventListener('input', function () {
        if (this.value.trim().length >= 5) {
          this.classList.remove('input-error');
          if (profileAddressErr) {
            profileAddressErr.textContent = '';
            profileAddressErr.style.display = 'none';
          }
        }
      });
    }
    if (profileSitioInput) {
      profileSitioInput.addEventListener('change', function () {
        if (this.value) {
          this.classList.remove('input-error');
          if (profileSitioErr) {
            profileSitioErr.textContent = '';
            profileSitioErr.style.display = 'none';
          }
        }
      });
    }

    updateProfileForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      let isValid = true;
      let firstInvalidInput = null;

      function markProfileInvalid(inputEl, errorEl, message) {
        if (inputEl) inputEl.classList.add('input-error');
        if (errorEl) {
          errorEl.textContent = message;
          errorEl.style.display = 'block';
        }
        if (!firstInvalidInput && inputEl) {
          firstInvalidInput = inputEl;
        }
        isValid = false;
      }

      function clearProfileValid(inputEl, errorEl) {
        if (inputEl) inputEl.classList.remove('input-error');
        if (errorEl) {
          errorEl.textContent = '';
          errorEl.style.display = 'none';
        }
      }

      // 1. Mobile Number: numeric digits only, 7-11 digits
      const mobileVal = profileMobileInput ? profileMobileInput.value.trim() : '';
      const mobileDigits = mobileVal.replace(/\D/g, '');

      if (!mobileVal) {
          markProfileInvalid(profileMobileInput, profileMobileErr, 'Contact number is required.');
      } else if (!/^[0-9\s]+$/.test(mobileVal)) {
          markProfileInvalid(profileMobileInput, profileMobileErr, 'Contact number must contain numeric digits only.');
      } else if (mobileDigits.length !== 11 || !mobileDigits.startsWith('09')) {
          markProfileInvalid(profileMobileInput, profileMobileErr, 'Enter a valid 11-digit Philippine mobile number (e.g. 0917 123 4567).');
      } else {
          clearProfileValid(profileMobileInput, profileMobileErr);
      }

      // 2. Email Address: valid format
      const emailVal = profileEmailInput ? profileEmailInput.value.trim() : '';
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailVal) {
        markProfileInvalid(profileEmailInput, profileEmailErr, 'Email address is required.');
      } else if (!emailRegex.test(emailVal)) {
        markProfileInvalid(profileEmailInput, profileEmailErr, 'Please enter a valid email address (e.g. resident@example.com).');
      } else {
        clearProfileValid(profileEmailInput, profileEmailErr);
      }

      // 3. Age: numeric digits only, 1-120
      const ageVal = profileAgeInput ? profileAgeInput.value.trim() : '';
      if (!ageVal) {
        markProfileInvalid(profileAgeInput, profileAgeErr, 'Age is required.');
      } else if (!/^\d+$/.test(ageVal)) {
        markProfileInvalid(profileAgeInput, profileAgeErr, 'Age must contain numeric digits only. Letters and special characters are not allowed.');
      } else {
        const aNum = parseInt(ageVal, 10);
        if (isNaN(aNum) || aNum < 1 || aNum > 120) {
          markProfileInvalid(profileAgeInput, profileAgeErr, 'Please enter a valid age between 1 and 120.');
        } else {
          clearProfileValid(profileAgeInput, profileAgeErr);
        }
      }

      // 4. Address: min 5 chars
      const addressVal = profileAddressInput ? profileAddressInput.value.trim() : '';
      if (!addressVal) {
        markProfileInvalid(profileAddressInput, profileAddressErr, 'Residential address is required.');
      } else if (addressVal.length < 5) {
        markProfileInvalid(profileAddressInput, profileAddressErr, 'Address must be at least 5 characters long.');
      } else {
        clearProfileValid(profileAddressInput, profileAddressErr);
      }

      // 5. Sitio / Purok
      const sitioVal = profileSitioInput ? profileSitioInput.value : '';
      if (!sitioVal) {
        markProfileInvalid(profileSitioInput, profileSitioErr, 'Please select your Sitio or Purok.');
      } else {
        clearProfileValid(profileSitioInput, profileSitioErr);
      }

      if (!isValid) {
        if (firstInvalidInput) {
          firstInvalidInput.focus();
          firstInvalidInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Save profile changes to the backend
      const saveProfileBtn = document.getElementById('btnSaveProfile');
      const originalBtnText = saveProfileBtn
          ? saveProfileBtn.innerHTML
          : '';

      try {
          if (saveProfileBtn) {
              saveProfileBtn.disabled = true;

              const saveText = saveProfileBtn.querySelector('span');
              if (saveText) {
                  saveText.textContent = 'Saving...';
              }
          }

          const response = await fetch('http://localhost:5000/api/residents/profile', {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({
                  mobile_number: mobileVal,
                  email: emailVal,
                  age: parseInt(ageVal, 10),
                  address: addressVal,
                  sitio_purok: sitioVal
              })
          });

          const responseText = await response.text();
          console.log('Profile API response:', response.status, responseText);

          let result = {};

          try {
              result = responseText ? JSON.parse(responseText) : {};
          } catch (parseError) {
              throw new Error(
                  `Backend returned invalid JSON (HTTP ${response.status}): ${responseText || 'Empty response'}`
              );
          }

          if (!response.ok || !result.success) {
              throw new Error(result.message || `Profile update failed (HTTP ${response.status}).`);
          }

          currentUser.mobile = mobileVal;
          currentUser.email = emailVal;
          currentUser.age = parseInt(ageVal, 10);
          currentUser.address = addressVal;
          currentUser.sitio = sitioVal;

          saveData('brgy360_user', currentUser);
          syncUserDisplays();

          showToast(
              'Profile Updated',
              'Your contact information has been saved successfully.'
          );

      } catch (error) {
          console.error('Profile update error:', error);

          showToast(
              'Update Failed',
              error.message || 'Unable to save your profile changes.',
              true
          );

      } finally {
          if (saveProfileBtn) {
              saveProfileBtn.disabled = false;
              saveProfileBtn.innerHTML = originalBtnText;
          }
          }
      });
  }

  // B. Change Password Form
  if (changePasswordForm) {
    const curInput = document.getElementById('currentPassword');
    const newPwdInput = document.getElementById('newPassword');
    const confirmPwdInput = document.getElementById('confirmNewPassword');
    const curErr = document.getElementById('currentPasswordError');
    const newPwdErr = document.getElementById('newPasswordError');
    const confirmPwdErr = document.getElementById('confirmNewPasswordError');
    const bannerErr = document.getElementById('passwordErrorMsg');

    function getActiveUserPassword() {
      // 1. In-memory currentUser password
      if (currentUser && currentUser.password) {
        return currentUser.password;
      }

      // 2. Stored user object in localStorage 'brgy360_user'
      try {
        const stored = JSON.parse(localStorage.getItem('brgy360_user') || '{}');
        if (stored && stored.password) {
          return stored.password;
        }
      } catch (e) {}

      // 3. User account created in registration database ('brgy360_residents_db')
      try {
        const email = (currentUser?.email || '').trim().toLowerCase();
        const residentsDb = JSON.parse(localStorage.getItem('brgy360_residents_db') || '[]');
        if (email && Array.isArray(residentsDb)) {
          const found = residentsDb.find(u => u.email && u.email.trim().toLowerCase() === email);
          if (found && found.password) {
            return found.password;
          }
        }
      } catch (e) {}

      // 4. Session info check against resident database
      try {
        const session = JSON.parse(localStorage.getItem('brgy360_session') || '{}');
        const sessionEmail = (session?.email || '').trim().toLowerCase();
        if (sessionEmail) {
          const residentsDb = JSON.parse(localStorage.getItem('brgy360_residents_db') || '[]');
          const found = residentsDb.find(u => u.email && u.email.trim().toLowerCase() === sessionEmail);
          if (found && found.password) {
            return found.password;
          }
        }
      } catch (e) {}

      return DEFAULT_USER.password || '';
    }

    function setFieldError(inputEl, errorEl, message) {
      if (inputEl) inputEl.classList.add('input-error');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      }
    }

    function clearFieldError(inputEl, errorEl) {
      if (inputEl) inputEl.classList.remove('input-error');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
      }
    }

    function clearAllPasswordErrors() {
      clearFieldError(curInput, curErr);
      clearFieldError(newPwdInput, newPwdErr);
      clearFieldError(confirmPwdInput, confirmPwdErr);
      if (bannerErr) {
        bannerErr.textContent = '';
        bannerErr.style.display = 'none';
      }
    }

    // Dynamic error clearing as user types
    if (curInput) {
      curInput.addEventListener('input', function () {
        if (curInput.value.trim()) {
          clearFieldError(curInput, curErr);
          if (bannerErr) {
            bannerErr.textContent = '';
            bannerErr.style.display = 'none';
          }
        }
      });
    }

    if (newPwdInput) {
      newPwdInput.addEventListener('input', function () {
        const val = newPwdInput.value;
        if (val.length >= 8 && /[a-zA-Z]/.test(val) && /[0-9]/.test(val)) {
          clearFieldError(newPwdInput, newPwdErr);
        }
        if (confirmPwdInput && confirmPwdInput.value && confirmPwdInput.value === val) {
          clearFieldError(confirmPwdInput, confirmPwdErr);
        }
      });
    }

    if (confirmPwdInput) {
      confirmPwdInput.addEventListener('input', function () {
        if (confirmPwdInput.value && confirmPwdInput.value === (newPwdInput ? newPwdInput.value : '')) {
          clearFieldError(confirmPwdInput, confirmPwdErr);
        }
      });
    }

    changePasswordForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearAllPasswordErrors();

      const cur = (curInput?.value || '').trim();
      const p1 = newPwdInput?.value || '';
      const p2 = confirmPwdInput?.value || '';

      let hasError = false;
      let firstInvalidInput = null;

      // 1. Verify that Current Password is entered and EXACTLY MATCHES the password set during creation/registration
      const expectedPassword = getActiveUserPassword();
      if (!cur) {
        setFieldError(curInput, curErr, 'Please enter your current password.');
        hasError = true;
        if (!firstInvalidInput) firstInvalidInput = curInput;
      } else if (cur !== expectedPassword) {
        setFieldError(curInput, curErr, 'The current password entered is incorrect. It must match the password set when your account was created.');
        if (bannerErr) {
          bannerErr.textContent = 'Current password verification failed. Please enter the password you created your account with.';
          bannerErr.style.display = 'block';
        }
        hasError = true;
        if (!firstInvalidInput) firstInvalidInput = curInput;
      }

      // 2. Verify that New Password meets security requirements
      if (!p1) {
        setFieldError(newPwdInput, newPwdErr, 'Please enter a new password.');
        hasError = true;
        if (!firstInvalidInput) firstInvalidInput = newPwdInput;
      } else if (p1.length < 8) {
        setFieldError(newPwdInput, newPwdErr, 'New password must be at least 8 characters long.');
        hasError = true;
        if (!firstInvalidInput) firstInvalidInput = newPwdInput;
      } else if (!/[a-zA-Z]/.test(p1) || !/[0-9]/.test(p1)) {
        setFieldError(newPwdInput, newPwdErr, 'New password must contain both letters and numbers.');
        hasError = true;
        if (!firstInvalidInput) firstInvalidInput = newPwdInput;
      } else if (p1 === cur) {
        setFieldError(newPwdInput, newPwdErr, 'New password cannot be the same as your current password.');
        hasError = true;
        if (!firstInvalidInput) firstInvalidInput = newPwdInput;
      }

      // 3. Verify that Confirm New Password matches
      if (!p2) {
        setFieldError(confirmPwdInput, confirmPwdErr, 'Please confirm your new password.');
        hasError = true;
        if (!firstInvalidInput) firstInvalidInput = confirmPwdInput;
      } else if (p1 !== p2) {
        setFieldError(confirmPwdInput, confirmPwdErr, 'Passwords do not match. Please re-enter.');
        hasError = true;
        if (!firstInvalidInput) firstInvalidInput = confirmPwdInput;
      }

      if (hasError) {
        if (firstInvalidInput) firstInvalidInput.focus();
        return;
      }

// 4. Update password through the backend API
try {
    const response = await fetch('http://localhost:5000/api/residents/change-password', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            currentPassword: cur,
            newPassword: p1
        })
    });

    const responseText = await response.text();

    console.log('Change password HTTP status:', response.status);
    console.log('Change password response body:', responseText);

    let result;

    try {
        result = JSON.parse(responseText);
    } catch (error) {
        console.error('Backend did not return valid JSON:', responseText);

        if (bannerErr) {
            bannerErr.textContent =
                'The server returned an unexpected response. Please check the backend.';
            bannerErr.style.display = 'block';
        }

        return;
    }

    // Password updated successfully
    changePasswordForm.reset();
    clearAllPasswordErrors();

    // Reset password visibility toggles
    changePasswordForm.querySelectorAll('.password-toggle-btn').forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const input = targetId
            ? document.getElementById(targetId)
            : null;

        if (input && input.type === 'text') {
            input.type = 'password';

            const showIcon = btn.querySelector('.eye-show');
            const hideIcon = btn.querySelector('.eye-hide');

            if (showIcon) showIcon.style.display = 'block';
            if (hideIcon) hideIcon.style.display = 'none';

            btn.setAttribute('aria-label', 'Show password');
            btn.setAttribute('title', 'Show password');
        }
    });

    showToast(
        'Password Updated',
        'Your account credentials have been changed successfully.'
    );

} catch (error) {
    console.error('Change password request error:', error);

    if (bannerErr) {
        bannerErr.textContent =
            'Unable to connect to the server. Please try again.';
        bannerErr.style.display = 'block';
    }
}
 });
  }

  // C. ID Re-Verification Form
  if (idUploadForm) {
    idUploadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const idType = document.getElementById('newIdType')?.value || 'Cedula';
      const fileInput = document.getElementById('newIdFile');

      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('Document Required', 'Please select a photo or scan of your document.', true);
        return;
      }

      idUploadForm.reset();
      if (newIdFileName) newIdFileName.textContent = 'Click to select photo or scan (PNG, JPG, PDF)';

      showToast('ID Uploaded for Verification', `Your ${idType} has been submitted for secretary validation.`);
    });
  }

  // ==========================================================
  // 14. LOGOUT SESSION MANAGEMENT
  // ==========================================================

  function handleLogout() {
    localStorage.removeItem('brgy360_session');
    localStorage.removeItem('currentUserRole');
    showToast('Signed Out', 'Redirecting to public portal...');
    setTimeout(function () {
      window.location.href = 'index.html';
    }, 600);
  }

  if (topbarLogoutBtn) topbarLogoutBtn.addEventListener('click', handleLogout);
  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleLogout);

  // ==========================================================
  // 15. INITIAL RENDER CALLS
  // ==========================================================

  // Listen for live Admin updates in another browser tab or same window
  function handleProposalSync() {
    refreshUserProposalsState();
    renderDashboardKPIs();
    renderDashboardActivityTable();
    renderProposalsFeed();
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'brgy360_service_requests' || e.key === 'brgy360_requests') {
      refreshUserRequestsState();
      renderDashboardKPIs();
      renderDashboardActivityTable();
      renderRequestsTable();
    } else if (e.key === 'brgy360_concerns') {
      refreshUserConcernsState().then(() => {
        renderDashboardKPIs();
        renderDashboardActivityTable();
        renderConcernsFeed();
      });
    } else if (e.key === 'brgy360_proposals' || !e.key) {
      handleProposalSync();
    } else if (e.key === getNotifsStorageKey() || e.key === 'brgy360_notifs') {
      userNotifications = loadUserNotifications();
      renderNotifications();
    }
  });

  window.addEventListener('brgy360_proposals_changed', handleProposalSync);

  loadResidentProfile();
  updateDateBanner();
  renderNotifications();
  renderDashboardKPIs();
  renderDashboardActivityTable();
  renderServicesCatalog();
  loadMyServiceRequestsFromAPI();
  loadMyProposalsFromAPI();

  refreshUserConcernsState().then(() => {
    renderDashboardKPIs();
    renderDashboardActivityTable();
    renderConcernsFeed();
  });

  handleInitialHash();

  
});