import './admin.css';
import {
  DEFAULT_DEPARTMENT_BY_CATEGORY,
  getLocalTodayISO,
  htmlToPlainText,
  plainTextToHtml,
  deriveSummaryFromText,
  normalizeAnnouncement,
  loadAnnouncements,
  saveAnnouncements,
  generateNextAnnouncementId,
  subscribeAnnouncements
} from './announcements-store.js';
import {
  fetchBudgetRecords,
  subscribeBudgetRecords,
  BUDGET_CATEGORIES,
  BUDGET_QUARTERS,
  BUDGET_CATEGORY_COLORS,
  formatCurrencyPHP,
  formatPercentValue,
  isApplicableBudgetRecord,
  computeBudgetMetrics,
  normalizeBudgetRecord,
  getAvailableFiscalYears,
  getActiveCategoriesForYear,
  generateNextBudgetId,
  distributeTargetAmountAcrossRecords
} from './budget-store.js';
import {
  loadOfficials,
  loadOfficialsFromAPI,
  updateOfficial,
  resetOfficialsToDefault,
  subscribeOfficials,
  escapeOfficialHtml
} from './officials-store.js';

/**
 * Brgy360 - Admin Analytics & Governance Console
 * Barangay Pallocan West, Batangas City
 * Full-Spectrum Descriptive, Predictive, and Prescriptive Analytics Logic
 */

document.addEventListener('DOMContentLoaded', async function () {
  'use strict';

    // ==============================================================
    // 0. AUTHENTICATION & ROUTE PROTECTION
    // ==============================================================
    const ADMIN_API_BASE = 'http://localhost:5000/api';

    // Verify the active backend session before showing the Admin Console.
    try {
      const authResponse = await fetch(`${ADMIN_API_BASE}/auth/me`, {
        method: 'GET',
        credentials: 'include'
      });

      const authData = await authResponse.json();

      if (
        !authResponse.ok ||
        !authData.success ||
        !authData.user ||
        authData.user.role !== 'admin'
      ) {
        window.location.href = 'index.html?auth=denied';
        return;
      }
    } catch (error) {
      console.error('Admin session verification failed:', error);
      window.location.href = 'index.html?auth=required';
      return;
    }

    // Logout Handlers
    async function handleAdminLogout() {
  try {
    await fetch(`${ADMIN_API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Admin logout error:', error);
  } finally {
    // Clear the saved browser session so the home page resets to "Login / Register"
    localStorage.removeItem('brgy360_session');
    localStorage.removeItem('currentUserRole');
    localStorage.removeItem('brgy360_user');
    sessionStorage.clear();
    window.location.href = 'index.html';
  }
}

  const btnAdminLogout = document.getElementById('btnAdminLogout');
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', handleAdminLogout);
  }

  const sidebarAdminLogout = document.getElementById('sidebarAdminLogout');
  if (sidebarAdminLogout) {
    sidebarAdminLogout.addEventListener('click', handleAdminLogout);
  }

  // ==============================================================
  // 1. DATA STATE & REGISTRIES
  // ==============================================================

  // Initial Service Requests Dataset (Enriched with full Barangay Pallocan Kanluran fields)
  const INITIAL_SERVICE_REQUESTS = [];

  
function normalizeServiceRequest(r) {
    if (!r) return null;

    const id = r.request_id
        ? String(r.request_id)
        : String(r.id || r.ref || '');

    const ref = r.ref || r.id || id;

    const fullName = r.full_legal_name || r.fullName || r.resident || '';
    const resident = r.resident || fullName;

    const docType = r.document_type || r.docType || r.documentType || '';
    const documentType = r.document_type || r.documentType || docType;

    const sitio = r.sitio || r.purokSitio || '';
    const purokSitio = r.purokSitio || sitio;
    const address = r.address || '';

    const purpose = r.purpose_category || r.purpose || '';

    const dateFiled = r.created_at
        ? String(r.created_at).slice(0, 10)
        : (r.dateFiled || r.date || '');

    const date = r.date || dateFiled;
    const status = r.request_status || r.status || '';

    const age = r.age || '';
    const dateOfBirth = r.date_of_birth || '';

    const contact = r.mobile_number || r.contact || r.mobile || r.phone || '';

    const idOnRecord = r.idOnRecord ||
        (r.attachmentName ? `Attached: ${r.attachmentName}` : '');

    const userEmail = r.email || r.userEmail || '';

    const residentId = r.residentId || '';

    const residencySince = r.residencySince || '';
    const claimMethod = r.claimMethod || '';
    const claimTarget = r.claimTarget || '';

    const notes = r.notes || '';

    return {
        ...r,
        id,
        ref,
        requestId: r.request_id || r.requestId || null,
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
        date_of_birth: dateOfBirth,
        dateOfBirth,
        contact,
        idOnRecord,
        userEmail,
        residentId,
        residencySince,
        claimMethod,
        claimTarget,
        notes,
        businessName: r.businessName || '',
        businessAddress: r.businessAddress || '',
        natureOfBusiness: r.natureOfBusiness || '',
        businessType: r.businessType || '',
        numberOfEmployees: r.numberOfEmployees || ''
    };
}

  function persistServiceRequests() {
    try {
      const json = JSON.stringify(serviceRequests);
      localStorage.setItem('brgy360_service_requests', json);
      localStorage.setItem('brgy360_requests', json);
      localStorage.setItem('brgy360_user_requests', json);
      window.dispatchEvent(new CustomEvent('brgy360_requests_changed', { detail: serviceRequests }));
    } catch (e) {
      console.warn('Error saving serviceRequests to localStorage:', e);
    }
  }

  function loadServiceRequests() {
    try {
      const raw =
        localStorage.getItem('brgy360_service_requests') ||
        localStorage.getItem('brgy360_requests') ||
        localStorage.getItem('brgy360_user_requests');
      const alreadySeeded = localStorage.getItem('brgy360_admin_requests_seeded_v1') === 'true';

      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const list = parsed.map(normalizeServiceRequest);
          if (!alreadySeeded) {
            const existingIds = new Set(list.map(r => r.id || r.ref));
            INITIAL_SERVICE_REQUESTS.forEach(seed => {
              if (!existingIds.has(seed.id) && !existingIds.has(seed.ref)) {
                list.push(normalizeServiceRequest(seed));
              }
            });
            localStorage.setItem('brgy360_admin_requests_seeded_v1', 'true');
            const json = JSON.stringify(list);
            localStorage.setItem('brgy360_service_requests', json);
            localStorage.setItem('brgy360_requests', json);
          }
          return list;
        }
      }
    } catch (e) {
      console.warn('Error reading brgy360_service_requests:', e);
    }
    const initial = INITIAL_SERVICE_REQUESTS.map(normalizeServiceRequest);
    try {
      const json = JSON.stringify(initial);
      localStorage.setItem('brgy360_service_requests', json);
      localStorage.setItem('brgy360_requests', json);
      localStorage.setItem('brgy360_admin_requests_seeded_v1', 'true');
    } catch (e) {}
    return initial;
  }

  let serviceRequests = [];

  async function loadServiceRequestsFromBackend() {
  try {
    const response = await fetch(`${ADMIN_API_BASE}/admin/requests`, {
      method: 'GET',
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to load service requests.');
    }

    serviceRequests = (data.requests || []).map(normalizeServiceRequest);

    renderRequestsTable();
    renderOverviewQueue();
    updateRequestsCounter(serviceRequests.length);

  } catch (error) {
    console.error('Error loading service requests from backend:', error);
    showAdminToast(
      'Unable to Load Requests',
      'Could not retrieve service requests from the database. Please refresh the page.',
      'danger'
    );
  }
}

  const SHARED_DEFAULT_CONCERNS = [];

  function normalizeSitioName(val) {
    const canonical = [
      'Sitio Ibaba',
      'Sitio Santolan',
      'Sitio Ilaya',
      'Sitio Gitna',
      'Tierra Verde',
      'Potenciana Village',
      'G.C Berberabe'
    ];
    if (!val || typeof val !== 'string') return 'Sitio Ibaba';
    const trimmed = val.trim();
    if (canonical.includes(trimmed)) return trimmed;
    const lower = trimmed.toLowerCase();
    if (lower.includes('santolan')) return 'Sitio Santolan';
    if (lower.includes('ilaya')) return 'Sitio Ilaya';
    if (lower.includes('gitna')) return 'Sitio Gitna';
    if (lower.includes('potenciana')) return 'Potenciana Village';
    if (lower.includes('tierra verde')) return 'Tierra Verde';
    if (lower.includes('berberabe')) return 'G.C Berberabe';
    return 'Sitio Ibaba';
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

  function normalizeAdminConcern(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const ref = item.ref || item.id || ('TCK-' + Math.floor(1000 + Math.random() * 9000));
    const category = normalizeConcernCategory(item.category);
    const status = normalizeConcernStatus(item.status);
    const urgency = normalizeConcernUrgency(item.urgency || item.severity);
    const sitio = normalizeSitioName(item.sitio || item.location);
    const landmark = item.landmark || '';
    const location = item.location || (landmark ? `${sitio} — ${landmark}` : sitio);
    const desc = item.desc || item.submittedDetails || item.notes || item.summary || '';
    const title = item.title || item.summary || (desc ? (desc.length > 64 ? desc.slice(0, 61) + '...' : desc) : `${category} Concern`);
    const dateFiled = item.dateFiled
    ? String(item.dateFiled).slice(0, 10)
    : item.dateLogged
        ? String(item.dateLogged).slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const resolutionNote = item.resolutionNote !== undefined ? item.resolutionNote : (item.actionTaken || '');

    return {
      ref: ref,
      id: ref,
      title: title,
      summary: title,
      desc: desc,
      submittedDetails: desc,
      category: category,
      urgency: urgency,
      severity: urgency,
      status: status,
      currentStage: status === 'Resolved' ? 3 : (status === 'In Progress' ? 2 : 1),
      dateFiled: dateFiled,
      dateLogged: dateFiled,
      sitio: sitio,
      landmark: landmark,
      location: location,
      reporter: item.reporter || 'Verified Resident',
      userEmail: item.userEmail || '',
      userMobile: item.userMobile || '',
      userAddress: item.userAddress || (sitio + ', Barangay Pallocan West'),
      residentId: item.residentId || '',
      photoData: item.photoData || null,
      resolutionNote: resolutionNote,
      actionTaken: resolutionNote,
      notes: resolutionNote || desc,
      updatedAt: item.updatedAt || null
    };
  }

  let incidentTickets = [];

  function persistConcernsToStorage() {
    try {
      const normalized = incidentTickets.map(normalizeAdminConcern);
      incidentTickets = normalized;
      localStorage.setItem('brgy360_concerns', JSON.stringify(normalized));
    } catch (err) {
      console.warn('Error saving concerns to storage:', err);
    }
  }

  function syncResidentConcernsFromStorage() {
    try {
      const rawStr = localStorage.getItem('brgy360_concerns');
      let list = [];
      if (!rawStr) {
        list = SHARED_DEFAULT_CONCERNS.map(normalizeAdminConcern);
        localStorage.setItem('brgy360_concerns', JSON.stringify(list));
        localStorage.setItem('brgy360_concerns_connected_v3', 'true');
      } else {
        const parsed = JSON.parse(rawStr);
        const rawList = Array.isArray(parsed) ? parsed : SHARED_DEFAULT_CONCERNS;
        list = rawList.map(normalizeAdminConcern);

        if (!localStorage.getItem('brgy360_concerns_connected_v3')) {
          const existingRefs = new Set(list.map(c => c.ref));
          SHARED_DEFAULT_CONCERNS.forEach(seed => {
            if (!existingRefs.has(seed.ref)) {
              list.push(normalizeAdminConcern(seed));
            } else {
              const idx = list.findIndex(c => c.ref === seed.ref);
              if (idx !== -1) {
                if (!rawList[idx].title) {
                  list[idx].title = seed.title;
                  list[idx].summary = seed.title;
                }
                if (!rawList[idx].reporter) list[idx].reporter = seed.reporter;
                if (!rawList[idx].userEmail) list[idx].userEmail = seed.userEmail;
                if (!rawList[idx].userMobile) list[idx].userMobile = seed.userMobile;
                if (!rawList[idx].residentId) list[idx].residentId = seed.residentId;
              }
            }
          });
          localStorage.setItem('brgy360_concerns_connected_v3', 'true');
        }
        localStorage.setItem('brgy360_concerns', JSON.stringify(list));
      }
      incidentTickets = list;
    } catch (err) {
      console.warn('Error syncing resident concerns:', err);
      incidentTickets = SHARED_DEFAULT_CONCERNS.map(normalizeAdminConcern);
    }
  }

  const DEFAULT_CITIZEN_PROPOSALS = [];

  function normalizeProposalRecord(p) {
    if (!p) return null;

    // Support both database records and older frontend/seed records.
    const id = p.id || p.ref || p.tracking_code ||
        ('PROP-2026-' + Math.floor(100 + Math.random() * 900));

    const ref = p.ref || p.tracking_code || p.id || id;

    const title =
        p.title ||
        p.project_title ||
        'Community Project Proposal';

    const category =
        p.category ||
        p.sector_category ||
        'Infrastructure';

    const location =
        p.location ||
        p.location_sitio ||
        p.sitio ||
        'Barangay Pallocan West';

    const sitio =
        p.sitio ||
        p.location_sitio ||
        p.location ||
        location;

    const proponent =
        p.proponent ||
        p.guest_full_name ||
        p.resident_full_name ||
        (p.user ? (p.user.name || p.user.fullName) : '') ||
        'Community Resident';

    const email =
        p.email ||
        p.guest_email ||
        p.resident_email ||
        p.userEmail ||
        '';

    const residentId = p.residentId || '';

    // Get the submission date from either frontend or database fields.
    const submittedAt =
        p.submitted_at ||
        p.dateFiled ||
        p.date ||
        '';

    let dateFiled = '';

    if (submittedAt) {
        const parsedDate = new Date(submittedAt);

        dateFiled = !isNaN(parsedDate.getTime())
            ? parsedDate.toISOString().split('T')[0]
            : String(submittedAt);
    } else {
        dateFiled = new Date().toISOString().split('T')[0];
    }

    const date = p.date || (
        submittedAt
            ? new Date(submittedAt).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
            : dateFiled
    );

    const year = String(
        p.year ||
        p.fiscal_year ||
        dateFiled.slice(0, 4) ||
        '2026'
    );

    // Support both formatted frontend budgets and numeric database budgets.
    const budgetSource =
        p.rawBudget ??
        p.budget ??
        p.estimated_budget ??
        0;

    let rawBudgetNum = 0;

    if (typeof budgetSource === 'number') {
        rawBudgetNum = budgetSource;
    } else if (typeof budgetSource === 'string') {
        const cleaned = budgetSource.replace(/[^0-9.]/g, '');
        rawBudgetNum = parseFloat(cleaned) || 0;
    }

    const formattedBudget = '₱' + rawBudgetNum.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const timeline =
        p.timeline ||
        p.proposed_target_timeline ||
        '';

    const description =
        p.description ||
        p.rationale ||
        p.rationale_community_impact ||
        'Citizen community project proposal submitted for Barangay Development Council review.';

    const rationale =
        p.rationale ||
        p.rationale_community_impact ||
        p.description ||
        description;

    // Read status from either frontend or database.
    let status = p.status || p.proposal_status || 'Pending';

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

    const councilNotes =
        p.councilNotes ||
        p.councilNote ||
        p.council_review_notes ||
        '';

    const councilNote =
        p.councilNote ||
        p.councilNotes ||
        p.council_review_notes ||
        councilNotes;

    const norm = {
        ...p,

        // Keep the database ID for future update/delete requests.
        proposalId: p.proposal_id || p.proposalId || null,

        // Use the tracking code as the visible proposal reference.
        id,
        ref: p.tracking_code || ref,

        title,
        category,
        year,
        location,
        sitio,
        proponent,
        email,
        residentId,
        date,
        dateFiled,
        budget: formattedBudget,
        rawBudget: rawBudgetNum,
        timeline,
        status,
        description,
        rationale,
        councilNotes,
        councilNote,

        supportingDocument:
            p.supportingDocument ||
            p.supporting_documents_path ||
            ''
    };

    delete norm.votes;
    delete norm.targetVotes;

    return norm;
}

  
function loadCitizenProposals() {
    try {
        const raw = localStorage.getItem('brgy360_proposals');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map(normalizeProposalRecord);
            }
        }
    } catch (e) {
        console.warn('Error reading proposals from localStorage:', e);
    }
    return [];
}

function saveCitizenProposals() {
    try {
        localStorage.setItem('brgy360_proposals', JSON.stringify(citizenProposals));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('brgy360_proposals_changed', { detail: citizenProposals }));
    } catch (e) {
        console.warn('Error saving citizenProposals to localStorage:', e);
    }
}

  let citizenProposals = loadCitizenProposals();

  async function loadCitizenProposalsFromDatabase() {
    try {
        // Try admin route first; if 404 or fails, fall back to /api/proposals
        let response = await fetch('http://localhost:5000/api/proposals/admin/all', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.status === 404) {
            response = await fetch('http://localhost:5000/api/proposals', {
                method: 'GET',
                credentials: 'include'
            });
        }

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const data = await response.json();

        // Extract raw proposal records from flexible backend JSON shapes
        let rawList = [];
        if (Array.isArray(data)) {
            rawList = data;
        } else if (Array.isArray(data.proposals)) {
            rawList = data.proposals;
        } else if (Array.isArray(data.data)) {
            rawList = data.data;
        } else if (data.success === false) {
            throw new Error(data.message || 'Failed to load proposals.');
        }

        if (rawList.length > 0) {
            citizenProposals = rawList.map(p => normalizeProposalRecord({
                ...p,

                // Map database fields (supporting both snake_case and camelCase schemas)
                id: p.tracking_code || p.trackingCode || p.ref || p.id || (p.proposal_id ? `PR-${p.proposal_id}` : ''),
                ref: p.tracking_code || p.trackingCode || p.ref || p.id || (p.proposal_id ? `PR-${p.proposal_id}` : ''),
                proposalId: p.proposal_id || p.proposalId || p.id,
                title: p.project_title || p.projectTitle || p.title,
                category: p.sector_category || p.sectorCategory || p.category,
                year: String(p.fiscal_year || p.fiscalYear || p.year || new Date().getFullYear()),
                location: p.location_sitio || p.locationSitio || p.sitio || p.location,
                sitio: p.location_sitio || p.locationSitio || p.sitio || p.location,
                proponent: p.proponent || p.proponent_name || p.proponentName || p.fullName || p.resident,
                email: p.email || p.userEmail,
                dateFiled: p.submitted_at || p.submittedAt || p.created_at || p.dateFiled || p.date,
                date: (p.submitted_at || p.submittedAt || p.created_at)
                    ? new Date(p.submitted_at || p.submittedAt || p.created_at).toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })
                    : (p.date || ''),
                budget: p.estimated_budget ?? p.estimatedBudget ?? p.budget ?? 0,
                timeline: p.proposed_target_timeline || p.proposedTimeline || p.timeline || '',
                status: p.proposal_status || p.proposalStatus || p.status || 'Pending',
                description: p.rationale_community_impact || p.rationale || p.description || '',
                rationale: p.rationale_community_impact || p.rationale || p.description || '',
                councilNotes: p.council_review_notes || p.councilReviewNotes || p.councilNotes || p.councilNote || '',
                councilNote: p.council_review_notes || p.councilReviewNotes || p.councilNote || p.councilNotes || '',
                supportingDocument: p.supporting_documents_path || p.supportingDocumentsPath || p.supportingDocument || ''
            }));

            // Sync successfully retrieved proposals to localStorage for instant hydration
            try {
                localStorage.setItem('brgy360_proposals', JSON.stringify(citizenProposals));
            } catch (e) {}

            renderProposalsGrid();
            console.log('Admin proposals loaded from database:', citizenProposals);
        } else {
            // Backend returned empty list; fallback to local storage if present
            const local = loadCitizenProposals();
            if (local.length > 0 && citizenProposals.length === 0) {
                citizenProposals = local;
                renderProposalsGrid();
            }
        }

    } catch (error) {
        console.error('Error loading Admin proposals:', error);
        // Fallback to localStorage proposals so proposals submitted locally are not lost
        const local = loadCitizenProposals();
        if (local.length > 0) {
            citizenProposals = local;
            renderProposalsGrid();
        } else {
            showAdminToast(
                'Unable to load proposals from the database.',
                'error'
            );
        }
    }
}

  function clampProjectProgress(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num)));
  }

  function calculateProjectStatusFromProgress(progress) {
    const pct = clampProjectProgress(progress);
    if (pct === 100) return 'completed';
    if (pct >= 25) return 'ongoing';
    return 'planning';
  }

  const DEFAULT_CAPITAL_PROJECTS = [];

  function normalizeProjectRecord(project) {
    const matchedDefault = DEFAULT_CAPITAL_PROJECTS.find(d => d.code === project?.code);
    const progress = clampProjectProgress(project?.progress ?? 0);
    const rawStatus = String(project?.status || '').toLowerCase().trim();
    const status = (rawStatus === 'delayed' && progress < 100)
      ? 'delayed'
      : calculateProjectStatusFromProgress(progress);
    const timeline = project?.timeline || matchedDefault?.timeline || '2026-10-15 – 2027-04-30';
    const yearMatch = String(timeline).match(/\b(20\d{2})\b/);
    const year = String(project?.year || matchedDefault?.year || (yearMatch ? yearMatch[1] : '2026'));
    const description = String(
      project?.description ||
      matchedDefault?.description ||
      project?.contractor ||
      'Barangay Annual Investment Plan (AIP) community infrastructure project.'
    ).trim();

    return {
      ...matchedDefault,
      ...project,
      timeline,
      year,
      description,
      progress,
      status
    };
  }

  let capitalProjects = [];

  async function loadProjectsFromDatabase() {
  try {
    const response = await fetch('http://localhost:5000/api/projects', {
      method: 'GET',
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to load projects.');
    }

    capitalProjects = data.projects.map(project => {
      const createdDate = project.created_at
        ? new Date(project.created_at)
        : null;

      const year = createdDate && !isNaN(createdDate)
        ? String(createdDate.getFullYear())
        : String(new Date().getFullYear());

      return normalizeProjectRecord({
        id: project.project_id,
        code: `PRJ-${year}-${String(project.project_id).padStart(2, '0')}`,
        title: project.project_title,
        description: project.project_scope,
        location: project.location_purok,
        timeline: createdDate && !isNaN(createdDate)
          ? `Created ${createdDate.toLocaleDateString('en-PH')}`
          : 'Not specified',
        year: year,
        budget: '₱' + Number(project.allocated_budget).toLocaleString('en-PH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        progress: Number(project.progress_percentage),
        status: String(project.project_status).toLowerCase(),
        contractor: `Beneficiaries: ${project.target_beneficiaries}`
      });
    });

    renderProjectsTable();

  } catch (error) {
    console.error('Load projects from database error:', error);
    showAdminToast(
      'Projects Error',
      'Unable to load projects from the database.',
      'danger'
    );
  }
}

  // Announcements Dataset (Synchronized with Public Home Page via announcements-store.js)
  let announcementsList = [];

  // Retrieve and manage records through the Brgy360 backend API,
  // which uses Supabase PostgreSQL as its database.
    let adminBudgetRecords = [];
    let adminBudgetRecordsLoaded = false;

// Retrieve and manage records through the Brgy360 backend API,
// which uses Supabase PostgreSQL as its database.
async function loadAdminBudgetRecordsFromDatabase() {
  try {
    adminBudgetRecords = await fetchBudgetRecords();
    adminBudgetRecordsLoaded = true;

    syncAdminBudgetYearSelectors();
    renderAdminBudgetTable();

    updateAdminPublicSyncedCharts(
      document.getElementById('adminBudgetYearFilter')?.value || '2026',
      document.getElementById('adminBudgetQuarterFilter')?.value || 'all',
      document.getElementById('adminBudgetCategoryFilter')?.value || 'all'
    );

  } catch (error) {
    console.error('Admin budget database loading error:', error);

    adminBudgetRecords = [];
    adminBudgetRecordsLoaded = true;

    syncAdminBudgetYearSelectors();
    renderAdminBudgetTable();

    updateAdminPublicSyncedCharts();
  }
}

  const REPORTS_ANALYTICS_DATA = {
    '2026': {
      budgetCategory: {
        labels: ['Administration', 'Health', 'Social Services', 'Infrastructure'],
        budget: [0, 0, 0, 0],
        actual: [0, 0, 0, 0]
      },
      quarterly: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        budget: [0, 0, 0, 0],
        actual: [0, 0, 0, 0]
      },
      projectStatus: {
        labels: ['Ongoing', 'Completed', 'Delayed', 'Planning'],
        data: [0, 0, 0, 0],
        colors: ['#2563eb', '#10b981', '#e11d48', '#94a3b8']
      },
      requestType: {
        labels: ['Barangay Clearance', 'Certificate of Indigency', 'Certificate of Residency', 'Business Clearance', 'First-Time Jobseeker'],
        data: [0, 0, 0, 0, 0],
        colors: ['#0b1e36', '#2563eb', '#0284c7', '#d97706', '#10b981']
      },
      concerns: {
        labels: ['Infrastructure', 'Sanitation', 'Safety', 'Noise', 'Utilities'],
        data: [0, 0, 0, 0, 0],
        color: '#e11d48'
      }
    },
    '2025': {
      budgetCategory: {
        labels: ['Administration', 'Health', 'Social Services', 'Infrastructure'],
        budget: [0, 0, 0, 0],
        actual: [0, 0, 0, 0]
      },
      quarterly: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        budget: [0, 0, 0, 0],
        actual: [0, 0, 0, 0]
      },
      projectStatus: {
        labels: ['Ongoing', 'Completed', 'Delayed', 'Planning'],
        data: [0, 0, 0, 0],
        colors: ['#2563eb', '#10b981', '#e11d48', '#94a3b8']
      },
      requestType: {
        labels: ['Barangay Clearance', 'Certificate of Indigency', 'Certificate of Residency', 'Business Clearance', 'First-Time Jobseeker'],
        data: [0, 0, 0, 0, 0],
        colors: ['#0b1e36', '#2563eb', '#0284c7', '#d97706', '#10b981']
      },
      concerns: {
        labels: ['Infrastructure', 'Sanitation', 'Safety', 'Noise', 'Utilities'],
        data: [0, 0, 0, 0, 0],
        color: '#e11d48'
      }
    }
  };

  // Active UI filter & selection states (declared early to prevent TDZ errors on initial view render)
  let currentProposalFilter = 'all';
  let currentProjectFilter = 'all';
  let currentAnnouncementFilter = 'all';
  let currentReqStatusFilter = 'all';
  let currentReqCategoryFilter = 'all';
  let currentReqSearch = '';
  let currentIncStatusFilter = 'all';
  let currentIncCategoryFilter = 'all';
  let currentIncUrgencyFilter = 'all';
  let currentIncSearch = '';
  let currentInspectingReqId = null;
  let currentInspectingIncId = null;
  let currentResolvingIncidentId = null;

  // Resident Verification & Pre-Registration State
  let currentResStatusFilter = 'all';
  let currentResSearch = '';
  let currentResSitioFilter = 'all';
  let currentReviewingResId = null;
  let currentRejectingResId = null;
  let currentLightboxZoom = 1;
  let currentLightboxRotation = 0;

  // ==============================================================
  // RESIDENT APPLICATIONS — BACKEND DATA
  // ==============================================================

  let residentApplications = [];

  // Load pending resident applications from the backend.
  async function loadResidentApplicationsFromAPI() {
    try {
      const response = await fetch(
        `${ADMIN_API_BASE}/admin/residents/all`,
        {
          method: 'GET',
          credentials: 'include'
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'Failed to load resident applications.'
        );
      }

      residentApplications = (data.residents || []).map((resident) => ({
        id: resident.user_id,
        userId: resident.user_id,
        fullName: resident.full_legal_name,
        gender: resident.gender,
        civilStatus: resident.civil_status,
        dob: resident.date_of_birth,
        mobile: resident.mobile_number,
        email: resident.email,
        address: resident.address,
        sitio: normalizeSitioName(resident.sitio_purok),
        idType: resident.id_type,
        idFilePath: resident.id_file_path,
        proofType: resident.residency_proof_type,
        residencyProofPath: resident.residency_proof_path,
        hasPassword: Number(resident.has_password) === 1,
        status: resident.verification_status,
        verificationNotes: resident.verification_notes
      }));

      window.residentApplications = residentApplications;
      renderResidentVerificationTable();
      refreshAdminDashboard();

    } catch (error) {
      console.error('Resident applications loading error:', error);
      showAdminToast(
        'Unable to Load Residents',
        error.message || 'Please check your backend connection.',
        'error'
      );
    }
  }
  
  function getResidentDocumentUrl(filePath) {
  if (!filePath) return '';

  // If the backend already returned a full URL, use it.
  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }

  // Normalize the saved path and remove any leading slash.
  const normalizedPath = String(filePath)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  // The backend serves files from its /uploads route.
  const fileName = normalizedPath.startsWith('uploads/')
    ? normalizedPath.slice('uploads/'.length)
    : normalizedPath;

  return `${ADMIN_API_BASE.replace(/\/api\/?$/, '')}/uploads/${encodeURIComponent(fileName)}`;
}

  async function loadGeographicBreakdownFromAPI() {
    const tableBody = document.getElementById('geographicBreakdownTableBody');
    const totalBadge = document.getElementById('totalRegistryBadge');

    if (!tableBody || !totalBadge) {
        console.error('Geographic Breakdown HTML elements were not found.');
        return;
    }

    try {
        const response = await fetch(
            `${ADMIN_API_BASE}/admin/residents/geographic-breakdown`,
            {
                method: 'GET',
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'Failed to load geographic breakdown.'
            );
        }

        const totals = data.totals || {};
        const breakdown = data.geographic_breakdown || [];

        totalBadge.textContent =
            `Total Registry: ${Number(totals.registered_residents || 0).toLocaleString()} Citizens`;
            console.log('Geographic Breakdown badge updated:', totalBadge.textContent);

        if (breakdown.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4">No resident records found.</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = breakdown.map((item) => `
            <tr>
                <td><strong>${escapeHtml(item.sitio_purok || 'Unspecified')}</strong></td>
                <td>${Number(item.registered_residents || 0).toLocaleString()}</td>
                <td>
                    ${Number(item.verified_residents || 0).toLocaleString()}
                    (${Number(item.verification_percentage || 0).toFixed(1)}%)
                </td>
                <td>${Number(item.pending_verification || 0).toLocaleString()}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Geographic Breakdown loading error:', error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="4">Unable to load geographic breakdown.</td>
            </tr>
        `;

        totalBadge.textContent = 'Total Registry: Unavailable';
    }
}

  // ==============================================================
  // 2. LIVE CLOCK & TELEMETRY
  // ==============================================================
  function updateLiveClock() {
    const clockEl = document.getElementById('liveClockDisplay');
    if (!clockEl) return;
    const now = new Date();
    const options = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    clockEl.textContent = now.toLocaleDateString('en-US', options);
  }
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // ==============================================================
  // 3. NAVIGATION & VIEW SWITCHING
  // ==============================================================
  const navButtons = document.querySelectorAll('.nav-link[data-view]');
  const viewPanels = document.querySelectorAll('.admin-view-panel');
  const viewHeading = document.getElementById('currentViewTitle');
  const sidebar = document.getElementById('adminSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

  const viewTitles = {
    overview: 'Barangay Dashboard',
    requests: 'Service Requests Desk',
    incidents: 'Citizen Concerns Desk',
    proposals: 'Project Proposals Desk',
    projects: 'Projects Portfolio',
    announcements: 'Announcements & Advisories',
    budget: 'Budget & Fiscal Allocation',
    demographics: 'Resident Verification',
    officials: 'Barangay Officials'
  };

  function switchView(viewId) {
    if (viewId === 'predictive' || viewId === 'settings') {
      switchView('overview');
      return;
    }

    if (!viewTitles[viewId]) return;

    // Update active nav links
    navButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
    });

    // Update active view panel
    viewPanels.forEach(panel => {
      const panelId = panel.id.replace('view', '').toLowerCase();
      panel.classList.toggle('active', panelId === viewId);
    });

    // Update header heading
    if (viewHeading) {
      viewHeading.textContent = viewTitles[viewId];
    }

    // Call dynamic renderers when switching tabs
    if (viewId === 'overview') {
      const yr = document.getElementById('dashboardFiscalYearSelect')?.value || '2026';
      initOrUpdateReportsCharts(yr);
    }
    if (viewId === 'proposals') renderProposalsTable();
    if (viewId === 'projects') renderProjectsTable();
    if (viewId === 'announcements') loadAnnouncementsFromBackend();
    if (viewId === 'budget') renderAdminBudgetTable();
    if (viewId === 'demographics') {
      renderResidentVerificationTable();
      loadGeographicBreakdownFromAPI();
    }
    if (viewId === 'officials') {
      renderAdminOfficialsView();
    }

    // Close mobile drawer if open
    closeMobileSidebar();

    // Trigger chart resize if charts are inside this view
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 150);

    // Update URL hash without scroll jump
    history.replaceState(null, '', '#' + viewId);
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const targetView = this.getAttribute('data-view');
      switchView(targetView);
    });
  });


  // Cross-view quick jump triggers
  const btnViewAllPrescriptive = document.getElementById('btnViewAllPrescriptive');
  if (btnViewAllPrescriptive) {
    btnViewAllPrescriptive.addEventListener('click', () => switchView('overview'));
  }
  const btnJumpToEngine = document.getElementById('btnJumpToEngine');
  if (btnJumpToEngine) {
    btnJumpToEngine.addEventListener('click', () => {
      closeAllPopovers();
      switchView('overview');
    });
  }
  const btnQuickForecast = document.getElementById('btnQuickForecast');
  if (btnQuickForecast) {
    btnQuickForecast.addEventListener('click', () => switchView('overview'));
  }
  const btnViewAllRequests = document.getElementById('btnViewAllRequests');
  if (btnViewAllRequests) {
    btnViewAllRequests.addEventListener('click', () => switchView('requests'));
  }

  // Mobile Sidebar Drawer
  function openMobileSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
  }

  function closeMobileSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
  }

  if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', openMobileSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

    // ==============================================================
    // 4. TOPBAR DROPDOWNS & NOTIFICATION POPOVER
    // ==============================================================

    const btnQuickActions = document.getElementById('btnQuickActions');
    const quickActionMenu = document.getElementById('quickActionMenu');
    const btnNotifCenter = document.getElementById('btnNotifCenter');
    const notifPopover = document.getElementById('notifPopover');

    const adminNotifBadge = document.getElementById('adminNotifBadge');
    const adminNotifSub = document.getElementById('adminNotifSub');
    const adminNotifList = document.getElementById('adminNotifList');
    const btnDismissAllAlerts = document.getElementById('btnDismissAllAlerts');

    let adminNotifications = [];

    function closeAllPopovers() {
        if (quickActionMenu) quickActionMenu.classList.remove('active');
        if (notifPopover) notifPopover.classList.remove('active');
    }

    // Open Quick Actions
    if (btnQuickActions && quickActionMenu) {
        btnQuickActions.addEventListener('click', function (e) {
            e.stopPropagation();

            const isActive = quickActionMenu.classList.contains('active');

            closeAllPopovers();

            if (!isActive) {
                quickActionMenu.classList.add('active');
            }
        });
    }

    // Open Notifications
    if (btnNotifCenter && notifPopover) {
        btnNotifCenter.addEventListener('click', function (e) {
            e.stopPropagation();

            const isActive = notifPopover.classList.contains('active');

            closeAllPopovers();

            if (!isActive) {
                notifPopover.classList.add('active');
                loadAdminNotifications();
            }
        });
    }

    // Close popovers when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.topbar-dropdown-wrap')) {
            closeAllPopovers();
        }
    });

    // Escape HTML before displaying database content
    function escapeAdminNotificationHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[character]);
    }

    // Format notification timestamps
    function formatAdminNotificationTime(dateValue) {
        if (!dateValue) return '';

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleString('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    // Update unread badge
    function updateAdminNotificationBadge(unreadCount) {
        if (!adminNotifBadge) return;

        const count = Number(unreadCount) || 0;

        adminNotifBadge.textContent = count > 99 ? '99+' : count;
        adminNotifBadge.style.display = count > 0 ? 'inline-flex' : 'none';

        if (adminNotifSub) {
            adminNotifSub.textContent =
                `${count} unread notification${count === 1 ? '' : 's'}`;
        }
    }

    // Display notifications
    function renderAdminNotifications() {
        if (!adminNotifList) return;

        if (adminNotifications.length === 0) {
            adminNotifList.innerHTML = `
                <div class="alert-item info">
                    <div class="alert-icon">🔔</div>
                    <div class="alert-body">
                        <span class="alert-title">No notifications yet</span>
                        <p class="alert-desc">
                            New resident activities will appear here.
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        adminNotifList.innerHTML = adminNotifications.map(notification => {
            const isRead = Number(notification.is_read) === 1;

            return `
                <div
                    class="alert-item ${isRead ? 'info' : 'warning'}"
                    data-notification-id="${Number(notification.notification_id)}"
                    style="${isRead ? 'opacity: 0.65;' : ''} cursor: pointer;"
                    title="Click to mark as read"
                >
                    <div class="alert-icon">${isRead ? '🔔' : '📩'}</div>

                    <div class="alert-body">
                        <span class="alert-title">
                            ${escapeAdminNotificationHTML(notification.title)}
                        </span>

                        <p class="alert-desc">
                            ${escapeAdminNotificationHTML(notification.message)}
                        </p>

                        <span class="alert-time">
                            ${escapeAdminNotificationHTML(
                                formatAdminNotificationTime(notification.created_at)
                            )}
                        </span>

                        ${!isRead ? `
                            <span class="alert-time">Unread</span>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        adminNotifList.querySelectorAll('[data-notification-id]').forEach(item => {
            item.addEventListener('click', async function () {
                const notificationId = this.dataset.notificationId;

                await markAdminNotificationAsRead(notificationId);
            });
        });
    }

    // Retrieve notifications from the backend
    async function loadAdminNotifications() {
        if (!adminNotifList) return;

        try {
            const response = await fetch(
                `${ADMIN_API_BASE}/admin/notifications`,
                {
                    method: 'GET',
                    credentials: 'include'
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to load notifications.');
            }

            adminNotifications = data.notifications || [];

            updateAdminNotificationBadge(data.unreadCount);
            renderAdminNotifications();

        } catch (error) {
            console.error('Load admin notifications error:', error);

            adminNotifList.innerHTML = `
                <div class="alert-item danger">
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-body">
                        <span class="alert-title">Unable to load notifications</span>
                        <p class="alert-desc">
                            Please check your connection and try again.
                        </p>
                    </div>
                </div>
            `;
        }
    }

    // Mark one notification as read
    async function markAdminNotificationAsRead(notificationId) {
        try {
            const response = await fetch(
                `${ADMIN_API_BASE}/admin/notifications/${notificationId}/read`,
                {
                    method: 'PATCH',
                    credentials: 'include'
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to update notification.');
            }

            await loadAdminNotifications();

        } catch (error) {
            console.error('Mark admin notification as read error:', error);
            showAdminToast(
                'Notification Error',
                'Unable to mark notification as read.',
                'error'
            );
        }
    }

    // Mark all notifications as read
    if (btnDismissAllAlerts) {
        btnDismissAllAlerts.addEventListener('click', async function () {
            try {
                const response = await fetch(
                    `${ADMIN_API_BASE}/admin/notifications/read-all`,
                    {
                        method: 'PATCH',
                        credentials: 'include'
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to update notifications.');
                }

                await loadAdminNotifications();

                showAdminToast(
                    'Notifications Updated',
                    'All notifications have been marked as read.',
                    'success'
                );

            } catch (error) {
                console.error('Mark all admin notifications as read error:', error);

                showAdminToast(
                    'Notification Error',
                    'Unable to mark all notifications as read.',
                    'error'
                );
            }
        });
    }

    // Initial notification load
    loadAdminNotifications();

    // Refresh notifications every 30 seconds
    setInterval(loadAdminNotifications, 30000);

  // Quick Action menu triggers
  const qaLogIncident = document.getElementById('qaLogIncident');
  if (qaLogIncident) {
    qaLogIncident.addEventListener('click', () => {
      closeAllPopovers();
      openNewIncidentModal();
    });
  }
  const qaExportDossier = document.getElementById('qaExportDossier');
  if (qaExportDossier) {
      qaExportDossier.addEventListener('click', () => {
          closeAllPopovers();
          exportGovernanceDossier();
      });
  }

  // ==============================================================
  // 5. CHART.JS VISUALIZATIONS INITIALIZATION
  // ==============================================================
  let docVolumeChart = null;
  let incidentCategoryChart = null;
  let repBudgetCatChart = null;
  let repQuarterlyChart = null;
  let repProjectStatusChart = null;
  let repRequestTypeChart = null;
  let repConcernsChart = null;
  let budgetBurnChart = null;
  let adminBudgetQuarterBarChart = null;
  let adminBudgetCategoryPieChart = null;
  let adminPieChartMode = 'actual';

  // Global Chart.js typography defaults
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";
    Chart.defaults.color = '#64748b';
  }

  // Chart 1: Document Request Volume Bar Chart (Descriptive)
  function initDocVolumeChart() {
    const ctx = document.getElementById('docVolumeChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const dataYTD = [0, 0, 0, 0, 0];
    const categories = ['Barangay Clearance', 'Cert of Residency', 'Cert of Indigency', 'Business Permit', 'Jobseeker Waiver'];

    docVolumeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [{
          label: 'Applications Processed',
          data: dataYTD,
          backgroundColor: [
            '#0d47a1',
            '#1565c0',
            '#0284c7',
            '#d97706',
            '#16a34a'
          ],
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 42
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0a2540',
            titleFont: { size: 12, weight: '700' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (context) => ` Applications: ${context.raw} records`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10.5, weight: '600' },
              color: '#475569'
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: {
              stepSize: 30,
              font: { size: 10.5 },
              color: '#64748b'
            }
          }
        }
      }
    });

    // Segmented period buttons filter
    const filterBtns = document.querySelectorAll('#docChartFilter .seg-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        filterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const period = this.getAttribute('data-period');
        let newData = [0, 0, 0, 0, 0];
        if (period === 'q3') newData = [0, 0, 0, 0, 0];
        if (period === 'q4') newData = [0, 0, 0, 0, 0];
        docVolumeChart.data.datasets[0].data = newData;
        docVolumeChart.update();
      });
    });
  }

  // Chart 2: Citizen Incident Breakdown Doughnut Chart (Descriptive)
  function initIncidentCategoryChart() {
    const ctx = document.getElementById('incidentCategoryChart');
    if (!ctx || typeof Chart === 'undefined') return;

    incidentCategoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Infrastructure', 'Sanitation', 'Public Safety', 'Noise', 'Utilities'],
        datasets: [{
          data: [0, 0, 0, 0, 0],
          backgroundColor: [
            '#dc2626', // Infrastructure (35%)
            '#d97706', // Sanitation (25%)
            '#0d47a1', // Public Safety (20%)
            '#7c3aed', // Noise (12%)
            '#0284c7'  // Utilities (8%)
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0a2540',
            titleFont: { size: 12, weight: '700' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (context) => ` Proportion: ${context.raw}% (${context.label})`
            }
          }
        }
      }
    });
  }

  // ==============================================================
  // 5.B UNIFIED DASHBOARD STATS & ANALYTICS CHARTS INITIALIZATION
  // ==============================================================
  function getDynamicReportsBudgetData(year = '2026') {
    const yearStr = String(year || '2026');
    const yearRecords = (adminBudgetRecords || []).filter(
      (r) => isApplicableBudgetRecord(r) && String(r.year) === yearStr
    );
    const catLabels = getActiveCategoriesForYear(yearRecords, yearStr);
    const catBudgets = catLabels.map((cat) =>
      yearRecords
        .filter((r) => r.category === cat)
        .reduce((sum, r) => sum + (Number(r.budget) || 0), 0)
    );
    const catActuals = catLabels.map((cat) =>
      yearRecords
        .filter((r) => r.category === cat)
        .reduce((sum, r) => sum + (Number(r.actual) || 0), 0)
    );

    const qLabels = [...BUDGET_QUARTERS];
    const qBudgets = qLabels.map((q) =>
      yearRecords
        .filter((r) => r.quarter === q)
        .reduce((sum, r) => sum + (Number(r.budget) || 0), 0)
    );
    const qActuals = qLabels.map((q) =>
      yearRecords
        .filter((r) => r.quarter === q)
        .reduce((sum, r) => sum + (Number(r.actual) || 0), 0)
    );

    return {
      metrics: computeBudgetMetrics(yearRecords),
      budgetCategory: {
        labels: catLabels,
        budget: catBudgets,
        actual: catActuals
      },
      quarterly: {
        labels: qLabels,
        budget: qBudgets,
        actual: qActuals
      }
    };
  }

  function getActiveDashboardYear() {
    return document.getElementById('dashboardFiscalYearSelect')?.value || '2026';
  }

  function extractRecordYear(record, fallback = '2026') {
    if (!record || typeof record !== 'object') return String(fallback);
    const candidates = [
      record.year,
      record.dateFiled,
      record.date,
      record.timeline,
      record.registeredDate,
      record.id,
      record.ref,
      record.code
    ];
    for (const c of candidates) {
      if (!c) continue;
      const match = String(c).match(/\b(20\d{2})\b/);
      if (match) return match[1];
    }
    return String(fallback);
  }

  const SERVICE_REQUEST_TYPE_BUCKETS = [
    { key: 'Clearance', label: 'Barangay Clearance', shortLabel: 'Clearance', color: '#0b1e36', alwaysShow: true },
    { key: 'Indigency', label: 'Certificate of Indigency', shortLabel: 'Indigency', color: '#2563eb', alwaysShow: true },
    { key: 'Residency', label: 'Certificate of Residency', shortLabel: 'Residency', color: '#0284c7', alwaysShow: true },
    { key: 'Business', label: 'Business Clearance', shortLabel: 'Business', color: '#d97706', alwaysShow: true },
    { key: 'Jobseeker', label: 'First-Time Jobseeker', shortLabel: 'Jobseeker', color: '#10b981', alwaysShow: true },
    { key: 'Mediation', label: 'KP Mediation', shortLabel: 'Mediation', color: '#7c3aed', alwaysShow: false },
    { key: 'Other', label: 'Other Certificates', shortLabel: 'Other', color: '#64748b', alwaysShow: false }
  ];

  function classifyServiceRequestType(rawType) {
    const s = String(rawType || '').trim().toLowerCase();
    if (!s || (s.includes('barangay clearance') && !s.includes('business'))) {
      return SERVICE_REQUEST_TYPE_BUCKETS[0];
    }
    if (s.includes('indigency')) {
      return SERVICE_REQUEST_TYPE_BUCKETS[1];
    }
    if (s.includes('residency')) {
      return SERVICE_REQUEST_TYPE_BUCKETS[2];
    }
    if (s.includes('business') || s.includes('permit')) {
      return SERVICE_REQUEST_TYPE_BUCKETS[3];
    }
    if (s.includes('job') || s.includes('seeker') || s.includes('first-time') || s.includes('11261')) {
      return SERVICE_REQUEST_TYPE_BUCKETS[4];
    }
    if (s.includes('mediation') || s.includes('conciliation') || s.includes('katarungang') || s.includes('lupon')) {
      return SERVICE_REQUEST_TYPE_BUCKETS[5];
    }
    if (s.includes('clearance')) {
      return SERVICE_REQUEST_TYPE_BUCKETS[0];
    }
    return SERVICE_REQUEST_TYPE_BUCKETS[6];
  }

  function isRequestActiveForChart(req) {
    const st = String(req?.status || '').trim().toLowerCase();
    return st !== 'rejected' && st !== 'cancelled';
  }

  function getDynamicRequestTypeAnalytics(year = '2026') {
    const yearStr = String(year || '2026');
    const allReqs = Array.isArray(serviceRequests) ? serviceRequests : [];
    const yearReqs = allReqs.filter((r) => extractRecordYear(r, '2026') === yearStr);

    if (yearStr !== '2026' && yearReqs.length === 0 && REPORTS_ANALYTICS_DATA[yearStr]?.requestType) {
      const fallback = REPORTS_ANALYTICS_DATA[yearStr].requestType;
      const shortLabels = ['Clearance', 'Indigency', 'Residency', 'Business', 'Jobseeker'];
      return {
        labels: [...fallback.labels],
        shortLabels: shortLabels.slice(0, fallback.labels.length),
        data: [...fallback.data],
        colors: [...fallback.colors],
        details: fallback.data.map((cnt) => ({
          active: cnt,
          inReview: 0,
          readyOrCompleted: cnt,
          inactive: 0
        })),
        isEmpty: fallback.data.every((n) => n === 0)
      };
    }

    const statsMap = new Map();
    SERVICE_REQUEST_TYPE_BUCKETS.forEach((b) => {
      statsMap.set(b.key, {
        bucket: b,
        active: 0,
        inReview: 0,
        readyOrCompleted: 0,
        inactive: 0,
        total: 0
      });
    });

    yearReqs.forEach((r) => {
      const bucket = classifyServiceRequestType(r.docType || r.documentType);
      const entry = statsMap.get(bucket.key);
      if (!entry) return;
      entry.total += 1;
      if (isRequestActiveForChart(r)) {
        entry.active += 1;
        if (r.status === 'Ready for Pickup' || r.status === 'Completed' || r.status === 'Approved') {
          entry.readyOrCompleted += 1;
        } else {
          entry.inReview += 1;
        }
      } else {
        entry.inactive += 1;
      }
    });

    const visibleEntries = [];
    statsMap.forEach((entry) => {
      if (entry.bucket.alwaysShow || entry.total > 0) {
        visibleEntries.push(entry);
      }
    });

    const activeData = visibleEntries.map((e) => e.active);
    const isEmpty = activeData.every((n) => n === 0);

    return {
      labels: visibleEntries.map((e) => e.bucket.label),
      shortLabels: visibleEntries.map((e) => e.bucket.shortLabel),
      data: activeData,
      colors: visibleEntries.map((e) => e.bucket.color),
      details: visibleEntries.map((e) => ({
        active: e.active,
        inReview: e.inReview,
        readyOrCompleted: e.readyOrCompleted,
        inactive: e.inactive
      })),
      isEmpty
    };
  }

  function classifyConcernChartBucket(rawCategory) {
    const s = String(rawCategory || '').trim().toLowerCase();
    if (!s || s.includes('infra') || s.includes('road') || s.includes('drain') || s.includes('light')) {
      return 'Infrastructure';
    }
    if (s.includes('sanit') || s.includes('waste') || s.includes('garbage')) {
      return 'Sanitation';
    }
    if (s.includes('safe') || s.includes('sec') || s.includes('patrol') || s.includes('peace')) {
      return 'Safety';
    }
    if (s.includes('noise') || s.includes('disturb')) {
      return 'Noise';
    }
    if (s.includes('util') || s.includes('water') || s.includes('power') || s.includes('electric')) {
      return 'Utilities';
    }
    return 'Other';
  }

  function getDynamicConcernsAnalytics(year = '2026') {
    const yearStr = String(year || '2026');
    const allConcerns = Array.isArray(incidentTickets) ? incidentTickets : [];
    const yearConcerns = allConcerns.filter((c) => extractRecordYear(c, '2026') === yearStr);

    if (yearStr !== '2026' && yearConcerns.length === 0 && REPORTS_ANALYTICS_DATA[yearStr]?.concerns) {
      const fb = REPORTS_ANALYTICS_DATA[yearStr].concerns;
      return {
        labels: [...fb.labels],
        data: [...fb.data],
        color: fb.color || '#e11d48',
        details: fb.data.map((cnt) => ({ total: cnt, open: 0, resolved: cnt }))
      };
    }

    const baseCategories = ['Infrastructure', 'Sanitation', 'Safety', 'Noise', 'Utilities'];
    const countsMap = new Map();
    [...baseCategories, 'Other'].forEach((cat) => {
      countsMap.set(cat, { total: 0, open: 0, resolved: 0 });
    });

    yearConcerns.forEach((item) => {
      const bucket = classifyConcernChartBucket(item.category);
      const entry = countsMap.get(bucket) || countsMap.get('Other');
      entry.total += 1;
      if (normalizeConcernStatus(item.status) === 'Resolved') {
        entry.resolved += 1;
      } else {
        entry.open += 1;
      }
    });

    const labels = [...baseCategories];
    if ((countsMap.get('Other')?.total || 0) > 0) {
      labels.push('Other');
    }

    return {
      labels,
      data: labels.map((l) => countsMap.get(l)?.total || 0),
      color: '#e11d48',
      details: labels.map((l) => countsMap.get(l) || { total: 0, open: 0, resolved: 0 })
    };
  }

  function getDynamicProjectStatusAnalytics(year = '2026') {
    const yearStr = String(year || '2026');
    const allProjects = Array.isArray(capitalProjects) ? capitalProjects : [];
    const labels = ['Ongoing', 'Completed', 'Delayed', 'Planning'];
    const colors = ['#2563eb', '#10b981', '#e11d48', '#94a3b8'];

    if (yearStr === '2026') {
      const scoped = allProjects.filter((p) => {
        const py = String(p.year || '2026');
        const isDefault = DEFAULT_CAPITAL_PROJECTS.some((d) => d.code === p.code);
        return isDefault || py === '2026';
      });
      return {
        labels,
        colors,
        data: [
          scoped.filter((p) => p.status === 'ongoing').length,
          scoped.filter((p) => p.status === 'completed').length,
          scoped.filter((p) => p.status === 'delayed').length,
          scoped.filter((p) => p.status === 'planning').length
        ]
      };
    }

    const customOrYearProjects = allProjects.filter(
      (p) => String(p.year) === yearStr && !DEFAULT_CAPITAL_PROJECTS.some((d) => d.code === p.code)
    );
    const fb = REPORTS_ANALYTICS_DATA[yearStr]?.projectStatus || { labels, data: [0, 0, 0, 0], colors };
    const extraOngoing = customOrYearProjects.filter((p) => p.status === 'ongoing').length;
    const extraCompleted = customOrYearProjects.filter((p) => p.status === 'completed').length;
    const extraDelayed = customOrYearProjects.filter((p) => p.status === 'delayed').length;
    const extraPlanning = customOrYearProjects.filter((p) => p.status === 'planning').length;

    return {
      labels,
      colors,
      data: [
        (fb.data[0] || 0) + extraOngoing,
        (fb.data[1] || 0) + extraCompleted,
        (fb.data[2] || 0) + extraDelayed,
        (fb.data[3] || 0) + extraPlanning
      ]
    };
  }

  function getLiveResidentMetrics() {
    const apps = Array.isArray(residentApplications)
        ? residentApplications
        : [];

    const verifiedTotal = apps.filter(
        (a) => String(a?.status || '').trim().toLowerCase() === 'verified'
    ).length;

    const pendingTotal = apps.filter(
        (a) => String(a?.status || '').trim().toLowerCase() === 'pending'
    ).length;

    const totalResidents = apps.length;

    const verifiedPct = totalResidents > 0
        ? ((verifiedTotal / totalResidents) * 100).toFixed(1)
        : '0.0';

    return {
        totalResidents,
        verifiedTotal,
        pendingTotal,
        verifiedPct
    };
}

  function updateDashboardStatsCards(year = '2026') {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    const setSub = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };

    const yearStr = String(year || '2026');
    const yearRecords = (adminBudgetRecords || []).filter(
      (b) => isApplicableBudgetRecord(b) && String(b.year) === yearStr
    );
    const budgetMetrics = computeBudgetMetrics(yearRecords);

    if (yearStr === '2026') {
      const resMetrics = getLiveResidentMetrics();
      const yearReqs = Array.isArray(serviceRequests)
        ? serviceRequests.filter((r) => extractRecordYear(r, '2026') === '2026')
        : [];
      const activeReqs = yearReqs.filter(isRequestActiveForChart);
      const inactiveReqCount = yearReqs.length - activeReqs.length;
      const totalReq = activeReqs.length;
      const completedReq = activeReqs.filter(
        (r) => r.status === 'Ready for Pickup' || r.status === 'Completed' || r.status === 'Approved'
      ).length;
      const pendingReq = activeReqs.filter(
        (r) => r.status === 'In Review' || r.status === 'Pending'
      ).length;

      const yearConcerns = Array.isArray(incidentTickets)
        ? incidentTickets.filter((i) => extractRecordYear(i, '2026') === '2026')
        : [];
      const totalInc = yearConcerns.length;
      const openInc = yearConcerns.filter((i) => normalizeConcernStatus(i.status) !== 'Resolved').length;

      const projStats = getDynamicProjectStatusAnalytics('2026');
      const [ongoingProj, completedProj] = projStats.data;

      setVal('cardValResidents', resMetrics.totalResidents.toLocaleString('en-PH'));
      setSub(
        'cardSubResidents',
        `${resMetrics.verifiedTotal.toLocaleString('en-PH')} verified (${resMetrics.verifiedPct}%)`
      );

      setVal('cardValPendingVerif', resMetrics.pendingTotal.toLocaleString('en-PH'));
      setSub('cardSubPendingVerif', 'Awaiting citizen validation');

      setVal('cardValTotalBudget', formatCurrencyPHP(budgetMetrics.totalBudget));
      setSub('cardSubTotalBudget', `${formatCurrencyPHP(budgetMetrics.totalSpending)} spent · ${budgetMetrics.utilizationText} utilized`);

      setVal('cardValTotalRequests', totalReq.toString());
      setSub(
        'cardSubTotalRequests',
        inactiveReqCount > 0
          ? `Active filings · ${inactiveReqCount} rejected/cancelled`
          : 'All document filings'
      );

      setVal('cardValCompletedRequests', completedReq.toString());
      setSub('cardSubCompletedRequests', 'Ready for pickup / released');

      setVal('cardValPendingRequests', pendingReq.toString());
      setSub('cardSubPendingRequests', 'In review &amp; verification');

      setVal('cardValReportedConcerns', totalInc.toString());
      setSub(
        'cardSubReportedConcerns',
        openInc > 0
          ? `<span class="brgy-open-badge"><span class="badge-dot-alert"></span> <strong>${openInc} open concern${openInc !== 1 ? 's' : ''}</strong></span>`
          : `<span class="brgy-open-badge resolved"><span class="badge-dot-alert"></span> <strong>0 open concerns</strong></span>`
      );

      setVal('cardValOngoingProjects', ongoingProj.toString());
      setSub('cardSubOngoingProjects', 'Active civic &amp; infra works');

      setVal('cardValCompletedProjects', completedProj.toString());
      setSub('cardSubCompletedProjects', 'Delivered infrastructure');
    } else {
      // Historical / Other Fiscal Year Data (with live overrides if records exist for that FY)
      const yearReqs = Array.isArray(serviceRequests)
        ? serviceRequests.filter((r) => extractRecordYear(r, '2026') === yearStr && isRequestActiveForChart(r))
        : [];
      const yearConcerns = Array.isArray(incidentTickets)
        ? incidentTickets.filter((i) => extractRecordYear(i, '2026') === yearStr)
        : [];
      const projStats = getDynamicProjectStatusAnalytics(yearStr);

      setVal('cardValResidents', '4,650');
      setSub('cardSubResidents', '4,020 verified (86.4%)');

      setVal('cardValPendingVerif', '630');
      setSub('cardSubPendingVerif', 'Awaiting citizen validation');

      setVal('cardValTotalBudget', formatCurrencyPHP(budgetMetrics.totalBudget));
      setSub('cardSubTotalBudget', `${formatCurrencyPHP(budgetMetrics.totalSpending)} spent · ${budgetMetrics.utilizationText} utilized`);

      const totalReqHist = yearReqs.length > 0 ? yearReqs.length : 15;
      const completedReqHist = yearReqs.length > 0
        ? yearReqs.filter((r) => r.status === 'Ready for Pickup' || r.status === 'Completed' || r.status === 'Approved').length
        : 15;
      const pendingReqHist = yearReqs.length > 0
        ? yearReqs.filter((r) => r.status === 'In Review' || r.status === 'Pending').length
        : 0;

      setVal('cardValTotalRequests', totalReqHist.toString());
      setSub('cardSubTotalRequests', 'All document filings');

      setVal('cardValCompletedRequests', completedReqHist.toString());
      setSub('cardSubCompletedRequests', pendingReqHist === 0 ? '100% completed' : 'Ready for pickup / released');

      setVal('cardValPendingRequests', pendingReqHist.toString());
      setSub('cardSubPendingRequests', pendingReqHist === 0 ? 'All processed' : 'In review &amp; verification');

      const totalIncHist = yearConcerns.length > 0 ? yearConcerns.length : 11;
      const openIncHist = yearConcerns.length > 0
        ? yearConcerns.filter((i) => normalizeConcernStatus(i.status) !== 'Resolved').length
        : 0;

      setVal('cardValReportedConcerns', totalIncHist.toString());
      setSub(
        'cardSubReportedConcerns',
        openIncHist > 0
          ? `<span class="brgy-open-badge"><span class="badge-dot-alert"></span> <strong>${openIncHist} open concern${openIncHist !== 1 ? 's' : ''}</strong></span>`
          : `<span class="brgy-open-badge resolved"><span class="badge-dot-alert"></span> <strong>0 open concerns</strong></span>`
      );

      setVal('cardValOngoingProjects', projStats.data[0].toString());
      setSub('cardSubOngoingProjects', projStats.data[0] > 0 ? 'Active civic &amp; infra works' : 'All closed for FY');

      setVal('cardValCompletedProjects', projStats.data[1].toString());
      setSub('cardSubCompletedProjects', `${projStats.data[1]} project${projStats.data[1] !== 1 ? 's' : ''} delivered`);
    }
  }

  function syncAuxiliaryCharts(year = '2026') {
    const dynReq = getDynamicRequestTypeAnalytics(year);
    if (docVolumeChart) {
      docVolumeChart.data.labels = dynReq.labels;
      docVolumeChart.data.datasets[0].data = dynReq.data;
      docVolumeChart.data.datasets[0].backgroundColor = dynReq.colors;
      docVolumeChart.update();
    }
    const dynConcerns = getDynamicConcernsAnalytics(year);
    if (incidentCategoryChart) {
      const totalC = dynConcerns.data.reduce((s, v) => s + v, 0);
      incidentCategoryChart.data.labels = dynConcerns.labels;
      incidentCategoryChart.data.datasets[0].data = totalC > 0
        ? dynConcerns.data.map((v) => Math.round((v / totalC) * 100))
        : dynConcerns.data;
      incidentCategoryChart.update();
    }
  }

  function initOrUpdateReportsCharts(year = '2026') {
    const yearStr = String(year || getActiveDashboardYear() || '2026');
    updateDashboardStatsCards(yearStr);

    // Keep year selectors synced if both exist
    const dashSelect = document.getElementById('dashboardFiscalYearSelect');
    if (dashSelect && dashSelect.value !== yearStr && Array.from(dashSelect.options).some(o => o.value === yearStr)) {
      dashSelect.value = yearStr;
    }
    const repSelect = document.getElementById('reportsFiscalYearSelect');
    if (repSelect && repSelect.value !== yearStr && Array.from(repSelect.options).some(o => o.value === yearStr)) {
      repSelect.value = yearStr;
    }

    const dynBudget = getDynamicReportsBudgetData(yearStr);
    const dynProj = getDynamicProjectStatusAnalytics(yearStr);
    const dynReq = getDynamicRequestTypeAnalytics(yearStr);
    const dynConcerns = getDynamicConcernsAnalytics(yearStr);

    // Always update HTML legends even before/independent of Chart canvas rendering
    const repProjLegend = document.getElementById('repProjectLegend');
    if (repProjLegend && dynProj) {
      const [cOngoing, cCompleted, cDelayed, cPlanning] = dynProj.data;
      repProjLegend.innerHTML = `
        <span class="legend-chip"><span class="legend-dot" style="background:#2563eb;"></span> Ongoing: <strong>${cOngoing}</strong></span>
        <span class="legend-chip"><span class="legend-dot" style="background:#10b981;"></span> Completed: <strong>${cCompleted}</strong></span>
        <span class="legend-chip"><span class="legend-dot" style="background:#e11d48;"></span> Delayed: <strong>${cDelayed}</strong></span>
        <span class="legend-chip"><span class="legend-dot" style="background:#94a3b8;"></span> Planning: <strong>${cPlanning}</strong></span>
      `;
    }

    const repReqLegend = document.getElementById('repRequestLegend');
    if (repReqLegend && dynReq) {
      repReqLegend.innerHTML = dynReq.shortLabels
        .map(
          (shortLbl, idx) =>
            `<span class="legend-chip"><span class="legend-dot" style="background:${dynReq.colors[idx]};"></span> ${escapeHtml(shortLbl)}: <strong>${dynReq.data[idx]}</strong></span>`
        )
        .join('');
    }

    if (typeof Chart === 'undefined') return;

    // 1. Budget vs Actual by Category (Dual Grouped Vertical Bar Chart — Live Synced)
    const ctxBudgetCat = document.getElementById('repBudgetCatChart');
    if (ctxBudgetCat) {
      if (repBudgetCatChart) {
        repBudgetCatChart.data.labels = dynBudget.budgetCategory.labels;
        repBudgetCatChart.data.datasets[0].data = dynBudget.budgetCategory.budget;
        repBudgetCatChart.data.datasets[1].data = dynBudget.budgetCategory.actual;
        repBudgetCatChart.update();
      } else {
        repBudgetCatChart = new Chart(ctxBudgetCat, {
          type: 'bar',
          data: {
            labels: dynBudget.budgetCategory.labels,
            datasets: [
              {
                label: 'Budget',
                data: dynBudget.budgetCategory.budget,
                backgroundColor: '#0b1e36',
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.65
              },
              {
                label: 'Actual',
                data: dynBudget.budgetCategory.actual,
                backgroundColor: '#f59e0b',
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.65
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'top',
                align: 'end',
                labels: {
                  boxWidth: 12,
                  font: { size: 11, weight: '600' },
                  color: '#475569'
                }
              },
              tooltip: {
                backgroundColor: '#0a2540',
                callbacks: {
                  label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrencyPHP(ctx.raw)}`
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { font: { size: 11, weight: '600' }, color: '#334155' }
              },
              y: {
                beginAtZero: true,
                grid: { color: '#f1f5f9' },
                ticks: {
                  callback: (val) => {
                    const num = Number(val) || 0;
                    if (num === 0) return '₱0';
                    return '₱' + Math.round(num / 1000).toLocaleString('en-PH') + 'k';
                  },
                  font: { size: 11 },
                  color: '#64748b'
                }
              }
            }
          }
        });
      }
    }

    // 2. Quarterly Budget Utilization (Multi-line / Area Chart — Live Synced)
    const ctxQuarterly = document.getElementById('repQuarterlyChart');
    if (ctxQuarterly) {
      if (repQuarterlyChart) {
        repQuarterlyChart.data.labels = dynBudget.quarterly.labels;
        repQuarterlyChart.data.datasets[0].data = dynBudget.quarterly.budget;
        repQuarterlyChart.data.datasets[1].data = dynBudget.quarterly.actual;
        repQuarterlyChart.update();
      } else {
        repQuarterlyChart = new Chart(ctxQuarterly, {
          type: 'line',
          data: {
            labels: dynBudget.quarterly.labels,
            datasets: [
              {
                label: 'Budget',
                data: dynBudget.quarterly.budget,
                borderColor: '#0b1e36',
                backgroundColor: 'rgba(11, 30, 54, 0.05)',
                borderWidth: 2.5,
                pointBackgroundColor: '#0b1e36',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.3
              },
              {
                label: 'Actual',
                data: dynBudget.quarterly.actual,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                borderWidth: 2.5,
                pointBackgroundColor: '#f59e0b',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.3
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'top',
                align: 'end',
                labels: {
                  boxWidth: 12,
                  font: { size: 11, weight: '600' },
                  color: '#475569'
                }
              },
              tooltip: {
                backgroundColor: '#0a2540',
                callbacks: {
                  label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrencyPHP(ctx.raw)}`
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { font: { size: 11, weight: '600' }, color: '#334155' }
              },
              y: {
                beginAtZero: true,
                grid: { color: '#f1f5f9' },
                ticks: {
                  callback: (val) => {
                    const num = Number(val) || 0;
                    if (num === 0) return '₱0';
                    return '₱' + Math.round(num / 1000).toLocaleString('en-PH') + 'k';
                  },
                  font: { size: 11 },
                  color: '#64748b'
                }
              }
            }
          }
        });
      }
    }

    // 3. Project Status Distribution (Donut Chart — Live Synced)
    const projEmpty = dynProj.data.every((n) => n === 0);
    const projChartLabels = projEmpty ? ['No Active Projects'] : dynProj.labels;
    const projChartData = projEmpty ? [1] : dynProj.data;
    const projChartColors = projEmpty ? ['#e2e8f0'] : dynProj.colors;

    const ctxProjStatus = document.getElementById('repProjectStatusChart');
    if (ctxProjStatus) {
      if (repProjectStatusChart) {
        repProjectStatusChart.projEmptyState = projEmpty;
        repProjectStatusChart.data.labels = projChartLabels;
        repProjectStatusChart.data.datasets[0].data = projChartData;
        repProjectStatusChart.data.datasets[0].backgroundColor = projChartColors;
        repProjectStatusChart.update();
      } else {
        repProjectStatusChart = new Chart(ctxProjStatus, {
          type: 'doughnut',
          data: {
            labels: projChartLabels,
            datasets: [
              {
                data: projChartData,
                backgroundColor: projChartColors,
                borderWidth: 2,
                borderColor: '#ffffff'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#0a2540',
                callbacks: {
                  label: (ctx) => {
                    if (ctx.chart.projEmptyState) return ' 0 projects recorded';
                    return ` ${ctx.label}: ${ctx.raw} project${ctx.raw !== 1 ? 's' : ''}`;
                  }
                }
              }
            }
          }
        });
        repProjectStatusChart.projEmptyState = projEmpty;
      }
    }

    // 4. Service Requests by Type (Donut Chart — Live Synced)
    const reqChartLabels = dynReq.isEmpty ? ['No Active Requests'] : dynReq.labels;
    const reqChartData = dynReq.isEmpty ? [1] : dynReq.data;
    const reqChartColors = dynReq.isEmpty ? ['#e2e8f0'] : dynReq.colors;

    const ctxReqType = document.getElementById('repRequestTypeChart');
    if (ctxReqType) {
      if (repRequestTypeChart) {
        repRequestTypeChart.reqDetails = dynReq.details;
        repRequestTypeChart.reqEmptyState = dynReq.isEmpty;
        repRequestTypeChart.data.labels = reqChartLabels;
        repRequestTypeChart.data.datasets[0].data = reqChartData;
        repRequestTypeChart.data.datasets[0].backgroundColor = reqChartColors;
        repRequestTypeChart.update();
      } else {
        repRequestTypeChart = new Chart(ctxReqType, {
          type: 'doughnut',
          data: {
            labels: reqChartLabels,
            datasets: [
              {
                data: reqChartData,
                backgroundColor: reqChartColors,
                borderWidth: 2,
                borderColor: '#ffffff'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#0a2540',
                callbacks: {
                  label: (ctx) => {
                    if (ctx.chart.reqEmptyState) return ' 0 active service requests';
                    const det = ctx.chart.reqDetails?.[ctx.dataIndex];
                    if (det && (det.readyOrCompleted > 0 || det.inReview > 0)) {
                      return ` ${ctx.label}: ${ctx.raw} request${ctx.raw !== 1 ? 's' : ''} (${det.readyOrCompleted} ready/released · ${det.inReview} in review)`;
                    }
                    return ` ${ctx.label}: ${ctx.raw} request${ctx.raw !== 1 ? 's' : ''}`;
                  }
                }
              }
            }
          }
        });
        repRequestTypeChart.reqDetails = dynReq.details;
        repRequestTypeChart.reqEmptyState = dynReq.isEmpty;
      }
    }

    // 5. Concerns by Category (Horizontal Bar Chart — Live Synced)
    const ctxConcerns = document.getElementById('repConcernsChart');
    if (ctxConcerns) {
      if (repConcernsChart) {
        repConcernsChart.concernDetails = dynConcerns.details;
        repConcernsChart.data.labels = dynConcerns.labels;
        repConcernsChart.data.datasets[0].data = dynConcerns.data;
        repConcernsChart.data.datasets[0].backgroundColor = dynConcerns.color;
        repConcernsChart.update();
      } else {
        repConcernsChart = new Chart(ctxConcerns, {
          type: 'bar',
          data: {
            labels: dynConcerns.labels,
            datasets: [
              {
                label: 'Reported Concerns',
                data: dynConcerns.data,
                backgroundColor: dynConcerns.color,
                borderRadius: 4,
                barPercentage: 0.65
              }
            ]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#0a2540',
                callbacks: {
                  label: (ctx) => {
                    const det = ctx.chart.concernDetails?.[ctx.dataIndex];
                    if (det && det.total > 0) {
                      return ` ${ctx.raw} recorded incident${ctx.raw !== 1 ? 's' : ''} (${det.open} open · ${det.resolved} resolved)`;
                    }
                    return ` ${ctx.raw} recorded incident${ctx.raw !== 1 ? 's' : ''}`;
                  }
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: '#f1f5f9' },
                ticks: {
                  stepSize: 1,
                  precision: 0,
                  font: { size: 11 },
                  color: '#64748b'
                }
              },
              y: {
                grid: { display: false },
                ticks: { font: { size: 11.5, weight: '600' }, color: '#334155' }
              }
            }
          }
        });
        repConcernsChart.concernDetails = dynConcerns.details;
      }
    }

    syncAuxiliaryCharts(yearStr);
  }

  function refreshAdminDashboard(year) {
    initOrUpdateReportsCharts(year || getActiveDashboardYear());
  }

  function initReportsFiscalYearListener() {
    const dashYearSelect = document.getElementById('dashboardFiscalYearSelect');
    if (dashYearSelect) {
      dashYearSelect.addEventListener('change', function () {
        const yr = this.value;
        initOrUpdateReportsCharts(yr);
        showAdminToast('Dashboard Updated', `Displaying consolidated analytics for FY ${yr}.`, 'info');
      });
    }

    const yearSelect = document.getElementById('reportsFiscalYearSelect');
    if (yearSelect) {
      yearSelect.addEventListener('change', function () {
        const yr = this.value;
        initOrUpdateReportsCharts(yr);
        showAdminToast('Reports Updated', `Displaying consolidated analytics for FY ${yr}.`, 'info');
      });
    }

    const btnGoToDashboard = document.getElementById('btnGoToDashboard');
    if (btnGoToDashboard) {
      btnGoToDashboard.addEventListener('click', () => {
        switchView('overview');
        setTimeout(() => {
          const el = document.getElementById('dashboardAnalyticsSection');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      });
    }
  }

  function computeMonthlyBurnSeries(year = '2026') {
    const records = (adminBudgetRecords || []).filter(
      (r) => isApplicableBudgetRecord(r) && (year === 'all' || String(r.year) === String(year))
    );
    const totalBudget = records.reduce((s, r) => s + (Number(r.budget) || 0), 0);
    const qSpent = ['Q1', 'Q2', 'Q3', 'Q4'].map((q) =>
      records.filter((r) => r.quarter === q).reduce((s, r) => s + (Number(r.actual) || 0), 0)
    );
    const monthlySeries = [
      Math.round(qSpent[0] * 0.31),
      Math.round(qSpent[0] * 0.34),
      Math.max(0, qSpent[0] - Math.round(qSpent[0] * 0.31) - Math.round(qSpent[0] * 0.34)),
      Math.round(qSpent[1] * 0.33),
      Math.round(qSpent[1] * 0.32),
      Math.max(0, qSpent[1] - Math.round(qSpent[1] * 0.33) - Math.round(qSpent[1] * 0.32)),
      Math.round(qSpent[2] * 0.34),
      Math.round(qSpent[2] * 0.33),
      Math.max(0, qSpent[2] - Math.round(qSpent[2] * 0.34) - Math.round(qSpent[2] * 0.33)),
      Math.round(qSpent[3] * 0.34),
      Math.round(qSpent[3] * 0.33),
      Math.max(0, qSpent[3] - Math.round(qSpent[3] * 0.34) - Math.round(qSpent[3] * 0.33))
    ];
    const monthlyBenchmark = Math.round(totalBudget / 12);
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      monthlySeries,
      benchmarkSeries: Array(12).fill(monthlyBenchmark),
      monthlyBenchmark
    };
  }

  function updateBudgetBurnChart(year = '2026') {
    if (!budgetBurnChart) return;
    const burn = computeMonthlyBurnSeries(year);
    const benchLabelK = Math.round(burn.monthlyBenchmark / 1000).toLocaleString('en-PH');
    budgetBurnChart.data.labels = burn.labels;
    budgetBurnChart.data.datasets[0].data = burn.monthlySeries;
    budgetBurnChart.data.datasets[1].label = `Sustainable Monthly Benchmark (₱${benchLabelK}k)`;
    budgetBurnChart.data.datasets[1].data = burn.benchmarkSeries;
    budgetBurnChart.update();

    const sub = document.getElementById('adminBurnChartSubtitle');
    if (sub) {
      sub.textContent =
        year === 'all'
          ? 'Monthly disbursement trajectory across all active fiscal years'
          : `Monthly disbursement trajectory derived from FY ${year} budget records`;
    }
  }

  // Chart 4: Budget Disbursement Burn Rate Chart (Fiscal)
  function initBudgetBurnChart() {
    const ctx = document.getElementById('budgetBurnChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const burn = computeMonthlyBurnSeries('2026');
    const benchLabelK = Math.round(burn.monthlyBenchmark / 1000).toLocaleString('en-PH');

    budgetBurnChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: burn.labels,
        datasets: [
          {
            label: 'Monthly Actual Disbursement (₱)',
            data: burn.monthlySeries,
            borderColor: '#0d47a1',
            backgroundColor: 'rgba(13, 71, 161, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: 3
          },
          {
            label: `Sustainable Monthly Benchmark (₱${benchLabelK}k)`,
            data: burn.benchmarkSeries,
            borderColor: '#94a3b8',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { font: { size: 10.5 }, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: '#0a2540',
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${formatCurrencyPHP(context.raw)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => {
                const num = Number(val) || 0;
                if (num === 0) return '₱0';
                return '₱' + Math.round(num / 1000).toLocaleString('en-PH') + 'k';
              }
            }
          }
        }
      }
    });
  }

  // Initialize all charts
  initDocVolumeChart();
  initIncidentCategoryChart();
  initBudgetBurnChart();
  initOrUpdateReportsCharts('2026');
  initReportsFiscalYearListener();

  // ==============================================================
  // 6. OVERVIEW ACTIVE OPERATIONAL QUEUE PREVIEW
  // ==============================================================
  function renderOverviewQueue() {
    const listEl = document.getElementById('overviewQueueList');
    if (!listEl) return;

    // Show top 5 urgent / review items
    const pendingItems = serviceRequests
      .filter(r => r.status === 'In Review' || r.status === 'Ready for Pickup')
      .slice(0, 5);

    listEl.innerHTML = '';
    pendingItems.forEach(item => {
      const isReady = item.status === 'Ready for Pickup';
      const statusBadge = isReady
        ? '<span class="badge-status green">Ready for Pickup</span>'
        : '<span class="badge-status yellow">In Review</span>';

      const row = document.createElement('div');
      row.className = 'queue-row-item';
      row.innerHTML = `
        <div class="queue-item-left">
          <span class="queue-doc-name">${escapeHtml(item.docType)}</span>
          <span class="queue-applicant">${escapeHtml(item.resident)} · ${escapeHtml(item.sitio)} (${escapeHtml(item.id)})</span>
        </div>
        <div class="queue-item-right">
          ${statusBadge}
          <button type="button" class="btn-table-action primary btn-quick-inspect" data-id="${item.id}">Inspect</button>
        </div>
      `;
      listEl.appendChild(row);
    });

    // Bind inspect button in overview
    listEl.querySelectorAll('.btn-quick-inspect').forEach(btn => {
      btn.addEventListener('click', function () {
        const reqId = this.getAttribute('data-id');
        openRequestDetailModal(reqId);
      });
    });
  }
  renderOverviewQueue();

  // ==============================================================
  // 7. SERVICE REQUESTS DESK TABLE & MANAGEMENT
  function renderRequestsTable() {
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) return;

    const filtered = serviceRequests.filter(req => {
      const matchesStatus = currentReqStatusFilter === 'all' || req.status === currentReqStatusFilter;
      const matchesCat =
        currentReqCategoryFilter === 'all' ||
        req.docType === currentReqCategoryFilter ||
        req.documentType === currentReqCategoryFilter ||
        classifyServiceRequestType(req.docType || req.documentType).key === classifyServiceRequestType(currentReqCategoryFilter).key;
      const searchLower = currentReqSearch.toLowerCase();
      const matchesSearch = !currentReqSearch ||
        req.id.toLowerCase().includes(searchLower) ||
        (req.fullName && req.fullName.toLowerCase().includes(searchLower)) ||
        (req.resident && req.resident.toLowerCase().includes(searchLower)) ||
        (req.sitio && req.sitio.toLowerCase().includes(searchLower)) ||
        (req.docType && req.docType.toLowerCase().includes(searchLower)) ||
        (req.documentType && req.documentType.toLowerCase().includes(searchLower)) ||
        (req.purpose && req.purpose.toLowerCase().includes(searchLower));

      return matchesStatus && matchesCat && matchesSearch;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 36px 20px; color: #64748b;">
            <div style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">No service requests found</div>
            <div style="font-size: 12px; color: #94a3b8;">Try adjusting your status filter or search keywords.</div>
          </td>
        </tr>
      `;
      updateRequestsCounter(0);
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');

      let statusBadge = '';
      if (item.status === 'Ready for Pickup') {
        statusBadge = '<span class="badge-status green">Ready for Pickup</span>';
      } else if (item.status === 'In Review' || item.status === 'Pending') {
        statusBadge = '<span class="badge-status yellow">In Review</span>';
      } else if (item.status === 'Completed' || item.status === 'Approved') {
        statusBadge = '<span class="badge-status blue">Completed</span>';
      } else if (item.status === 'Rejected') {
        statusBadge = '<span class="badge-status red">Rejected</span>';
      } else {
        statusBadge = `<span class="badge-status gray">${escapeHtml(item.status)}</span>`;
      }

      // Action buttons: Icon-only Print Certificate button and Inspect
      let actionButtons = `
        <div class="table-actions">
          <button type="button" class="btn-table-action btn-print-cert icon-only" data-id="${item.id}" title="Print Certificate (Ctrl+P)" aria-label="Print Certificate">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
          </button>
          <button type="button" class="btn-table-action btn-inspect-req" data-id="${item.id}" title="Inspect full application">Inspect</button>
      `;

      if (item.status === 'In Review') {
        actionButtons += `
          <button type="button" class="btn-table-action success-fill btn-approve-req" data-id="${item.id}" title="Approve & Set Ready">Ready &rarr;</button>
          <button type="button" class="btn-table-action danger-text btn-reject-req" data-id="${item.id}" title="Reject application">Reject</button>
        `;
      } else if (item.status === 'Ready for Pickup') {
        actionButtons += `
          <button type="button" class="btn-table-action primary btn-claim-req" data-id="${item.id}" title="Mark as Claimed / Completed">Claimed</button>
        `;
      }

      actionButtons += `</div>`;

      // 6 Strict Columns: Request ID, Resident Name, Certificate Type, Status, Date Requested, Actions
      tr.innerHTML = `
        <td><strong><code>${escapeHtml(item.id)}</code></strong></td>
        <td>
          <div style="font-weight: 600; color: #0f172a;">${escapeHtml(item.fullName || item.resident)}</div>
          <div style="font-size: 11px; color: #64748b;">${escapeHtml(item.purokSitio || item.sitio)} &bull; ${escapeHtml(item.contact || '')}</div>
        </td>
        <td>
          <strong style="color: #0f172a;">${escapeHtml(item.documentType || item.docType)}</strong>
          <div style="font-size: 11px; color: #64748b;" title="${escapeHtml(item.purpose)}">${truncate(item.purpose, 36)}</div>
        </td>
        <td>${statusBadge}</td>
        <td><span style="font-size: 11.5px; color: #334155; font-weight: 500;">${escapeHtml(item.dateFiled || item.date)}</span></td>
        <td class="text-right">${actionButtons}</td>
      `;

      tbody.appendChild(tr);
    });

    updateRequestsCounter(filtered.length);
    bindRequestRowEvents();
  }

  function updateRequestsCounter(count) {
    const info = document.getElementById('requestsPaginationInfo');
    if (info) info.textContent = `Showing ${count} application records`;

    // Update KPI and filter pills
    const allCount = serviceRequests.length;
    const reviewCount = serviceRequests.filter(r => r.status === 'In Review').length;
    const readyCount = serviceRequests.filter(r => r.status === 'Ready for Pickup').length;
    const doneCount = serviceRequests.filter(r => r.status === 'Completed').length;
    const rejectCount = serviceRequests.filter(r => r.status === 'Rejected').length;

    const cntAll = document.getElementById('cntReqAll');
    const cntReview = document.getElementById('cntReqReview');
    const cntReady = document.getElementById('cntReqReady');
    const cntDone = document.getElementById('cntReqDone');
    const cntReject = document.getElementById('cntReqRejected');
    const navCounter = document.getElementById('navCounterRequests');

    if (cntAll) cntAll.textContent = allCount;
    if (cntReview) cntReview.textContent = reviewCount;
    if (cntReady) cntReady.textContent = readyCount;
    if (cntDone) cntDone.textContent = doneCount;
    if (cntReject) cntReject.textContent = rejectCount;
    if (navCounter) navCounter.textContent = reviewCount + readyCount;

    refreshAdminDashboard();
  }

  function bindRequestRowEvents() {
    // Print Certificate button (Icon-only, opens print dialog directly like Ctrl+P)
    document.querySelectorAll('.btn-print-cert').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const id = this.getAttribute('data-id');
        const item = serviceRequests.find(r => r.id === id);
        if (item) {
          openPrintModal(item, true); // Triggers print dialog like Ctrl+P!
        }
      });
    });

    // Inspect button
    document.querySelectorAll('.btn-inspect-req').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-id');
        openRequestDetailModal(id);
      });
    });

    // Direct approve / Ready for Pickup button
    document.querySelectorAll('.btn-approve-req').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-id');
        setRequestStatus(id, 'Ready for Pickup');
      });
    });

    // Reject button
    document.querySelectorAll('.btn-reject-req').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-id');
        setRequestStatus(id, 'Rejected');
      });
    });

    // Claimed / Completed button
    document.querySelectorAll('.btn-claim-req').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-id');
        setRequestStatus(id, 'Completed');
      });
    });
  }

  // ==============================================================
  // OFFICIAL DOCUMENT CERTIFICATION TEMPLATES & DYNAMIC PRINT ENGINE
  // Barangay Pallocan Kanluran, Batangas City
  // ==============================================================
  const CERTIFICATE_TEMPLATES = {
    CLEARANCE: {
      title: 'BARANGAY CLEARANCE',
      render: (d) => `
        <div class="salutation-block">TO WHOM IT MAY CONCERN:</div>
        <p class="cert-paragraph">
          This is to certify that <strong class="doc-field-text font-bold" data-field="fullName">${escapeHtml(d.fullName)}</strong>, <span class="doc-field-text" data-field="age">${escapeHtml(d.age)}</span> years old, and a bona fide resident of <span class="doc-field-text" data-field="address">${escapeHtml(d.address)}</span>, Purok/Sitio <strong class="doc-field-text font-bold" data-field="purokSitio">${escapeHtml(d.purokSitio)}</strong>, Barangay Pallocan Kanluran, Batangas City, Batangas Province, is known to this office as a resident of this barangay.
        </p>
        <p class="cert-paragraph">
          This certification is issued upon the request of the above-named person for <strong class="doc-field-text font-bold" data-field="purpose">${escapeHtml(d.purpose)}</strong>.
        </p>
        <p class="cert-paragraph">
          Issued this <strong class="doc-field-text font-bold" data-field="date">${escapeHtml(d.date)}</strong> at Barangay Pallocan Kanluran, Batangas City, Batangas Province.
        </p>
      `
    },
    RESIDENCY: {
      title: 'CERTIFICATE OF RESIDENCY',
      render: (d) => `
        <div class="salutation-block">TO WHOM IT MAY CONCERN:</div>
        <p class="cert-paragraph">
          This is to certify that <strong class="doc-field-text font-bold" data-field="fullName">${escapeHtml(d.fullName)}</strong>, <span class="doc-field-text" data-field="age">${escapeHtml(d.age)}</span> years old, is a resident of <span class="doc-field-text" data-field="address">${escapeHtml(d.address)}</span>, Purok/Sitio <strong class="doc-field-text font-bold" data-field="purokSitio">${escapeHtml(d.purokSitio)}</strong>, Barangay Pallocan Kanluran, Batangas City, Batangas Province.
        </p>
        <p class="cert-paragraph">
          According to the records available to this office, the above-named person has been residing in this barangay since <strong class="doc-field-text font-bold" data-field="residencySince">${escapeHtml(d.residencySince)}</strong>.
        </p>
        <p class="cert-paragraph">
          This certification is issued upon request for <strong class="doc-field-text font-bold" data-field="purpose">${escapeHtml(d.purpose)}</strong>.
        </p>
        <p class="cert-paragraph">
          Issued this <strong class="doc-field-text font-bold" data-field="date">${escapeHtml(d.date)}</strong> at Barangay Pallocan Kanluran, Batangas City, Batangas Province.
        </p>
      `
    },
    INDIGENCY: {
      title: 'CERTIFICATE OF INDIGENCY',
      render: (d) => `
        <div class="salutation-block">TO WHOM IT MAY CONCERN:</div>
        <p class="cert-paragraph">
          This is to certify that <strong class="doc-field-text font-bold" data-field="fullName">${escapeHtml(d.fullName)}</strong>, <span class="doc-field-text" data-field="age">${escapeHtml(d.age)}</span> years old, is a resident of <span class="doc-field-text" data-field="address">${escapeHtml(d.address)}</span>, Purok/Sitio <strong class="doc-field-text font-bold" data-field="purokSitio">${escapeHtml(d.purokSitio)}</strong>, Barangay Pallocan Kanluran, Batangas City, Batangas Province.
        </p>
        <p class="cert-paragraph">
          This certification is issued upon the request of the above-named person for <strong class="doc-field-text font-bold" data-field="purpose">${escapeHtml(d.purpose)}</strong>.
        </p>
        <p class="cert-paragraph">
          Issued this <strong class="doc-field-text font-bold" data-field="date">${escapeHtml(d.date)}</strong> at Barangay Pallocan Kanluran, Batangas City, Batangas Province.
        </p>
      `
    },
    JOBSEEKER: {
      title: 'CERTIFICATION FOR FIRST-TIME JOB SEEKER',
      render: (d) => `
        <div class="salutation-block">TO WHOM IT MAY CONCERN:</div>
        <p class="cert-paragraph">
          This is to certify that <strong class="doc-field-text font-bold" data-field="fullName">${escapeHtml(d.fullName)}</strong>, <span class="doc-field-text" data-field="age">${escapeHtml(d.age)}</span> years old, a resident of <span class="doc-field-text" data-field="address">${escapeHtml(d.address)}</span>, Purok/Sitio <strong class="doc-field-text font-bold" data-field="purokSitio">${escapeHtml(d.purokSitio)}</strong>, Barangay Pallocan Kanluran, Batangas City, Batangas Province, has requested this certification in connection with their application for employment.
        </p>
        <p class="cert-paragraph">
          The certification is issued for the purpose of <strong class="doc-field-text font-bold" data-field="purpose">${escapeHtml(d.purpose)}</strong>.
        </p>
        <p class="cert-paragraph">
          Issued this <strong class="doc-field-text font-bold" data-field="date">${escapeHtml(d.date)}</strong> at Barangay Pallocan Kanluran, Batangas City, Batangas Province.
        </p>
      `
    },
    BUSINESS: {
      title: 'BARANGAY BUSINESS CLEARANCE',
      render: (d) => `
        <div class="salutation-block">TO WHOM IT MAY CONCERN:</div>
        <p class="cert-paragraph">
          This is to certify that <strong class="doc-field-text font-bold" data-field="businessName">${escapeHtml(d.businessName)}</strong>, owned/operated by <strong class="doc-field-text font-bold" data-field="fullName">${escapeHtml(d.fullName)}</strong>, <span class="doc-field-text" data-field="age">${escapeHtml(d.age)}</span> years old, with business address at <span class="doc-field-text" data-field="businessAddress">${escapeHtml(d.businessAddress)}</span>, Barangay Pallocan Kanluran, Batangas City, Batangas Province, has applied for a Barangay Business Clearance.
        </p>
        <div class="cert-business-specs">
          <div class="business-spec-line">
            <span class="spec-label">Nature of Business:</span>
            <span class="doc-field-text font-bold" data-field="natureOfBusiness">${escapeHtml(d.natureOfBusiness)}</span>
          </div>
          <div class="business-spec-line">
            <span class="spec-label">Business Type:</span>
            <span class="doc-field-text font-bold" data-field="businessType">${escapeHtml(d.businessType)}</span>
          </div>
          <div class="business-spec-line">
            <span class="spec-label">Number of Employees:</span>
            <span class="doc-field-text font-bold" data-field="numberOfEmployees">${escapeHtml(d.numberOfEmployees)}</span>
          </div>
        </div>
        <p class="cert-paragraph" style="margin-top: 18px;">
          This clearance is issued subject to applicable barangay requirements and regulations.
        </p>
        <p class="cert-paragraph">
          Issued this <strong class="doc-field-text font-bold" data-field="date">${escapeHtml(d.date)}</strong> at Barangay Pallocan Kanluran, Batangas City, Batangas Province.
        </p>
      `
    }
  };

  function formatDateForCert(dateStr) {
    if (!dateStr) return 'October 11, 2026';
    const clean = String(dateStr).trim();
    if (/^[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(clean)) {
      return clean;
    }
    try {
      const d = new Date(clean);
      if (isNaN(d.getTime())) return clean;
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    } catch {
      return clean;
    }
  }

  // Calculate resident age from date of birth
function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return '';

    const datePart = String(dateOfBirth).slice(0, 10);
    const parts = datePart.split('-').map(Number);

    if (
        parts.length !== 3 ||
        parts.some(part => !Number.isFinite(part))
    ) {
        return '';
    }

    const [year, month, day] = parts;
    const today = new Date();

    let age = today.getFullYear() - year;

    if (
        today.getMonth() + 1 < month ||
        (
            today.getMonth() + 1 === month &&
            today.getDate() < day
        )
    ) {
        age--;
    }

    return age >= 0 ? age : '';
}

  function openPrintModal(data, triggerPrint = false) {
    if (!data) return;
    const modal = document.getElementById('printModal');
    if (!modal) return;

    // Match data.documentType to select the right template block
    const docTypeStr = (data.documentType || data.docType || '').toLowerCase();
    let templateKey = 'CLEARANCE';

    if (docTypeStr.includes('business') || docTypeStr.includes('permit')) {
      templateKey = 'BUSINESS';
    } else if (docTypeStr.includes('job') || docTypeStr.includes('seeker') || docTypeStr.includes('first-time')) {
      templateKey = 'JOBSEEKER';
    } else if (docTypeStr.includes('indigency')) {
      templateKey = 'INDIGENCY';
    } else if (docTypeStr.includes('residency')) {
      templateKey = 'RESIDENCY';
    } else {
      templateKey = 'CLEARANCE';
    }

    const tpl = CERTIFICATE_TEMPLATES[templateKey];

    // Populate certificate fields using actual service request data
    const fullName = data.fullName || data.resident || '';
    const age = calculateAge(data.date_of_birth) || data.age || '';
    const purokSitio = data.purokSitio || data.sitio || '';
    const address = data.address || '';
    const purpose = data.purpose || '';
    const rawDate = data.date || data.dateFiled || '';
    const date = rawDate ? formatDateForCert(rawDate) : '';
    const residencySince = data.residencySince || '';
    const businessName = data.businessName || '';
    const businessAddress = data.businessAddress || '';
    const natureOfBusiness = data.natureOfBusiness || '';
    const businessType = data.businessType || '';
    const numberOfEmployees = data.numberOfEmployees || '';

    const viewModel = {
      fullName,
      age,
      address,
      purokSitio,
      purpose,
      date,
      residencySince,
      businessName,
      businessAddress,
      natureOfBusiness,
      businessType,
      numberOfEmployees,
      id: data.id || 'REQ-2026-08492'
    };

    // Update document titles and control metadata
    const certDocTitle = document.getElementById('certDocumentTitle');
    if (certDocTitle) certDocTitle.textContent = tpl.title;

    const printModalTitle = document.getElementById('printModalTitle');
    if (printModalTitle) printModalTitle.textContent = `${tpl.title} · ${fullName}`;

    const certControlNo = document.getElementById('certControlNo');
    if (certControlNo) certControlNo.textContent = (data.id || 'REQ-000').replace('REQ-', 'PK-CERT-');

    const certDateFiled = document.getElementById('certDateFiled');
    if (certDateFiled) certDateFiled.textContent = rawDate;

    const certIssuedDate = document.getElementById('certIssuedDate');
    if (certIssuedDate) certIssuedDate.textContent = date;

    // Dynamically render body
    const bodyContainer = document.getElementById('certBodyContainer');
    if (bodyContainer) {
      bodyContainer.innerHTML = tpl.render(viewModel);
    }

    // Show modal overlay
    modal.removeAttribute('hidden');
    modal.classList.add('active');
    document.body.classList.add('print-modal-open');

    // Accessibility focus on print button
    const btnPrint = document.getElementById('btnPrintDocument');
    if (btnPrint) btnPrint.focus();

    // Trigger browser print dialog directly like Ctrl+P
    if (triggerPrint) {
      setTimeout(() => {
        window.print();
      }, 100);
    }
  }

  function closePrintModal() {
    const modal = document.getElementById('printModal');
    if (!modal) return;
    modal.setAttribute('hidden', '');
    modal.classList.remove('active');
    document.body.classList.remove('print-modal-open');
  }

  // Bind close buttons and escape key
  const btnClosePrintModal = document.getElementById('btnClosePrintModal');
  if (btnClosePrintModal) {
    btnClosePrintModal.addEventListener('click', closePrintModal);
  }

  const printModalOverlay = document.getElementById('printModal');
  if (printModalOverlay) {
    printModalOverlay.addEventListener('click', function (e) {
      if (e.target === printModalOverlay) {
        closePrintModal();
      }
    });
  }

  const btnPrintDocument = document.getElementById('btnPrintDocument');
  if (btnPrintDocument) {
    btnPrintDocument.addEventListener('click', function () {
      window.print();
    });
  }

  // Global Escape & Ctrl+P Key Listener for Modals
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      const pModal = document.getElementById('printModal');
      if (pModal && (!pModal.hasAttribute('hidden') || pModal.classList.contains('active'))) {
        closePrintModal();
      }
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      const pModal = document.getElementById('printModal');
      if (pModal && (!pModal.hasAttribute('hidden') || pModal.classList.contains('active'))) {
        e.preventDefault();
        window.print();
      }
    }
  });

  // Expose globally for testing & external module triggers
  window.openPrintModal = openPrintModal;
  window.closePrintModal = closePrintModal;

  function pushScopedUserNotification(targetEmail, notifEntry) {
    try {
      const cleanEmail = String(targetEmail || '').trim().toLowerCase();
      const storageKey = cleanEmail ? `brgy360_notifs_${cleanEmail}` : null;
      if (!storageKey) return;

      const rawNotifs = localStorage.getItem(storageKey);
      const notifs = rawNotifs ? JSON.parse(rawNotifs) : [];
      if (!Array.isArray(notifs)) return;

      notifs.unshift(notifEntry);
      localStorage.setItem(storageKey, JSON.stringify(notifs));
    } catch (err) {
      console.warn('Notification sync warning:', err);
    }
  }

  async function setRequestStatus(id, newStatus) {
  const req = serviceRequests.find(r => r.id === id || r.ref === id);
  if (!req) return;

  if (!req.requestId) {
    showAdminToast(
      'Unable to Update Request',
      'This request has no database ID. Refresh the request list and try again.',
      'danger'
    );
    return;
  }

  try {
    const response = await fetch(
      `${ADMIN_API_BASE}/admin/requests/${encodeURIComponent(req.requestId)}/status`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          request_status: newStatus
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to update request status.');
    }

    // Update the admin screen only after the database confirms success
    req.status = newStatus;

    if (newStatus === 'Ready for Pickup') {
      req.notes = 'Document prepared and sealed. Ready for physical collection at Barangay Hall Window 2.';
      req.claimTarget = 'Available for pickup today';
    } else if (newStatus === 'Completed') {
      req.notes = 'Document officially issued and claimed by resident.';
      req.claimTarget = 'Claimed';
    } else if (newStatus === 'Rejected') {
      req.notes = 'Application rejected by Barangay Secretary. Please contact the barangay hall for details.';
    }

    if (req.userEmail) {
      pushScopedUserNotification(req.userEmail, {
        id: Date.now(),
        title: `Request ${newStatus}`,
        desc: `Your ${req.docType || req.documentType} (${req.ref || req.id}) is now marked "${newStatus}".`,
        time: 'Just now',
        unread: true,
        type: newStatus === 'Rejected' ? 'amber' : (newStatus === 'Completed' ? 'green' : 'blue')
      });
    }

    renderRequestsTable();
    renderOverviewQueue();
    updateRequestsCounter(serviceRequests.length);
    persistServiceRequests();

    if (newStatus === 'Ready for Pickup') {
      showAdminToast(
        'Request Ready for Claim',
        `${req.docType || req.documentType} for ${req.resident || req.fullName} marked ready.`,
        'success'
      );
    } else if (newStatus === 'Rejected') {
      showAdminToast(
        'Application Rejected',
        `Notice of rejection logged for ${req.resident || req.fullName}.`,
        'danger'
      );
    } else if (newStatus === 'Completed') {
      showAdminToast(
        'Document Claimed',
        `${req.docType || req.documentType} officially issued and marked completed.`,
        'success'
      );
    }

  } catch (error) {
    console.error('Error updating service request status:', error, {
      requestId: req?.requestId,
      attemptedStatus: newStatus,
      endpoint: `${ADMIN_API_BASE}/admin/requests/${req?.requestId}/status`
    });

    showAdminToast(
      'Status Update Failed',
      error.message || 'Could not update the request. Please try again.',
      'danger'
    );
  }
}

  // Request Search and Filter bindings
  const requestsSearchInput = document.getElementById('requestsSearchInput');
  if (requestsSearchInput) {
    requestsSearchInput.addEventListener('input', function () {
      currentReqSearch = this.value.trim();
      renderRequestsTable();
    });
  }

  const reqStatusPills = document.querySelectorAll('#requestsStatusFilterGroup .filter-pill');
  reqStatusPills.forEach(pill => {
    pill.addEventListener('click', function () {
      reqStatusPills.forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      currentReqStatusFilter = this.getAttribute('data-status');
      renderRequestsTable();
    });
  });

  const reqDocTypeSelect = document.getElementById('reqDocTypeSelect');
  if (reqDocTypeSelect) {
    reqDocTypeSelect.addEventListener('change', function () {
      currentReqCategoryFilter = this.value;
      renderRequestsTable();
    });
  }

  // Load service requests from the backend database
  loadServiceRequestsFromBackend();

  // Export CSV
  const btnExportRequests = document.getElementById('btnExportRequests');
  if (btnExportRequests) {
    btnExportRequests.addEventListener('click', exportRequestsCSV);
  }

  function exportRequestsCSV() {
    const headers = ['Reference ID', 'Resident Applicant', 'Sitio/Purok', 'Document Type', 'Purpose', 'Date Filed', 'Status', 'Contact Number'];
    const rows = serviceRequests.map(r => [
      r.id,
      `"${r.resident}"`,
      `"${r.sitio}"`,
      `"${r.docType}"`,
      `"${r.purpose}"`,
      r.dateFiled,
      r.status,
      r.contact
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Brgy360_Document_Requests_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showAdminToast('CSV Export Generated', 'Official Document Processing log has been downloaded.', 'info');
  }

    // ==============================================================
  // GOVERNANCE DOSSIER EXCEL EXPORT
  // ==============================================================

  async function exportGovernanceDossier() {
    try {
      showAdminToast(
        'Preparing Governance Dossier',
        'Retrieving the latest barangay records...',
        'info'
      );

      // Retrieve the latest database records.
      await Promise.all([
        loadServiceRequestsFromBackend(),
        loadProjectsFromDatabase(),
        loadCitizenProposalsFromDatabase(),
        loadAdminBudgetRecordsFromDatabase(),
        loadResidentApplicationsFromAPI(),
        loadConcernsFromAPI()
      ]);

      const datasets = [
        {
          name: 'Budget Records',
          records: adminBudgetRecords
        },
        {
          name: 'Capital Projects',
          records: capitalProjects
        },
        {
          name: 'Community Concerns',
          records: incidentTickets
        },
        {
          name: 'Document Requests',
          records: serviceRequests
        },
        {
          name: 'Project Proposals',
          records: citizenProposals
        },
        {
          name: 'Resident Statistics',
          records: residentApplications
        }
      ];

      // Escape XML characters for Excel.
      function escapeExcelXml(value) {
        return String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      }

      // Convert each dataset into a formatted, privacy-conscious Excel worksheet.
      function createWorksheet(name, records) {
        const cleanRecords = Array.isArray(records)
          ? records.filter(record => record && typeof record === 'object')
          : [];

        const worksheetName = String(name || '').trim().toLowerCase();

        // Select only the fields appropriate for each governance worksheet.
        const columnDefinitions = {
          'budget records': [
            ['Fiscal Year', ['year']],
            ['Quarter', ['quarter']],
            ['Budget Category', ['category']],
            ['Description', ['description']],
            ['Allocated Budget', ['budget']],
            ['Actual Expenses', ['actual']],
            ['Remarks', ['remarks']],
            ['Record Status', ['status']]
          ],

          'projects': [
            ['Project Code', ['code', 'id']],
            ['Project Title', ['title']],
            ['Project Description', ['description']],
            ['Project Location', ['location']],
            ['Project Timeline', ['timeline']],
            ['Fiscal Year', ['year']],
            ['Allocated Budget', ['budget']],
            ['Progress (%)', ['progress']],
            ['Project Status', ['status']]
          ],

          'capital projects': [
            ['Project Code', ['code', 'id']],
            ['Project Title', ['title']],
            ['Project Description', ['description']],
            ['Project Location', ['location']],
            ['Project Timeline', ['timeline']],
            ['Fiscal Year', ['year']],
            ['Allocated Budget', ['budget']],
            ['Progress (%)', ['progress']],
            ['Project Status', ['status']]
          ],

          'community concerns': [
            ['Concern Reference', ['id', 'concern_id']],
            ['Concern Title', ['title']],
            ['Category', ['category']],
            ['Urgency Level', ['urgency']],
            ['Sitio / Area', ['sitio']],
            ['Incident Location', ['location']],
            ['Date Submitted', ['dateFiled']],
            ['Concern Status', ['status']],
            ['Resolution Notes', ['resolutionNote']]
          ],

          'document requests': [
            ['Request Reference', ['id', 'request_id']],
            ['Document Type', ['docType', 'document_type']],
            ['Purpose', ['purpose']],
            ['Sitio / Area', ['sitio']],
            ['Date Filed', ['dateFiled', 'date_requested']],
            ['Request Status', ['status']]
          ],

          'project proposals': [
            ['Proposal Reference', ['proposalId', 'ref', 'id']],
            ['Project Title', ['title']],
            ['Sector Category', ['category']],
            ['Fiscal Year', ['year']],
            ['Proposed Location', ['location']],
            ['Estimated Budget', ['rawBudget', 'budget']],
            ['Proposed Timeline', ['timeline']],
            ['Community Rationale', ['rationale', 'description']],
            ['Council Review Notes', ['councilNotes']],
            ['Proposal Status', ['status']],
            ['Date Submitted', ['dateFiled']]
          ]
        };

        // Resident Statistics contains aggregate figures only.
        // Individual resident names and personal information are not exported.
        if (worksheetName === 'resident statistics') {
          const total = residentApplications.length;
          const verified = countStatus(residentApplications, 'Verified');
          const pending = countStatus(residentApplications, 'Pending');
          const rejected = countStatus(residentApplications, 'Rejected');

          const residentRows = [
            ['Resident Indicator', 'Value'],
            ['Total Registered Residents', total],
            ['Verified Residents', verified],
            ['Verification Rate', formatPercent(verified, total)],
            ['Pending Applications', pending],
            ['Rejected Applications', rejected],
            [
              'Other Verification Statuses',
              Math.max(0, total - verified - pending - rejected)
            ]
          ];

          const rows = residentRows.map((row, index) => `
            <Row ss:Height="21">
              <Cell ss:StyleID="${index === 0 ? 'TableHeader' : 'TableCell'}">
                <Data ss:Type="String">${escapeExcelXml(row[0])}</Data>
              </Cell>
              <Cell ss:StyleID="${index === 0 ? 'TableHeader' : 'TableCell'}">
                <Data ss:Type="String">${escapeExcelXml(row[1])}</Data>
              </Cell>
            </Row>
          `).join('');

          return `
            <Worksheet ss:Name="${escapeExcelXml(name)}">
              <Table>
                <Column ss:Width="260"/>
                <Column ss:Width="180"/>
                ${rows}
              </Table>
            </Worksheet>
          `;
        }

        const columns = columnDefinitions[worksheetName] || [];

        let rows = '';

        if (columns.length > 0 && cleanRecords.length > 0) {
          // Header row.
          rows += `
            <Row ss:Height="30">
              ${columns.map(([label]) => `
                <Cell ss:StyleID="TableHeader">
                  <Data ss:Type="String">${escapeExcelXml(label)}</Data>
                </Cell>
              `).join('')}
            </Row>
          `;

          // Data rows.
          cleanRecords.forEach(record => {
            rows += `
              <Row ss:Height="24">
                ${columns.map(([, aliases]) => {
                  const field = aliases.find(alias =>
                    Object.prototype.hasOwnProperty.call(record, alias)
                  );

                  const value = field ? record[field] : '';

                  const safeValue =
                    value === null || value === undefined
                      ? ''
                      : typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value);

                  return `
                    <Cell ss:StyleID="TableCell">
                      <Data ss:Type="String">${escapeExcelXml(safeValue)}</Data>
                    </Cell>
                  `;
                }).join('')}
              </Row>
            `;
          });
        } else {
          rows = `
            <Row>
              <Cell ss:StyleID="TableCell">
                <Data ss:Type="String">No records available</Data>
              </Cell>
            </Row>
          `;
        }

        return `
          <Worksheet ss:Name="${escapeExcelXml(name)}">
            <Table>
              ${columns.map(([, aliases]) => {
                const widths = {
                  id: 130,
                  code: 130,
                  title: 220,
                  description: 300,
                  rationale: 300,
                  councilNotes: 260,
                  remarks: 220,
                  location: 180,
                  budget: 150,
                  actual: 150
                };

                const field = aliases[0];

                return `<Column ss:Width="${widths[field] || 150}"/>`;
              }).join('')}

              ${rows}
            </Table>
          </Worksheet>
        `;
      }

            // ==============================================================
      // EXECUTIVE SUMMARY — LIVE GOVERNANCE INDICATORS
      // ==============================================================

      const totalResidents = residentApplications.length;

      const countStatus = (records, status) =>
        records.filter(record =>
          String(record.status || '').trim().toLowerCase() === status.toLowerCase()
        ).length;

      const countMatchingStatus = (records, keywords) =>
        records.filter(record => {
          const status = String(record.status || '').trim().toLowerCase();
          return keywords.some(keyword => status.includes(keyword));
        }).length;

      const formatNumber = value =>
        Number(value || 0).toLocaleString('en-PH');

      const formatPeso = value =>
        '₱' + Number(value || 0).toLocaleString('en-PH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });

      const formatPercent = (numerator, denominator) =>
        denominator > 0
          ? ((numerator / denominator) * 100).toFixed(1) + '%'
          : '0.0%';

      // Resident indicators.
      const verifiedResidents = countStatus(residentApplications, 'Verified');
      const pendingResidents = countStatus(residentApplications, 'Pending');
      const rejectedResidents = countStatus(residentApplications, 'Rejected');
      const otherResidentStatuses = Math.max(
        0,
        totalResidents - verifiedResidents - pendingResidents - rejectedResidents
      );

      // Budget indicators.
      const totalBudget = adminBudgetRecords.reduce(
        (sum, record) => sum + (Number(record.budget) || 0),
        0
      );

      const totalExpenses = adminBudgetRecords.reduce(
        (sum, record) => sum + (Number(record.actual) || 0),
        0
      );

      const remainingBudget = totalBudget - totalExpenses;

      const budgetUtilization = totalBudget > 0
        ? (totalExpenses / totalBudget) * 100
        : 0;

      // Project indicators.
      const totalProjects = capitalProjects.length;

      const completedProjects = countStatus(capitalProjects, 'completed');
      const ongoingProjects = countStatus(capitalProjects, 'ongoing');
      const delayedProjects = countStatus(capitalProjects, 'delayed');
      const planningProjects = countStatus(capitalProjects, 'planning');

      const averageProjectProgress = totalProjects > 0
        ? capitalProjects.reduce(
            (sum, project) => sum + (Number(project.progress) || 0),
            0
          ) / totalProjects
        : 0;

      // Community concern indicators.
      const totalConcerns = incidentTickets.length;

      const resolvedConcerns = countMatchingStatus(
        incidentTickets,
        ['resolved', 'closed']
      );

      const pendingConcerns = countStatus(incidentTickets, 'pending');
      const inProgressConcerns = countStatus(incidentTickets, 'in progress');

      // Document request indicators.
      const totalRequests = serviceRequests.length;

      const completedRequests = countMatchingStatus(
        serviceRequests,
        ['completed', 'released', 'claimed', 'ready for pickup']
      );

      const pendingRequests = countStatus(serviceRequests, 'pending');
      const processingRequests = countMatchingStatus(
        serviceRequests,
        ['processing', 'under review']
      );

      // Project proposal indicators.
      const totalProposals = citizenProposals.length;
      const approvedProposals = countStatus(citizenProposals, 'approved');
      const rejectedProposals = countStatus(citizenProposals, 'rejected');
      const proposalsUnderReview = countStatus(citizenProposals, 'under review');
      const pendingProposals = countStatus(citizenProposals, 'pending');

      // Executive Summary worksheet contents.
      const summaryRows = [
        ['BRGY360 — BARANGAY GOVERNANCE DOSSIER', ''],
        ['Barangay', 'Pallocan West'],
        ['Report Generated', new Date().toLocaleString('en-PH')],
        ['Reporting Coverage', 'All records currently available from the connected database'],

        [''],
        ['I. RESIDENT REGISTRATION AND VERIFICATION', ''],
        ['Total Registered Residents', formatNumber(totalResidents)],
        ['Verified Residents', formatNumber(verifiedResidents)],
        ['Verification Rate', formatPercent(verifiedResidents, totalResidents)],
        ['Pending Verification', formatNumber(pendingResidents)],
        ['Rejected Applications', formatNumber(rejectedResidents)],
        ['Other Verification Statuses', formatNumber(otherResidentStatuses)],

        [''],
        ['II. BUDGET AND FINANCIAL ACCOUNTABILITY', ''],
        ['Number of Budget Records', formatNumber(adminBudgetRecords.length)],
        ['Total Budget Allocation', formatPeso(totalBudget)],
        ['Total Recorded Expenses', formatPeso(totalExpenses)],
        ['Remaining Budget', formatPeso(remainingBudget)],
        ['Budget Utilization Rate', budgetUtilization.toFixed(1) + '%'],

        [''],
        ['III. CAPITAL PROJECT IMPLEMENTATION', ''],
        ['Total Projects', formatNumber(totalProjects)],
        ['Completed Projects', formatNumber(completedProjects)],
        ['Ongoing Projects', formatNumber(ongoingProjects)],
        ['Delayed Projects', formatNumber(delayedProjects)],
        ['Planning Stage Projects', formatNumber(planningProjects)],
        ['Average Project Progress', averageProjectProgress.toFixed(1) + '%'],

        [''],
        ['IV. COMMUNITY CONCERNS AND RESOLUTION', ''],
        ['Total Concerns Filed', formatNumber(totalConcerns)],
        ['Resolved or Closed Concerns', formatNumber(resolvedConcerns)],
        ['Concern Resolution Rate', formatPercent(resolvedConcerns, totalConcerns)],
        ['Pending Concerns', formatNumber(pendingConcerns)],
        ['Concerns In Progress', formatNumber(inProgressConcerns)],

        [''],
        ['V. BARANGAY DOCUMENT SERVICES', ''],
        ['Total Document Requests', formatNumber(totalRequests)],
        ['Completed or Ready for Pickup', formatNumber(completedRequests)],
        ['Document Request Completion Rate', formatPercent(completedRequests, totalRequests)],
        ['Pending Requests', formatNumber(pendingRequests)],
        ['Requests Under Processing', formatNumber(processingRequests)],

        [''],
        ['VI. COMMUNITY PROJECT PROPOSALS', ''],
        ['Total Proposals Received', formatNumber(totalProposals)],
        ['Approved Proposals', formatNumber(approvedProposals)],
        ['Proposals Under Review', formatNumber(proposalsUnderReview)],
        ['Pending Proposals', formatNumber(pendingProposals)],
        ['Rejected Proposals', formatNumber(rejectedProposals)],
        ['Proposal Approval Rate', formatPercent(approvedProposals, totalProposals)]
      ];

        const summaryWorksheet = `
        <Worksheet ss:Name="Executive Summary">
          <Table>
            <Column ss:Width="260"/>
            <Column ss:Width="320"/>

            ${summaryRows.map((row, index) => {
              const label = String(row[0] || '').trim();

              const isTitle = index === 0;
              const isSection = /^([IVX]+)\./.test(label);
              const isBlank = !label;

              if (isBlank) {
                return `<Row ss:Height="10"></Row>`;
              }

              if (isTitle) {
                return `
                  <Row ss:Height="32">
                    <Cell ss:StyleID="Title" ss:MergeAcross="1">
                      <Data ss:Type="String">${escapeExcelXml(label)}</Data>
                    </Cell>
                  </Row>
                `;
              }

              if (isSection) {
                return `
                  <Row ss:Height="24">
                    <Cell ss:StyleID="Section" ss:MergeAcross="1">
                      <Data ss:Type="String">${escapeExcelXml(label)}</Data>
                    </Cell>
                  </Row>
                `;
              }

              const isMetadata = [
                'Barangay',
                'Report Generated',
                'Reporting Coverage'
              ].includes(label);

              return `
                <Row ss:Height="21">
                  <Cell ss:StyleID="${isMetadata ? 'Subtitle' : 'Label'}">
                    <Data ss:Type="String">${escapeExcelXml(label)}</Data>
                  </Cell>
                  <Cell ss:StyleID="Value">
                    <Data ss:Type="String">${escapeExcelXml(row[1] || '')}</Data>
                  </Cell>
                </Row>
              `;
            }).join('')}
          </Table>
        </Worksheet>
      `;

        const workbook = `<?xml version="1.0"?>
        <?mso-application progid="Excel.Sheet"?>
        <Workbook
          xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">

          <Styles>
            <Style ss:ID="Default" ss:Name="Normal">
              <Alignment ss:Vertical="Center"/>
              <Font ss:FontName="Calibri" ss:Size="10"/>
            </Style>

            <Style ss:ID="Title">
              <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/>
              <Interior ss:Color="#163A5F" ss:Pattern="Solid"/>
              <Alignment ss:Vertical="Center"/>
            </Style>

            <Style ss:ID="Subtitle">
              <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#163A5F"/>
            </Style>

            <Style ss:ID="Section">
              <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
              <Interior ss:Color="#2563A6" ss:Pattern="Solid"/>
              <Alignment ss:Vertical="Center"/>
            </Style>

            <Style ss:ID="Label">
              <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1"/>
              <Interior ss:Color="#EAF1F8" ss:Pattern="Solid"/>
            </Style>

            <Style ss:ID="Value">
              <Font ss:FontName="Calibri" ss:Size="10"/>
            </Style>

            <Style ss:ID="TableHeader">
              <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
              <Interior ss:Color="#163A5F" ss:Pattern="Solid"/>
              <Alignment ss:Vertical="Center" ss:WrapText="1"/>
            </Style>

            <Style ss:ID="TableCell">
              <Font ss:FontName="Calibri" ss:Size="10"/>
              <Alignment ss:Vertical="Center" ss:WrapText="1"/>
            </Style>
          </Styles>

          ${summaryWorksheet}

          ${datasets.map(dataset =>
            createWorksheet(dataset.name, dataset.records)
          ).join('')}

        </Workbook>
      `;

      const blob = new Blob(
        [workbook],
        { type: 'application/vnd.ms-excel;charset=utf-8' }
      );

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = downloadUrl;
      link.download = `Brgy360_Governance_Dossier_${new Date().toISOString().slice(0, 10)}.xls`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);

      showAdminToast(
        'Governance Dossier Exported',
        'The barangay governance workbook has been downloaded.',
        'success'
      );

    } catch (error) {
      console.error('Governance Dossier export error:', error);

      showAdminToast(
        'Export Failed',
        error.message || 'Unable to generate the Governance Dossier.',
        'danger'
      );
    }
  }

  // ==============================================================
  // 8. RESIDENT CONCERNS DESK MANAGEMENT
  // ==============================================================
  function pushResidentStatusNotification(ticket, newStatus, adminNote) {
    const noteSnippet = adminNote ? ` Note: ${adminNote}` : '';
    pushScopedUserNotification(ticket.userEmail, {
      id: Date.now(),
      title: `Concern Status Updated: ${newStatus}`,
      desc: `Ticket ${ticket.id} ("${ticket.title}") was updated to ${newStatus} by Barangay Admin.${noteSnippet}`,
      time: 'Just now',
      unread: true,
      type: newStatus === 'Resolved' ? 'green' : (newStatus === 'In Progress' ? 'blue' : 'amber')
    });
  }

  function getConcernUrgencyBadgeHtml(rawUrgency) {
    const urgencyNorm = normalizeConcernUrgency(rawUrgency);
    if (urgencyNorm === 'Urgent') {
      return '<span class="badge-status badge-urgent-pill"><span class="status-dot dot-red"></span>Urgent</span>';
    }
    return '<span class="badge-status badge-standard-pill"><span class="dot-gray"></span>Standard</span>';
  }

  async function updateConcernStatus(id, rawStatus, customNote, newCategory) {
    const ticket = incidentTickets.find(t => t.id === id || t.ref === id);
    if (!ticket) return;

    const newStatus = normalizeConcernStatus(rawStatus);

    // Convert ticket ID (example: TCK-12) to the database concern ID
    const concernId = String(id).replace('TCK-', '');

    let resolutionNote = ticket.resolutionNote || '';

    if (typeof customNote === 'string') {
      resolutionNote = customNote.trim();
    }

    try {
      const response = await fetch(
        `${ADMIN_API_BASE}/concerns/${encodeURIComponent(concernId)}/status`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            concern_status: newStatus,
            resolution_notes: resolutionNote
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to save concern status.');
      }

      // Update the Admin screen only after the database confirms success
      ticket.status = newStatus;

      if (newCategory && String(newCategory).trim()) {
        ticket.category = normalizeConcernCategory(newCategory);
      }

      ticket.currentStage = newStatus === 'Resolved' ? 3 :
        (newStatus === 'In Progress' ? 2 : 1);

      ticket.updatedAt = new Date().toISOString().slice(0, 10);
      ticket.resolutionNote = resolutionNote;
      ticket.actionTaken = resolutionNote;
      ticket.notes = resolutionNote || ticket.desc;

      pushResidentStatusNotification(ticket, newStatus, resolutionNote);
      renderIncidentsTable();
      refreshAdminDashboard();

      const toastTone = newStatus === 'Resolved' ? 'success' :
        (newStatus === 'In Progress' ? 'info' : 'warning');

      showAdminToast(
        `Status Updated: ${newStatus}`,
        `Ticket ${ticket.id} is now ${newStatus}.`,
        toastTone
      );

    } catch (error) {
      console.error('Update concern status error:', error);

      showAdminToast(
        'Status Update Failed',
        error.message || 'Could not save the status. Please try again.',
        'error'
      );

      await loadConcernsFromAPI();
    }
  }

  async function loadConcernsFromAPI() {
    try {
        const response = await fetch(`${ADMIN_API_BASE}/concerns`, {
            method: 'GET',
            credentials: 'include'
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || 'Unable to load concerns.'
            );
        }

        console.log('First concern date from API:', result.concerns[0]?.date_submitted);

        incidentTickets = result.concerns.map(concern => {
            const concernId = `TCK-${concern.concern_id}`;

            return normalizeAdminConcern({
                ref: concernId,
                id: concernId,

                title: concern.concern_title,
                desc: concern.detailed_description,
                photoName: concern.photo_name || null,
                photoData: concern.photo_data || null,
                category: concern.category,
                urgency: concern.urgency_level,

                sitio: concern.sitio_area,
                location: concern.exact_location,

                dateFiled: concern.date_submitted,
                status: concern.concern_status,

                reporter:
                    concern.reporter_name ||
                    concern.full_legal_name ||
                    'Resident',

                residentId: concern.user_id
                    ? `PW-2026-${String(concern.user_id).padStart(4, '0')}`
                    : null,

                userMobile:
                    concern.reporter_contact ||
                    concern.mobile_number ||
                    '',

                userEmail: concern.email || '',
                userAddress: concern.address || '',

                resolutionNote: concern.resolution_notes || '',
                updatedAt: concern.updated_at || '',
                resolvedAt: concern.resolved_at || ''
            });
        });

        renderIncidentsTable();
        refreshAdminDashboard();

    } catch (error) {
        console.error('Load concerns error:', error);

        showAdminToast(
            'Unable to Load Concerns',
            error.message || 'Please try again.',
            'error'
        );
    }
}

  function renderIncidentsTable() {
    const tbody = document.getElementById('incidentsTableBody');
    if (!tbody) return;

    const filtered = incidentTickets.filter(item => {
      const statusNorm = normalizeConcernStatus(item.status);
      const urgencyNorm = normalizeConcernUrgency(item.urgency);
      const matchesStatus = currentIncStatusFilter === 'all' || statusNorm === currentIncStatusFilter;
      const matchesCat = currentIncCategoryFilter === 'all' || item.category === currentIncCategoryFilter;
      const matchesUrgency = currentIncUrgencyFilter === 'all' || urgencyNorm === currentIncUrgencyFilter;
      const searchLower = String(currentIncSearch || '').toLowerCase();

      const searchableFields = [
        item.id,
        item.ref,
        item.title,
        item.desc,
        item.category,
        item.location,
        item.sitio,
        item.reporter,
        item.userEmail,
        item.userMobile
      ];

      const matchesSearch = !searchLower ||
        searchableFields.some(value =>
          String(value || '').toLowerCase().includes(searchLower)
        );

      return matchesStatus && matchesCat && matchesUrgency && matchesSearch;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 28px; color: #94a3b8;">
            No submitted concerns match the selected filters.
          </td>
        </tr>
      `;
      updateIncidentsCounter(0);
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      const statusNorm = normalizeConcernStatus(item.status);
      const urgencyNorm = normalizeConcernUrgency(item.urgency);

      let statusBadge = '<span class="badge-status yellow">Pending</span>';
      if (statusNorm === 'In Progress') {
        statusBadge = '<span class="badge-status blue">In Progress</span>';
      } else if (statusNorm === 'Resolved') {
        statusBadge = '<span class="badge-status green">Resolved</span>';
      }

      const urgencyBadge = getConcernUrgencyBadgeHtml(urgencyNorm);

      const contactParts = [];
      if (item.userMobile) contactParts.push(escapeHtml(item.userMobile));
      else if (item.userEmail) contactParts.push(escapeHtml(item.userEmail));
      if (item.sitio) contactParts.push(escapeHtml(item.sitio));
      const residentSubHtml = contactParts.length > 0
        ? `<div class="resident-meta-sub">${contactParts.join(' &bull; ')}</div>`
        : '';

      const descPreview = truncate(item.desc || '', 72);

      const actions = `
        <div class="table-actions">
          <select class="concern-status-select" data-id="${escapeHtml(item.id)}" aria-label="Update status for ${escapeHtml(item.id)}" title="Update concern status">
            <option value="Pending" ${statusNorm === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="In Progress" ${statusNorm === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Resolved" ${statusNorm === 'Resolved' ? 'selected' : ''}>Resolved</option>
          </select>
          <button type="button" class="btn-table-action primary btn-view-inc" data-id="${escapeHtml(item.id)}" title="View full details and update concern">View Details</button>
        </div>
      `;

      tr.innerHTML = `
        <td><strong><code>${escapeHtml(item.id)}</code></strong></td>
        <td>
          <div style="font-weight: 600; color: #0f172a;">${escapeHtml(item.reporter)}</div>
          ${residentSubHtml}
        </td>
        <td style="max-width: 290px;">
          <div style="font-weight: 600; color: #0f172a; margin-bottom: 2px;">${escapeHtml(item.title)}</div>
          <div style="font-size: 11.5px; color: #475569; line-height: 1.4;">${escapeHtml(descPreview)}</div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">📍 ${escapeHtml(item.location)}</div>
        </td>
        <td><span class="badge-neutral">${escapeHtml(item.category)}</span></td>
        <td>${urgencyBadge}</td>
        <td><span style="font-size: 11.5px; color: #334155; font-weight: 500; white-space: nowrap;">${escapeHtml(item.dateFiled)}</span></td>
        <td>${statusBadge}</td>
        <td class="text-right">${actions}</td>
      `;

      tbody.appendChild(tr);
    });

    updateIncidentsCounter(filtered.length);
    bindIncidentRowEvents();
  }

  function updateIncidentsCounter(count) {
    const total = incidentTickets.length;
    const pendingCount = incidentTickets.filter(i => normalizeConcernStatus(i.status) === 'Pending').length;
    const progressCount = incidentTickets.filter(i => normalizeConcernStatus(i.status) === 'In Progress').length;
    const resolvedCount = incidentTickets.filter(i => normalizeConcernStatus(i.status) === 'Resolved').length;

    const info = document.getElementById('incidentsPaginationInfo');
    if (info) info.textContent = `Showing ${count} of ${total} submitted concern records`;

    const elTotal = document.getElementById('incTotalCount');
    const elActive = document.getElementById('incActiveCount');
    const elInspect = document.getElementById('incInspectCount');
    const elResolved = document.getElementById('incResolvedCount');
    const navIncCount = document.getElementById('navCounterIncidents');

    if (elTotal) elTotal.textContent = `${total} Submitted`;
    if (elActive) elActive.textContent = `${pendingCount} Pending`;
    if (elInspect) elInspect.textContent = `${progressCount} In Progress`;
    const pct = total > 0 ? ((resolvedCount / total) * 100).toFixed(0) : 0;
    if (elResolved) elResolved.textContent = `${resolvedCount} Resolved (${pct}%)`;
    if (navIncCount) navIncCount.textContent = pendingCount + progressCount;

    const pAll = document.getElementById('pillCountIncAll');
    const pPending = document.getElementById('pillCountIncPending');
    const pProgress = document.getElementById('pillCountIncProgress');
    const pResolved = document.getElementById('pillCountIncResolved');
    if (pAll) pAll.textContent = total;
    if (pPending) pPending.textContent = pendingCount;
    if (pProgress) pProgress.textContent = progressCount;
    if (pResolved) pResolved.textContent = resolvedCount;

    refreshAdminDashboard();
  }

  function bindIncidentRowEvents() {
    document.querySelectorAll('.btn-view-inc').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-id');
        openConcernViewModal(id);
      });
    });

    document.querySelectorAll('.concern-status-select').forEach(sel => {
    sel.addEventListener('change', function () {
      const id = this.getAttribute('data-id');
      const newStatus = this.value;

      if (newStatus === 'Resolved') {
        openResolveCaseModal(id);
        return;
      }

      updateConcernStatus(id, newStatus);
    });
  });

    document.querySelectorAll('.btn-resolve-inc').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-id');
        openResolveCaseModal(id, false);
      });
    });

    document.querySelectorAll('.btn-view-inc-action').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-id');
        openResolveCaseModal(id, true);
      });
    });
  }

  // Concern Search and Filters
  const incidentsSearchInput = document.getElementById('incidentsSearchInput');
  if (incidentsSearchInput) {
    incidentsSearchInput.addEventListener('input', function () {
      currentIncSearch = this.value.trim();
      renderIncidentsTable();
    });
  }

  const incStatusPills = document.querySelectorAll('#incidentsStatusFilterGroup .filter-pill');
  incStatusPills.forEach(pill => {
    pill.addEventListener('click', function () {
      incStatusPills.forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      currentIncStatusFilter = this.getAttribute('data-status');
      renderIncidentsTable();
    });
  });

  const incidentCategorySelect = document.getElementById('incidentCategorySelect');
  if (incidentCategorySelect) {
    incidentCategorySelect.addEventListener('change', function () {
      currentIncCategoryFilter = this.value;
      renderIncidentsTable();
    });
  }

  const incidentUrgencySelect = document.getElementById('incidentUrgencySelect');
  if (incidentUrgencySelect) {
    incidentUrgencySelect.addEventListener('change', function () {
      currentIncUrgencyFilter = this.value;
      renderIncidentsTable();
    });
  }

  loadConcernsFromAPI();

  
function syncAllStoresFromStorage(changedKey) {
    if (
        !changedKey ||
        changedKey === 'brgy360_service_requests' ||
        changedKey === 'brgy360_requests' ||
        changedKey === 'brgy360_user_requests'
    ) {
        loadServiceRequestsFromBackend();
    }

    if (!changedKey) {
        loadProjectsFromDatabase();
        loadCitizenProposalsFromDatabase();
    }

    // Proposals are exclusively loaded from the backend API.
    // Never reload proposal records from localStorage.
    if (changedKey === 'brgy360_proposals') {
        loadCitizenProposalsFromDatabase();
    }

    if (!changedKey || changedKey === 'brgy360_resident_applications') {
        loadResidentApplicationsFromAPI();
    }

    if (changedKey === 'brgy360_budget_records_v1') {
        loadAdminBudgetRecordsFromDatabase();
    }

    refreshAdminDashboard();
}

  // ==============================================================
  // 9. OVERVIEW OPERATIONAL ACTIONS
  // ==============================================================
  document.querySelectorAll('.btn-advisory-act').forEach(btn => {
    btn.addEventListener('click', function () {
      const act = this.getAttribute('data-action');
      if (act === 'deploy-desk') {
        showAdminToast('Action Logged', 'Satellite verification desk directive noted in dispatch records.', 'success');
      } else {
        showAdminToast('Action Logged', 'Preventive dredging directive confirmed and noted.', 'success');
      }
    });
  });

  // ==============================================================
  // 11. DETAIL & INSPECTION MODALS
  // ==============================================================

  // Modal: Request Detail
  const requestDetailModal = document.getElementById('requestDetailModal');
  const btnCloseReqModal = document.getElementById('btnCloseReqModal');
  const modalReqDocType = document.getElementById('modalReqDocType');
  const modalReqRef = document.getElementById('modalReqRef');
  const modalReqBody = document.getElementById('modalReqBody');
  const btnReadyInModal = document.getElementById('btnReadyInModal');
  const btnRejectInModal = document.getElementById('btnRejectInModal');

  function openRequestDetailModal(id) {
    const item = serviceRequests.find(r => r.id === id || r.ref === id);
    if (!item || !requestDetailModal) return;

    currentInspectingReqId = id;
    if (modalReqDocType) modalReqDocType.textContent = item.docType || item.documentType;
    if (modalReqRef) modalReqRef.textContent = `Application Ref: ${item.id || item.ref}`;

    let statusPillClass = 'badge-status yellow';
    if (item.status === 'Ready for Pickup') statusPillClass = 'badge-status green';
    else if (item.status === 'Completed' || item.status === 'Approved') statusPillClass = 'badge-status blue';
    else if (item.status === 'Rejected') statusPillClass = 'badge-status red';

    const currentDocTypeVal = item.docType || item.documentType || 'Barangay Clearance';
    const docTypeOptions = [
      'Barangay Clearance',
      'Certificate of Indigency',
      'Certificate of Residency',
      'Barangay Business Clearance',
      'Certification for First-Time Job Seeker',
      'Katarungang Pambarangay Mediation'
    ];
    if (!docTypeOptions.includes(currentDocTypeVal)) {
      docTypeOptions.push(currentDocTypeVal);
    }

    if (modalReqBody) {
      modalReqBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:14px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
            <div><span style="font-size:11px; color:#64748b;">Resident Applicant:</span><br><strong>${escapeHtml(item.resident || item.fullName)}</strong></div>
            <div><span style="font-size:11px; color:#64748b;">Sitio / Purok:</span><br><strong>${escapeHtml(item.sitio || item.purokSitio)}</strong></div>
            <div><span style="font-size:11px; color:#64748b;">Contact Mobile:</span><br><strong>${escapeHtml(item.contact || 'N/A')}</strong></div>
            <div><span style="font-size:11px; color:#64748b;">ID on Record:</span><br><strong>${escapeHtml(item.idOnRecord || 'PhilID on file')}</strong></div>
          </div>
          <div>
            <label for="modalReqDocTypeSelect" style="font-size:11px; color:#64748b; display:block; margin-bottom:4px;">Certificate / Service Type:</label>
            <select id="modalReqDocTypeSelect" class="form-select">
              ${docTypeOptions.map(opt => `<option value="${escapeHtml(opt)}" ${opt === currentDocTypeVal ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
            </select>
          </div>
          <div>
            <span style="font-size:11px; color:#64748b;">Declared Purpose:</span>
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:10px; margin-top:4px; font-weight:500;">
              ${escapeHtml(item.purpose)}
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:12px; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
            <div><span style="color:#64748b;">Claim Method:</span><br><strong>${escapeHtml(item.claimMethod || 'Physical Pickup at Barangay Hall')}</strong></div>
            <div><span style="color:#64748b;">Target Timeline:</span><br><strong>${escapeHtml(item.claimTarget || '1–2 Working Days')}</strong></div>
            <div><span style="color:#64748b;">Registered Address:</span><br><strong>${escapeHtml(item.address || (item.sitio + ', Barangay Pallocan West'))}</strong></div>
            <div><span style="color:#64748b;">Resident Email:</span><br><strong>${escapeHtml(item.userEmail || item.email || 'N/A')}</strong></div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:10px;">
            <span style="font-size:11px; color:#64748b;">Date Filed: ${escapeHtml(item.dateFiled || item.date)}</span>
            <span style="font-size:11px; font-weight:700;">Status: <span class="${statusPillClass}">${escapeHtml(item.status)}</span></span>
          </div>
        </div>
      `;
      const docTypeSel = document.getElementById('modalReqDocTypeSelect');
      if (docTypeSel) {
        docTypeSel.addEventListener('change', function () {
          const updatedType = this.value;
          item.docType = updatedType;
          item.documentType = updatedType;
          if (modalReqDocType) modalReqDocType.textContent = updatedType;
          persistServiceRequests();
          renderRequestsTable();
          renderOverviewQueue();
          refreshAdminDashboard();
          showAdminToast('Service Request Updated', `Certificate type for ${item.id} updated to ${updatedType}.`, 'info');
        });
      }
    }

    const modalFooter = document.getElementById('modalReqFooter');
    if (modalFooter) {
      if (item.status === 'Ready for Pickup') {
        modalFooter.innerHTML = `
          <button type="button" class="btn-modal-outline" id="btnRejectInModal">Reject Application</button>
          <button type="button" class="btn-modal-primary" id="btnClaimInModal" style="background:#2563eb;">Mark as Claimed / Completed</button>
        `;
        document.getElementById('btnClaimInModal')?.addEventListener('click', function () {
          setRequestStatus(currentInspectingReqId, 'Completed');
          closeRequestDetailModal();
        });
        document.getElementById('btnRejectInModal')?.addEventListener('click', function () {
          setRequestStatus(currentInspectingReqId, 'Rejected');
          closeRequestDetailModal();
        });
      } else if (item.status === 'Completed') {
        modalFooter.innerHTML = `
          <button type="button" class="btn-modal-outline" id="btnCloseCompletedInModal">Close</button>
          <button type="button" class="btn-modal-primary" style="background:#16a34a; cursor:default;" disabled>&check; Document Completed &amp; Released</button>
        `;
        document.getElementById('btnCloseCompletedInModal')?.addEventListener('click', closeRequestDetailModal);
      } else if (item.status === 'Rejected') {
        modalFooter.innerHTML = `
          <button type="button" class="btn-modal-outline" id="btnCloseRejectedInModal">Close</button>
          <button type="button" class="btn-modal-primary" id="btnReopenInModal" style="background:#f59e0b;">Re-evaluate Application</button>
        `;
        document.getElementById('btnCloseRejectedInModal')?.addEventListener('click', closeRequestDetailModal);
        document.getElementById('btnReopenInModal')?.addEventListener('click', function () {
          setRequestStatus(currentInspectingReqId, 'In Review');
          closeRequestDetailModal();
        });
      } else {
        modalFooter.innerHTML = `
          <button type="button" class="btn-modal-outline" id="btnRejectInModal">Reject Application</button>
          <button type="button" class="btn-modal-primary" id="btnReadyInModal">Mark Ready for Pickup</button>
        `;
        document.getElementById('btnReadyInModal')?.addEventListener('click', function () {
          setRequestStatus(currentInspectingReqId, 'Ready for Pickup');
          closeRequestDetailModal();
        });
        document.getElementById('btnRejectInModal')?.addEventListener('click', function () {
          setRequestStatus(currentInspectingReqId, 'Rejected');
          closeRequestDetailModal();
        });
      }
    }

    requestDetailModal.classList.add('active');
  }

  function closeRequestDetailModal() {
    if (requestDetailModal) requestDetailModal.classList.remove('active');
    currentInspectingReqId = null;
  }

  if (btnCloseReqModal) btnCloseReqModal.addEventListener('click', closeRequestDetailModal);

  // Modal: View & Update Submitted Resident Concern
  const concernViewModal = document.getElementById('concernViewModal');
  const btnCloseIncModal = document.getElementById('btnCloseIncModal');
  const btnCloseIncFooter = document.getElementById('btnCloseIncFooter');
  const btnSaveConcernModalStatus = document.getElementById('btnSaveConcernModalStatus');
  const modalIncTitle = document.getElementById('modalIncTitle');
  const modalIncId = document.getElementById('modalIncId');
  const modalIncViewBody = document.getElementById('modalIncViewBody');

  function openConcernViewModal(id) {
    const item = incidentTickets.find(t => t.id === id || t.ref === id);
    if (!item || !concernViewModal) return;

    currentInspectingIncId = item.id;
    const statusNorm = normalizeConcernStatus(item.status);
    const urgencyNorm = normalizeConcernUrgency(item.urgency);

    if (modalIncTitle) modalIncTitle.textContent = item.title || `${item.category} Concern`;
    if (modalIncId) modalIncId.textContent = `Ticket #${item.id} · Submitted on ${item.dateFiled}`;

    const urgencyBadgeHtml = getConcernUrgencyBadgeHtml(urgencyNorm);
    let statusBadgeHtml = '<span class="badge-status yellow">Pending</span>';
    if (statusNorm === 'In Progress') {
      statusBadgeHtml = '<span class="badge-status blue">In Progress</span>';
    } else if (statusNorm === 'Resolved') {
      statusBadgeHtml = '<span class="badge-status green">Resolved</span>';
    }

    if (modalIncViewBody) {
      modalIncViewBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:14px;">
          <!-- Top Metadata Strip -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="resolve-ticket-badge">${escapeHtml(item.id)}</span>
              <span class="badge-neutral">${escapeHtml(item.category)}</span>
              ${urgencyBadgeHtml}
            </div>
            <div>${statusBadgeHtml}</div>
          </div>

          <!-- Submitted Resident / User Information -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
            <div style="font-size:11px; font-weight:700; color:#0d47a1; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:10px;">
              Resident Information
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 14px;">
              <div>
                <span style="font-size:10.5px; font-weight:600; color:#64748b; display:block;">Full Name</span>
                <strong style="font-size:13px; color:#0f172a;">${escapeHtml(item.reporter)}</strong>
              </div>
              <div>
                <span style="font-size:10.5px; font-weight:600; color:#64748b; display:block;">Resident ID</span>
                <span style="font-size:12.5px; color:#334155;">${escapeHtml(item.residentId || '—')}</span>
              </div>
              <div>
                <span style="font-size:10.5px; font-weight:600; color:#64748b; display:block;">Email Address</span>
                <span style="font-size:12.5px; color:#334155;">${escapeHtml(item.userEmail || 'Not provided')}</span>
              </div>
              <div>
                <span style="font-size:10.5px; font-weight:600; color:#64748b; display:block;">Mobile Number</span>
                <span style="font-size:12.5px; color:#334155;">${escapeHtml(item.userMobile || 'Not provided')}</span>
              </div>
              <div>
                <span style="font-size:10.5px; font-weight:600; color:#64748b; display:block;">Residential Address</span>
                <span style="font-size:12.5px; color:#334155;">${escapeHtml(item.userAddress || item.sitio || '—')}</span>
              </div>
            </div>
          </div>

          <!-- Concern Full Details -->
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #f1f5f9;">
              <div>
                <span style="font-size:10.5px; font-weight:600; color:#64748b; display:block;">Date Submitted</span>
                <strong style="font-size:12.5px; color:#0f172a;">${escapeHtml(item.dateFiled)}</strong>
              </div>
              <div>
                <span style="font-size:10.5px; font-weight:600; color:#64748b; display:block;">Incident Location / Sitio</span>
                <strong style="font-size:12.5px; color:#0f172a;">${escapeHtml(item.location)}</strong>
              </div>
            </div>
            <div style="margin-bottom:8px;">
              <span style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; display:block; margin-bottom:3px;">Concern Title</span>
              <div style="font-size:14px; font-weight:700; color:#0f172a;">${escapeHtml(item.title)}</div>
            </div>
            <div>
              <span style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; display:block; margin-bottom:4px;">Full Description</span>
              <p style="margin:0; font-size:13px; color:#334155; line-height:1.55; white-space:pre-wrap;">${escapeHtml(item.desc)}</p>
            </div>
            ${item.photoData ? `
              <div style="margin-top:12px; padding-top:12px; border-top:1px solid #f1f5f9;">
                <span style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; display:block; margin-bottom:6px;">Attached Photo Evidence</span>
                <img src="${item.photoData}" alt="Resident submitted concern evidence" style="max-width:100%; max-height:220px; border-radius:8px; border:1px solid #e2e8f0; object-fit:cover;">
              </div>
            ` : (item.photoName ? `
              <div style="margin-top:10px; font-size:12px; color:#64748b;">
                <strong>Attached File:</strong> ${escapeHtml(item.photoName)}
              </div>
            ` : '')}
          </div>

          <!-- Admin Status & Action Update Controls -->
          <div style="background:#f0f7ff; border:1px solid #bfdbfe; border-radius:8px; padding:14px;">
            <div style="font-size:11px; font-weight:700; color:#0d47a1; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:10px;">
              Update Concern Status &amp; Admin Remarks
            </div>
            <div class="form-grid-2" style="margin-bottom:10px;">
              <div class="form-group" style="margin:0;">
                <label class="form-label" for="modalConcernStatusSelect">Concern Status</label>
                <select id="modalConcernStatusSelect" class="form-select">
                  <option value="Pending" ${statusNorm === 'Pending' ? 'selected' : ''}>Pending</option>
                  <option value="In Progress" ${statusNorm === 'In Progress' ? 'selected' : ''}>In Progress</option>
                  <option value="Resolved" ${statusNorm === 'Resolved' ? 'selected' : ''}>Resolved</option>
                </select>
              </div>
              <div class="form-group" style="margin:0;">
                <label class="form-label" for="modalConcernCategorySelect">Concern Category</label>
                <select id="modalConcernCategorySelect" class="form-select">
                  <option value="Infrastructure" ${item.category === 'Infrastructure' ? 'selected' : ''}>Infrastructure</option>
                  <option value="Sanitation" ${item.category === 'Sanitation' ? 'selected' : ''}>Sanitation</option>
                  <option value="Public Safety" ${item.category === 'Public Safety' || item.category === 'Safety' ? 'selected' : ''}>Public Safety</option>
                  <option value="Noise Disturbance" ${item.category === 'Noise Disturbance' || item.category === 'Noise' ? 'selected' : ''}>Noise Disturbance</option>
                  <option value="Public Utility" ${item.category === 'Public Utility' || item.category === 'Utilities' ? 'selected' : ''}>Public Utility</option>
                  <option value="Other" ${item.category === 'Other' ? 'selected' : ''}>Other</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin:0 0 10px 0;">
              <label class="form-label">Urgency Level (Set by Resident)</label>
              <div style="display:flex; align-items:center; justify-content:space-between; height:38px; padding:0 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; cursor:not-allowed;" title="Urgency level is set by the resident upon submission and cannot be modified by Admin">
                ${urgencyBadgeHtml}
                <span style="font-size:11px; color:#64748b; font-weight:500;">Read-only</span>
              </div>
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" for="modalConcernAdminNote">Barangay Response / Action Notes (Visible to Resident)</label>
              <textarea id="modalConcernAdminNote" class="form-textarea" rows="3" placeholder="Enter inspection findings, assigned team, or resolution details...">${escapeHtml(item.resolutionNote || '')}</textarea>
            </div>
          </div>
        </div>
      `;
    }

    concernViewModal.classList.add('active');
  }

  function closeConcernViewModal() {
    if (concernViewModal) concernViewModal.classList.remove('active');
    currentInspectingIncId = null;
  }

  if (btnCloseIncModal) btnCloseIncModal.addEventListener('click', closeConcernViewModal);
  if (btnCloseIncFooter) btnCloseIncFooter.addEventListener('click', closeConcernViewModal);
  if (btnSaveConcernModalStatus) {
    btnSaveConcernModalStatus.addEventListener('click', function () {
      if (!currentInspectingIncId) return;
      const newStatus = document.getElementById('modalConcernStatusSelect')?.value || 'Pending';
      const newCategory = document.getElementById('modalConcernCategorySelect')?.value || '';
      const adminNote = document.getElementById('modalConcernAdminNote')?.value || '';
      updateConcernStatus(currentInspectingIncId, newStatus, adminNote, newCategory);
      closeConcernViewModal();
    });
  }

  // ==============================================================
  // RESOLVE CASE / CONCERN MODAL: RESPONSE & ACTION RECORDER
  // ==============================================================
  const resolveCaseModal = document.getElementById('resolveCaseModal');
  const btnCloseResolveModal = document.getElementById('btnCloseResolveModal');
  const btnCancelResolveCase = document.getElementById('btnCancelResolveCase');
  const btnSubmitResolveCase = document.getElementById('btnSubmitResolveCase');
  const resolveActionInput = document.getElementById('resolveActionInput');
  const quickChipsGroup = document.getElementById('resolveQuickChips')?.closest('.form-group');

  function openResolveCaseModal(id, isViewOnly = false) {
    const ticket = incidentTickets.find(t => t.id === id || t.ref === id);
    if (!ticket || !resolveCaseModal) return;

    currentResolvingIncidentId = ticket.id;
    const urgencyNorm = normalizeConcernUrgency(ticket.urgency);

    const elId = document.getElementById('resCaseTicketId');
    const elCat = document.getElementById('resCaseCategory');
    const elSev = document.getElementById('resCaseSeverity');
    const elDate = document.getElementById('resCaseDateLogged');
    const elSum = document.getElementById('resCaseSummary');
    const elLoc = document.getElementById('resCaseLocation');
    const elRep = document.getElementById('resCaseReporter');
    const elNotes = document.getElementById('resCasePrevNotes');
    const modalTitle = document.getElementById('resolveModalTitle');
    const modalSub = resolveCaseModal.querySelector('.modal-sub');

    if (elId) elId.textContent = ticket.id;
    if (elCat) elCat.textContent = ticket.category;
    if (elSev) {
      if (urgencyNorm === 'Urgent') {
        elSev.className = 'badge-status badge-urgent-pill';
        elSev.innerHTML = '<span class="status-dot dot-red"></span>Urgent';
      } else {
        elSev.className = 'badge-status badge-standard-pill';
        elSev.innerHTML = '<span class="dot-gray"></span>Standard';
      }
    }
    if (elDate) elDate.textContent = `Submitted: ${ticket.dateFiled}`;
    if (elSum) elSum.textContent = ticket.title;
    if (elLoc) elLoc.textContent = ticket.location;
    if (elRep) elRep.textContent = ticket.reporter;
    if (elNotes) elNotes.textContent = ticket.desc || 'No additional description.';

    const isResolved = normalizeConcernStatus(ticket.status) === 'Resolved';

    if (isViewOnly || isResolved) {
      if (modalTitle) modalTitle.textContent = `View Action: ${ticket.id}`;
      if (modalSub) modalSub.textContent = `Recorded response and action made to resolve this concern case.`;
      if (resolveActionInput) {
        resolveActionInput.value = ticket.resolutionNote || ticket.actionTaken || 'No action recorded.';
      }
      if (quickChipsGroup) quickChipsGroup.style.display = 'none';
      if (btnSubmitResolveCase) {
        btnSubmitResolveCase.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Update Action Record</span>
        `;
      }
    } else {
      if (modalTitle) modalTitle.textContent = `Resolve Case in Concern: ${ticket.id}`;
      if (modalSub) modalSub.textContent = `Log the response or action made before marking this case as resolved.`;
      if (resolveActionInput) {
        resolveActionInput.value = '';
      }
      if (quickChipsGroup) quickChipsGroup.style.display = 'block';
      if (btnSubmitResolveCase) {
        btnSubmitResolveCase.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Confirm &amp; Mark as Resolved</span>
        `;
      }
    }

    resolveCaseModal.classList.add('active');
    setTimeout(() => {
      if (resolveActionInput && (!isViewOnly && !isResolved)) resolveActionInput.focus();
    }, 100);
  }

  function closeResolveCaseModal() {
    if (resolveCaseModal) resolveCaseModal.classList.remove('active');
    currentResolvingIncidentId = null;
  }

  if (btnCloseResolveModal) btnCloseResolveModal.addEventListener('click', closeResolveCaseModal);
  if (btnCancelResolveCase) btnCancelResolveCase.addEventListener('click', closeResolveCaseModal);

  document.querySelectorAll('#resolveQuickChips .quick-chip-btn').forEach(chip => {
    chip.addEventListener('click', function () {
      const text = this.getAttribute('data-text');
      if (resolveActionInput && text) {
        resolveActionInput.value = text;
        resolveActionInput.focus();
      }
    });
  });

  if (btnSubmitResolveCase) {
    btnSubmitResolveCase.addEventListener('click', function () {
      const ticket = incidentTickets.find(t => t.id === currentResolvingIncidentId || t.ref === currentResolvingIncidentId);
      if (!ticket) {
        closeResolveCaseModal();
        return;
      }

      const actionMade = (resolveActionInput?.value || '').trim();
      if (!actionMade) {
        if (resolveActionInput) {
          resolveActionInput.focus();
          resolveActionInput.style.borderColor = '#ef4444';
          setTimeout(() => { resolveActionInput.style.borderColor = ''; }, 2000);
        }
        showAdminToast('Action Required', 'Please enter the response or action made to resolve the case.', 'danger');
        return;
      }

      updateConcernStatus(ticket.id, 'Resolved', actionMade);
      closeResolveCaseModal();
    });
  }

  // Modal: Log Walk-in Concern
  const newIncidentModal = document.getElementById('newIncidentModal');
  const btnOpenNewIncidentModal = document.getElementById('btnOpenNewIncidentModal');
  const btnCloseNewIncModal = document.getElementById('btnCloseNewIncModal');
  const btnCancelNewInc = document.getElementById('btnCancelNewInc');
  const btnSubmitNewIncident = document.getElementById('btnSubmitNewIncident');

  const btnToggleConcernUrgency = document.getElementById('btnToggleConcernUrgency');
  const newIncUrgencyInput = document.getElementById('newIncUrgency');
  const newIncUrgencyBadge = document.getElementById('newIncUrgencyBadge');
  const newIncUrgencyTitle = document.getElementById('newIncUrgencyTitle');
  const newIncUrgencySub = document.getElementById('newIncUrgencySub');

  function setWalkInConcernUrgencyState(isUrgent) {
    if (!btnToggleConcernUrgency || !newIncUrgencyInput || !newIncUrgencyBadge) return;
    if (isUrgent) {
      btnToggleConcernUrgency.classList.add('is-critical');
      newIncUrgencyInput.value = 'Urgent';
      newIncUrgencyBadge.innerHTML = '<span class="status-dot dot-red"></span><span class="badge-text">Urgent</span>';
      if (newIncUrgencyTitle) newIncUrgencyTitle.textContent = 'Urgent Concern Level';
      if (newIncUrgencySub) newIncUrgencySub.textContent = 'Flagged as Urgent for immediate Barangay response and field inspection';
    } else {
      btnToggleConcernUrgency.classList.remove('is-critical');
      newIncUrgencyInput.value = 'Standard';
      newIncUrgencyBadge.innerHTML = '<span class="dot-gray"></span><span class="badge-text">Standard</span>';
      if (newIncUrgencyTitle) newIncUrgencyTitle.textContent = 'Standard Concern Level';
      if (newIncUrgencySub) newIncUrgencySub.textContent = 'Click to mark as Urgent if this concern poses an immediate safety or infrastructure hazard';
    }
  }

  if (btnToggleConcernUrgency) {
    btnToggleConcernUrgency.addEventListener('click', function () {
      const currentlyUrgent = newIncUrgencyInput?.value === 'Urgent';
      setWalkInConcernUrgencyState(!currentlyUrgent);
    });
  }

  function openNewIncidentModal() {
    setWalkInConcernUrgencyState(false);
    if (newIncidentModal) newIncidentModal.classList.add('active');
  }

  function closeNewIncidentModal() {
    setWalkInConcernUrgencyState(false);
    if (newIncidentModal) newIncidentModal.classList.remove('active');
  }

  if (btnOpenNewIncidentModal) btnOpenNewIncidentModal.addEventListener('click', openNewIncidentModal);
  if (btnCloseNewIncModal) btnCloseNewIncModal.addEventListener('click', closeNewIncidentModal);
  if (btnCancelNewInc) btnCancelNewInc.addEventListener('click', closeNewIncidentModal);

  // Real-time input restrictions and error clearing for Walk-in Incident form
  const incTitleInput = document.getElementById('newIncTitle');
  const incReporterInput = document.getElementById('newIncReporter');
  const incContactInput = document.getElementById('newIncContact');
  const incDescInput = document.getElementById('newIncDesc');

  if (incReporterInput) {
    incReporterInput.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-Z\s]/g, '');
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('newIncReporterError');
      if (err) err.textContent = '';
    });
  }

  if (incContactInput) {
    incContactInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '');
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('newIncContactError');
      if (err) err.textContent = '';
    });
  }

  if (incTitleInput) {
    incTitleInput.addEventListener('input', function () {
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('newIncTitleError');
      if (err) err.textContent = '';
    });
  }

  if (incDescInput) {
    incDescInput.addEventListener('input', function () {
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('newIncDescError');
      if (err) err.textContent = '';
    });
  }

  if (btnSubmitNewIncident) {
    btnSubmitNewIncident.addEventListener('click', async function () {
      const titleEl = document.getElementById('newIncTitle');
      const catEl = document.getElementById('newIncCategory');
      const urgencyEl = document.getElementById('newIncUrgency');
      const locEl = document.getElementById('newIncLocation');
      const repEl = document.getElementById('newIncReporter');
      const contactEl = document.getElementById('newIncContact');
      const descEl = document.getElementById('newIncDesc');

      const title = (titleEl?.value || '').trim();
      const cat = normalizeConcernCategory(catEl?.value || 'Infrastructure');
      const urgency = normalizeConcernUrgency(urgencyEl?.value || 'Standard');
      const loc = normalizeSitioName(locEl?.value || 'Sitio Ibaba');
      const reporterName = (repEl?.value || '').trim();
      const reporterContact = (contactEl?.value || '').trim();
      const desc = (descEl?.value || '').trim();

      // Reset prior errors
      const titleErr = document.getElementById('newIncTitleError');
      const repErr = document.getElementById('newIncReporterError');
      const contactErr = document.getElementById('newIncContactError');
      const descErr = document.getElementById('newIncDescError');

      [titleErr, repErr, contactErr, descErr].forEach(e => { if (e) e.textContent = ''; });
      [titleEl, repEl, contactEl, descEl].forEach(e => { if (e) e.classList.remove('is-invalid', 'input-error'); });

      let isValid = true;
      let firstInvalid = null;

      if (!title || title.length < 3) {
        if (titleErr) titleErr.textContent = 'Please enter a concern title (at least 3 characters).';
        if (titleEl) titleEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = titleEl;
      }

      const nameRegex = /^[a-zA-Z\s]+$/;
      if (!reporterName) {
        if (repErr) repErr.textContent = 'Resident full name is required.';
        if (repEl) repEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = repEl;
      } else if (!nameRegex.test(reporterName)) {
        if (repErr) repErr.textContent = 'Resident name must contain letters and spaces only. No numbers or special characters.';
        if (repEl) repEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = repEl;
      }

      const digitsRegex = /^\d+$/;
      if (!reporterContact) {
        if (contactErr) contactErr.textContent = 'Contact number is required.';
        if (contactEl) contactEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = contactEl;
      } else if (!digitsRegex.test(reporterContact)) {
        if (contactErr) contactErr.textContent = 'Contact number must contain numeric digits only. No letters or special characters.';
        if (contactEl) contactEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = contactEl;
      } else if (reporterContact.length < 7 || reporterContact.length > 11) {
        if (contactErr) contactErr.textContent = 'Contact number must be between 7 and 11 digits.';
        if (contactEl) contactEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = contactEl;
      }

      if (!desc || desc.length < 10) {
        if (descErr) descErr.textContent = 'Please provide a detailed description (at least 10 characters).';
        if (descEl) descEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = descEl;
      }

      if (!isValid) {
        if (firstInvalid) firstInvalid.focus();
        showAdminToast('Validation Error', 'Please correct the highlighted fields with valid information.', 'danger');
        return;
      }

      try {
    const response = await fetch(`${ADMIN_API_BASE}/concerns/walk-in`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            concern_title: title,
            category: cat,
            urgency_level: urgency,
            sitio_area: loc,
            exact_location: loc,
            detailed_description: desc,
            reporter_name: reporterName,
            reporter_contact: reporterContact
        })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to log walk-in concern.');
    }

    closeNewIncidentModal();

    const form = document.getElementById('newIncidentForm');
    if (form) form.reset();

    setWalkInConcernUrgencyState(false);

    showAdminToast(
        'Concern Recorded',
        `Walk-in concern #${result.concern_id} ("${title}") logged under ${cat} (${urgency}).`,
        'success'
    );

} catch (error) {
    console.error('Log walk-in concern error:', error);

    showAdminToast(
        'Save Failed',
        error.message || 'Unable to log the concern. Please try again.',
        'danger'
    );
}

    });
  }

  // Close modals on clicking overlay backdrop
  document.querySelectorAll('.admin-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // ESC key closes any open admin modal
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.admin-modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
      });
      if (typeof closePrintModal === 'function') {
        closePrintModal();
      }
    }
  });

  // ==============================================================
  // 14. PROPOSALS, PROJECTS, ANNOUNCEMENTS & SETTINGS MANAGERS
  // ==============================================================

      function bindProposalCardEvents() {

        // Quick Approve button
        document.querySelectorAll('.btn-prop-approve').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                updateProposalStatus(id, 'Approved');
            });
        });

        // Quick Under Review button
        document.querySelectorAll('.btn-prop-under-review').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                updateProposalStatus(id, 'Under Review');
            });
        });

        // Quick Reject button
        document.querySelectorAll('.btn-prop-reject').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                updateProposalStatus(id, 'Rejected');
            });
        });

        // Review Details and Edit buttons
        document.querySelectorAll('.btn-prop-review, .btn-edit-proposal').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                openReviewProposalModal(id);
            });
        });

        // Delete button
        document.querySelectorAll('.btn-delete-proposal').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();

                const id = this.getAttribute('data-id');

                const prop = citizenProposals.find(
                    p => p.id === id || p.ref === id
                );

                if (!prop) return;

                if (!prop.proposalId) {
                    showAdminToast(
                        'Unable to Delete',
                        'The database proposal ID is missing.',
                        'error'
                    );
                    return;
                }

                showAdminConfirm(
                    'Delete Project Proposal',
                    `Are you sure you want to permanently delete proposal "${prop.title}" (${prop.id || prop.ref})?`,
                    async function() {
                        try {
                            const response = await fetch(
                                `http://localhost:5000/api/proposals/admin/${prop.proposalId}`,
                                {
                                    method: 'DELETE',
                                    credentials: 'include'
                                }
                            );

                            const data = await response.json();

                            if (!response.ok || !data.success) {
                                throw new Error(
                                    data.message || 'Failed to delete proposal.'
                                );
                            }

                            // Remove the deleted proposal from the displayed list.
                            citizenProposals = citizenProposals.filter(
                                p => Number(p.proposalId) !== Number(prop.proposalId)
                            );

                            renderProposalsGrid();

                            showAdminToast(
                                'Proposal Deleted',
                                `Proposal ${prop.id || prop.ref} was permanently deleted.`,
                                'warning'
                            );

                            console.log(
                                'Proposal deleted from database:',
                                prop.proposalId
                            );

                        } catch (error) {
                            console.error('Delete proposal error:', error);

                            showAdminToast(
                                'Delete Failed',
                                error.message || 'Unable to delete proposal.',
                                'error'
                            );
                        }
                    }
                );
            });
        });
      }

    console.log(
        'bindProposalCardEvents available:',
        typeof bindProposalCardEvents
    );

      // A. Community Project Proposals Card Grid Engine
      function renderProposalsGrid() {
        const grid = document.getElementById('proposalsGrid');
        const emptyState = document.getElementById('proposalsEmptyState');
        if (!grid) return;

        // 1. Calculate live counts for Metric Summary Cards Top Bar
        const countPending = citizenProposals.filter(p => p.status === 'Pending').length;
        const countReview = citizenProposals.filter(p => p.status === 'Under Review').length;
        const countApproved = citizenProposals.filter(p => p.status === 'Approved').length;
        const countRejected = citizenProposals.filter(p => p.status === 'Rejected').length;
        const countAll = citizenProposals.length;

        // Update 4 Metric Top Cards
        const elPending = document.getElementById('metricCountPending');
        const elReview = document.getElementById('metricCountReview');
        const elApproved = document.getElementById('metricCountApproved');
        const elRejected = document.getElementById('metricCountRejected');
        if (elPending) elPending.textContent = countPending;
        if (elReview) elReview.textContent = countReview;
        if (elApproved) elApproved.textContent = countApproved;
        if (elRejected) elRejected.textContent = countRejected;

        // Update Filter Pill Counts
        const pAll = document.getElementById('pillCountAll');
        const pPending = document.getElementById('pillCountPending');
        const pReview = document.getElementById('pillCountReview');
        const pApproved = document.getElementById('pillCountApproved');
        const pRejected = document.getElementById('pillCountRejected');
        if (pAll) pAll.textContent = countAll;
        if (pPending) pPending.textContent = countPending;
        if (pReview) pReview.textContent = countReview;
        if (pApproved) pApproved.textContent = countApproved;
        if (pRejected) pRejected.textContent = countRejected;

        // Update Sidebar Counter (Pending Proposals)
        const navCounter = document.getElementById('navCounterProposals');
        if (navCounter) navCounter.textContent = countPending;

        // 2. Filter proposals based on active filter pill and search input
        const searchInput = document.getElementById('proposalsSearchInput');
        const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();

        const filtered = citizenProposals.filter(p => {
          let matchFilter = true;
          if (currentProposalFilter !== 'all') {
            matchFilter = p.status.toLowerCase() === currentProposalFilter.toLowerCase();
          }

          let matchSearch = true;
          if (searchTerm) {
            matchSearch = (
              (p.title && p.title.toLowerCase().includes(searchTerm)) ||
              (p.proponent && p.proponent.toLowerCase().includes(searchTerm)) ||
              (p.location && p.location.toLowerCase().includes(searchTerm)) ||
              (p.sitio && p.sitio.toLowerCase().includes(searchTerm)) ||
              (p.category && p.category.toLowerCase().includes(searchTerm)) ||
              (p.description && p.description.toLowerCase().includes(searchTerm)) ||
              (p.id && p.id.toLowerCase().includes(searchTerm))
            );
          }

          return matchFilter && matchSearch;
        });

        // 3. Handle Empty State Fallback
        if (filtered.length === 0) {
          grid.innerHTML = '';
          grid.style.display = 'none';
          if (emptyState) emptyState.style.display = 'block';
          return;
        }

        if (emptyState) emptyState.style.display = 'none';
        grid.style.display = 'grid';

        // 4. Render 2-Column Responsive Card Grid
        grid.innerHTML = filtered.map(p => {
          // Map status class for badge pill
          let statusClass = 'pending';
          let statusBulletColor = '#f59e0b';
          if (p.status === 'Under Review') {
            statusClass = 'under-review';
            statusBulletColor = '#0284c7';
          } else if (p.status === 'Approved') {
            statusClass = 'approved';
            statusBulletColor = '#16a34a';
          } else if (p.status === 'Rejected') {
            statusClass = 'rejected';
            statusBulletColor = '#e11d48';
          }

          const categoryTag = `${escapeHtml(p.category || 'Community')} · ${escapeHtml(p.year || '2026')}`;
          const locationText = escapeHtml(p.location || p.sitio || 'Barangay Pallocan Kanluran');
          const proponentText = `Submitted by: <strong>${escapeHtml(p.proponent || 'Citizen')}</strong> · ${escapeHtml(p.date || 'Oct 12, 2026')}`;

          // Quick action buttons in footer
          let footerActions = '';
          if (p.status === 'Pending') {
            footerActions = `
              <button type="button" class="btn-prop-action btn-prop-approve" data-id="${p.id || p.ref}" title="Approve proposal">Approve</button>
              <button type="button" class="btn-prop-action btn-prop-under-review" data-id="${p.id || p.ref}" title="Mark Under Review">Under Review</button>
              <button type="button" class="btn-prop-action btn-prop-reject" data-id="${p.id || p.ref}" title="Reject proposal">Reject</button>
              <button type="button" class="btn-prop-action btn-prop-review" data-id="${p.id || p.ref}">Review Details</button>
            `;
          } else if (p.status === 'Under Review') {
            footerActions = `
              <button type="button" class="btn-prop-action btn-prop-approve" data-id="${p.id || p.ref}" title="Approve proposal">Approve</button>
              <button type="button" class="btn-prop-action btn-prop-reject" data-id="${p.id || p.ref}" title="Reject proposal">Reject</button>
              <button type="button" class="btn-prop-action btn-prop-review" data-id="${p.id || p.ref}">Review Details</button>
            `;
          } else if (p.status === 'Approved') {
            footerActions = `
              <span style="font-size: 11.5px; font-weight: 600; color: #16a34a; margin-right: 4px;">✓ Approved</span>
              <button type="button" class="btn-prop-action btn-prop-under-review" data-id="${p.id || p.ref}" title="Mark Under Review">Under Review</button>
              <button type="button" class="btn-prop-action btn-prop-reject" data-id="${p.id || p.ref}" title="Reject proposal">Reject</button>
              <button type="button" class="btn-prop-action btn-prop-review" data-id="${p.id || p.ref}">Review Details</button>
            `;
          } else {
            // Rejected
            footerActions = `
              <span style="font-size: 11.5px; font-weight: 600; color: #e11d48; margin-right: 4px;">✕ Rejected</span>
              <button type="button" class="btn-prop-action btn-prop-approve" data-id="${p.id || p.ref}" title="Reconsider and approve">Approve</button>
              <button type="button" class="btn-prop-action btn-prop-under-review" data-id="${p.id || p.ref}" title="Mark Under Review">Under Review</button>
              <button type="button" class="btn-prop-action btn-prop-review" data-id="${p.id || p.ref}">Review Details</button>
            `;
          }

          return `
            <div class="proposal-card" data-id="${escapeHtml(p.id || p.ref)}">
              <!-- Card Top Metadata Bar -->
              <div class="proposal-card-top">
                <div class="proposal-card-meta-left">
                  <span class="proposal-status-pill status-${statusClass}">
                    <span class="status-bullet" style="color: ${statusBulletColor};">●</span> ${escapeHtml(p.status)}
                  </span>
                  <span class="proposal-category-tag">${categoryTag}</span>
                </div>
                <div class="proposal-card-quick-actions">
                  <button type="button" class="btn-icon-action btn-edit-proposal" data-id="${p.id || p.ref}" title="Edit / Review Proposal" aria-label="Edit or review proposal">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button type="button" class="btn-icon-action btn-delete-proposal" data-id="${p.id || p.ref}" title="Delete Proposal" aria-label="Delete proposal">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Card Title -->
              <h3 class="proposal-card-title">${escapeHtml(p.title)}</h3>

              <!-- Location Line -->
              <div class="proposal-card-line proposal-location-line">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${locationText}</span>
              </div>

              <!-- Proponent / Resident Line -->
              <div class="proposal-card-line proposal-proponent-line">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>${proponentText}</span>
              </div>

              ${p.timeline ? `
              <div class="proposal-card-line proposal-timeline-line" style="font-size: 12px; color: #64748b; margin-top: 2px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Timeline: <strong>${escapeHtml(p.timeline)}</strong></span>
              </div>
              ` : ''}

              <!-- Description (2-3 lines truncated) -->
              <p class="proposal-card-description">${escapeHtml(p.description || p.rationale || '')}</p>

              <!-- Card Footer Bar -->
              <div class="proposal-card-footer">
                <div class="proposal-footer-budget">
                  <span class="budget-label">Est. Budget:</span>
                  <span class="budget-value">${escapeHtml(p.budget || '₱0.00')}</span>
                </div>
                <div class="proposal-footer-actions">
                  ${footerActions}
                </div>
              </div>
            </div>
          `;
        }).join('');

        // 5. Bind Card Action Events
        bindProposalCardEvents();
      }

      // Centralized status updater that guarantees in-place update (no duplicate) and persistence
      async function updateProposalStatus(id, newStatus, notes) {
        const propIndex = citizenProposals.findIndex(
            p => p.id === id || p.ref === id
        );

        if (propIndex === -1) {
            showAdminToast('Error', 'Proposal not found.', 'error');
            return;
        }

        const prop = citizenProposals[propIndex];

// Retrieve and manage records through the Brgy360 backend API,
// which uses Supabase PostgreSQL as its database.
        if (!prop.proposalId) {
            showAdminToast(
                'Error',
                'Database proposal ID is missing. Please reload the proposals.',
                'error'
            );
            return;
        }

        try {
            const requestBody = {
                status: newStatus
            };

            if (notes !== undefined && notes !== null && notes !== '') {
                requestBody.councilReviewNotes = notes;
            }

            const response = await fetch(
                `http://localhost:5000/api/proposals/admin/${prop.proposalId}/status`,
                {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to update proposal.');
            }

            // Retrieve and manage records through the Brgy360 backend API,
            // which uses Supabase PostgreSQL as its database.
            prop.status = newStatus;

            if (requestBody.councilReviewNotes !== undefined) {
                prop.councilNotes = notes;
                prop.councilNote = notes;
            }

            renderProposalsGrid();

            const displayRef = prop.id || prop.ref;

            if (newStatus === 'Approved') {
                showAdminToast(
                    'Proposal Approved',
                    `"${prop.title}" (${displayRef}) has been changed to Approved.`,
                    'success'
                );
            } else if (newStatus === 'Under Review') {
                showAdminToast(
                    'Proposal Under Review',
                    `"${prop.title}" (${displayRef}) has been changed to Under Review.`,
                    'info'
                );
            } else if (newStatus === 'Rejected') {
                showAdminToast(
                    'Proposal Rejected',
                    `"${prop.title}" (${displayRef}) has been changed to Rejected.`,
                    'warning'
                );
            } else {
                showAdminToast(
                    'Proposal Updated',
                    `"${prop.title}" status has been updated.`,
                    'success'
                );
            }

        } catch (error) {
            console.error('Update proposal status error:', error);

            showAdminToast(
                'Update Failed',
                error.message || 'Unable to save proposal status.',
                'error'
            );
        }
    }

    // Alias for backward compatibility
    function renderProposalsTable() {
        renderProposalsGrid();
    }

    window.renderProposalsTable = renderProposalsTable;
    window.renderProposalsGrid = renderProposalsGrid;

  function showAdminConfirm(title, message, onConfirm) {
    let overlay = document.getElementById('adminInlineConfirmModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'adminInlineConfirmModal';
      overlay.className = 'admin-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = `
        <div class="admin-modal-box" style="max-width: 460px;">
          <div class="modal-header">
            <div>
              <span class="modal-kicker">CONFIRM ADMINISTRATIVE ACTION</span>
              <h3 class="modal-title" id="adminInlineConfirmTitle">Confirm Delete</h3>
            </div>
            <button type="button" class="modal-close-btn" id="adminInlineConfirmClose" aria-label="Close modal">&times;</button>
          </div>
          <div class="modal-body" style="padding: 18px 24px;">
            <p id="adminInlineConfirmMsg" style="font-size: 13.5px; color: #334155; line-height: 1.55; margin: 0; white-space: pre-line;"></p>
          </div>
          <div class="modal-footer" style="padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn-res-close" id="adminInlineConfirmCancel">Cancel</button>
            <button type="button" class="btn-res-reject" id="adminInlineConfirmOk" style="background: #dc2626; color: #ffffff; border-color: #dc2626;">Delete</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (ev) {
        if (ev.target === overlay) overlay.classList.remove('active');
      });
      overlay.querySelector('#adminInlineConfirmClose').addEventListener('click', function () {
        overlay.classList.remove('active');
      });
      overlay.querySelector('#adminInlineConfirmCancel').addEventListener('click', function () {
        overlay.classList.remove('active');
      });
    }
    overlay.querySelector('#adminInlineConfirmTitle').textContent = title;
    overlay.querySelector('#adminInlineConfirmMsg').textContent = message;
    const okBtn = overlay.querySelector('#adminInlineConfirmOk');
    const freshOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(freshOkBtn, okBtn);
    freshOkBtn.addEventListener('click', function () {
      overlay.classList.remove('active');
      if (typeof onConfirm === 'function') onConfirm();
    });
    overlay.classList.add('active');
  }

  // Review & Decision Modal Logic
  function openReviewProposalModal(id) {
    const prop = citizenProposals.find(p => p.id === id || p.ref === id);
    if (!prop) return;

    const modal = document.getElementById('proposalReviewModal');
    const titleEl = document.getElementById('modalPropTitle');
    const idEl = document.getElementById('modalPropId');
    const bodyEl = document.getElementById('modalPropBody');

    if (titleEl) titleEl.textContent = prop.title;
    if (idEl) idEl.textContent = prop.id || prop.ref;

    let statusBadgeClass = 'yellow';
    if (prop.status === 'Approved') statusBadgeClass = 'green';
    if (prop.status === 'Rejected') statusBadgeClass = 'red';
    if (prop.status === 'Under Review') statusBadgeClass = 'blue';

    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <span class="badge-neutral" style="font-weight: 700; margin-right: 6px;">${escapeHtml(prop.category || 'General')}</span>
              <span style="color: #64748b; font-size: 12px;">Fiscal Year ${escapeHtml(prop.year || '2026')}</span>
            </div>
            <div>
              <span class="badge-status ${statusBadgeClass}">● ${escapeHtml(prop.status)}</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
            <div>
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; display: block; font-weight: 700;">Location / Sitio</span>
              <strong style="color: #0f172a;">${escapeHtml(prop.location || prop.sitio || 'Barangay Pallocan West')}</strong>
            </div>
            <div>
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; display: block; font-weight: 700;">Proponent / Submitter</span>
              <strong style="color: #0f172a;">${escapeHtml(prop.proponent || 'Citizen')}</strong>
            </div>
            <div>
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; display: block; font-weight: 700;">Estimated Budget</span>
              <strong style="font-size: 15px; color: #0d47a1;">${escapeHtml(prop.budget)}</strong>
            </div>
            <div>
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; display: block; font-weight: 700;">Proposed Timeline</span>
              <strong style="color: #0f172a;">${escapeHtml(prop.timeline || 'Not specified')}</strong>
            </div>
          </div>

          <div>
            <strong style="display: block; margin-bottom: 6px; color: #0f172a;">Rationale & Community Impact:</strong>
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; color: #334155; line-height: 1.55;">
              ${escapeHtml(prop.description || prop.rationale || '')}
            </div>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label" for="modalCouncilDecisionNotes">Barangay Council Review Notes &amp; Disposition:</label>
            <textarea id="modalCouncilDecisionNotes" class="form-textarea" rows="3" placeholder="Enter council deliberations, committee assignment, or justification for approval/rejection...">${escapeHtml(prop.councilNotes || prop.councilNote || '')}</textarea>
          </div>
        </div>
      `;
    }

    if (modal) modal.classList.add('active');

    // Button: Approve
    const btnApprove = document.getElementById('btnApprovePropInModal');
    if (btnApprove) {
      btnApprove.onclick = function() {
        const notes = document.getElementById('modalCouncilDecisionNotes')?.value.trim();
        updateProposalStatus(id, 'Approved', notes);
        if (modal) modal.classList.remove('active');
      };
    }

    // Button: Mark Under Review
    const btnUnderReview = document.getElementById('btnUnderReviewPropInModal');
    if (btnUnderReview) {
      btnUnderReview.onclick = function() {
        const notes = document.getElementById('modalCouncilDecisionNotes')?.value.trim();
        updateProposalStatus(id, 'Under Review', notes);
        if (modal) modal.classList.remove('active');
      };
    }

    // Button: Reject
    const btnReject = document.getElementById('btnRejectPropInModal');
    if (btnReject) {
      btnReject.onclick = function() {
        const notes = document.getElementById('modalCouncilDecisionNotes')?.value.trim();
        updateProposalStatus(id, 'Rejected', notes);
        if (modal) modal.classList.remove('active');
      };
    }
  }
  window.openReviewProposalModal = openReviewProposalModal;

  const btnClosePropModal = document.getElementById('btnClosePropModal');
  if (btnClosePropModal) {
    btnClosePropModal.addEventListener('click', () => {
      document.getElementById('proposalReviewModal')?.classList.remove('active');
    });
  }

  // Cross-page storage synchronization for proposals & capital projects
  window.addEventListener('storage', function(e) {
    if (e.key === 'brgy360_proposals' || !e.key) {
      citizenProposals = loadCitizenProposals();
      renderProposalsGrid();
      loadCitizenProposalsFromDatabase();
    }
    if (e.key === 'brgy360_capital_projects') {
      loadProjectsFromDatabase();
    }
  });

  window.addEventListener('brgy360_proposals_changed', function() {
    citizenProposals = loadCitizenProposals();
    renderProposalsGrid();
    loadCitizenProposalsFromDatabase();
  });

  // Submit New Proposal Modal Triggers & Form Submission
  const btnOpenSubmitProp = document.getElementById('btnOpenSubmitProposalModal');
  const modalSubmitProp = document.getElementById('submitProposalModal');
  const btnCloseSubmitProp = document.getElementById('btnCloseSubmitPropModal');
  const btnCancelSubmitProp = document.getElementById('btnCancelSubmitProp');
  const btnSaveSubmitProp = document.getElementById('btnSaveSubmitProp');

  if (btnOpenSubmitProp) {
    btnOpenSubmitProp.addEventListener('click', () => {
      if (modalSubmitProp) modalSubmitProp.classList.add('active');
      const titleInput = document.getElementById('newPropTitle');
      if (titleInput) titleInput.focus();
    });
  }

  if (btnCloseSubmitProp) {
    btnCloseSubmitProp.addEventListener('click', () => {
      if (modalSubmitProp) modalSubmitProp.classList.remove('active');
    });
  }

  if (btnCancelSubmitProp) {
    btnCancelSubmitProp.addEventListener('click', () => {
      if (modalSubmitProp) modalSubmitProp.classList.remove('active');
    });
  }

  // Real-time input restrictions and error clearing for Community Proposal modal
  const propTitleInput = document.getElementById('newPropTitle');
  const propProponentInput = document.getElementById('newPropProponent');
  const propBudgetInput = document.getElementById('newPropBudget');
  const propDescInput = document.getElementById('newPropDescription');

  if (propProponentInput) {
    propProponentInput.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-Z\s]/g, '');
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('newPropProponentError');
      if (err) err.textContent = '';
    });
  }

  if (propBudgetInput) {
    propBudgetInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '');
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('newPropBudgetError');
      if (err) err.textContent = '';
    });
  }

  if (propTitleInput) {
    propTitleInput.addEventListener('input', function () {
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('newPropTitleError');
      if (err) err.textContent = '';
    });
  }

  if (propDescInput) {
    propDescInput.addEventListener('input', function () {
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('newPropDescriptionError');
      if (err) err.textContent = '';
    });
  }

  if (btnSaveSubmitProp) {
    btnSaveSubmitProp.addEventListener('click', () => {
      const titleEl = document.getElementById('newPropTitle');
      const propEl = document.getElementById('newPropProponent');
      const budgetEl = document.getElementById('newPropBudget');
      const descEl = document.getElementById('newPropDescription');
      const locEl = document.getElementById('newPropLocation');

      const title = (titleEl?.value || '').trim();
      const category = document.getElementById('newPropCategory')?.value || 'Infrastructure';
      const year = document.getElementById('newPropYear')?.value.trim() || '2026';
      const location = (locEl?.value || '').trim();
      const proponent = (propEl?.value || '').trim();
      const budget = (budgetEl?.value || '').trim();
      const status = document.getElementById('newPropStatus')?.value || 'Pending';
      const description = (descEl?.value || '').trim();

      // Reset prior errors
      const titleErr = document.getElementById('newPropTitleError');
      const propErr = document.getElementById('newPropProponentError');
      const budgetErr = document.getElementById('newPropBudgetError');
      const descErr = document.getElementById('newPropDescriptionError');

      [titleErr, propErr, budgetErr, descErr].forEach(e => { if (e) e.textContent = ''; });
      [titleEl, propEl, budgetEl, descEl].forEach(e => { if (e) e.classList.remove('is-invalid', 'input-error'); });

      let isValid = true;
      let firstInvalid = null;

      if (!title || title.length < 3) {
        if (titleErr) titleErr.textContent = 'Proposal title must be at least 3 characters.';
        if (titleEl) titleEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = titleEl;
      }

      const nameRegex = /^[a-zA-Z\s]+$/;
      if (!proponent) {
        if (propErr) propErr.textContent = 'Proponent / resident name is required.';
        if (propEl) propEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = propEl;
      } else if (!nameRegex.test(proponent)) {
        if (propErr) propErr.textContent = 'Proponent name must contain letters and spaces only. No numbers or special characters.';
        if (propEl) propEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = propEl;
      }

      const budgetNum = parseFloat(budget.replace(/[^\d.]/g, ''));
      if (!budget || isNaN(budgetNum) || budgetNum <= 0) {
        if (budgetErr) budgetErr.textContent = 'Estimated budget must be a positive numeric amount greater than 0.';
        if (budgetEl) budgetEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = budgetEl;
      }

      if (!description || description.length < 10) {
        if (descErr) descErr.textContent = 'Please provide a descriptive scope (at least 10 characters).';
        if (descEl) descEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = descEl;
      }

      if (!isValid) {
        if (firstInvalid) firstInvalid.focus();
        showAdminToast('Validation Error', 'Please correct the highlighted proposal fields.', 'danger');
        return;
      }

      const formattedBudget = `₱${budgetNum.toLocaleString()}`;
      const nextNum = citizenProposals.length + 1;
      const newId = `PROP-2026-${String(nextNum).padStart(3, '0')}`;

      const newProposal = normalizeProposalRecord({
        id: newId,
        ref: newId,
        title: title,
        category: category,
        year: year,
        location: location,
        sitio: location,
        proponent: proponent,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        dateFiled: new Date().toISOString().split('T')[0],
        budget: formattedBudget,
        rawBudget: budgetNum,
        status: status,
        description: description,
        rationale: description
      });

      citizenProposals.unshift(newProposal);
      saveCitizenProposals();
      renderProposalsGrid();

      if (modalSubmitProp) {
        modalSubmitProp.classList.remove('active');
        document.getElementById('submitProposalForm')?.reset();
      }

      showAdminToast('Proposal Submitted', `"${title}" successfully recorded as ${newId}.`, 'success');
    });
  }

  // B. Projects Table Renderer & Dynamic Metrics Engine
  function renderProjectsTable() {
    // 1. Calculate project portfolio metrics dynamically
    const totalProjects = capitalProjects.length;
    const projSectionSub = document.querySelector('#viewProjects .section-sub');
    if (projSectionSub) {
      projSectionSub.textContent = `Comprehensive tracking of all ${totalProjects} infrastructure, technology, and public works project${totalProjects === 1 ? '' : 's'} in Barangay Pallocan West`;
    }
    const ongoingList = capitalProjects.filter(p => p.status === 'ongoing');
    const completedList = capitalProjects.filter(p => p.status === 'completed');
    const planningList = capitalProjects.filter(p => p.status === 'planning');
    const delayedList = capitalProjects.filter(p => p.status === 'delayed');

    const parseBudget = (bStr) => {
      if (!bStr) return 0;
      const clean = String(bStr).replace(/[^0-9.]/g, '');
      return parseFloat(clean) || 0;
    };

    const formatCurrency = (val) => {
      return '₱' + Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const ongoingBudget = ongoingList.reduce((acc, p) => acc + parseBudget(p.budget), 0);
    const completedBudget = completedList.reduce((acc, p) => acc + parseBudget(p.budget), 0);
    const planningBudget = planningList.reduce((acc, p) => acc + parseBudget(p.budget), 0);
    const delayedBudget = delayedList.reduce((acc, p) => acc + parseBudget(p.budget), 0);
    const totalBudget = capitalProjects.reduce((acc, p) => acc + parseBudget(p.budget), 0);

    // Update Project Metric Summary Cards
    const elOngoing = document.getElementById('projMetricCountOngoing');
    if (elOngoing) elOngoing.textContent = ongoingList.length;
    const elOngoingSub = document.getElementById('projMetricSubOngoing');
    if (elOngoingSub) elOngoingSub.textContent = `${formatCurrency(ongoingBudget)} · Active in execution`;

    const elCompleted = document.getElementById('projMetricCountCompleted');
    if (elCompleted) elCompleted.textContent = completedList.length;
    const elCompletedSub = document.getElementById('projMetricSubCompleted');
    if (elCompletedSub) elCompletedSub.textContent = `${formatCurrency(completedBudget)} · Turned over & in service`;

    const elPlanning = document.getElementById('projMetricCountPlanning');
    if (elPlanning) elPlanning.textContent = planningList.length;
    const elPlanningSub = document.getElementById('projMetricSubPlanning');
    if (elPlanningSub) elPlanningSub.textContent = `${formatCurrency(planningBudget)} · Pre-procurement`;

    const elDelayed = document.getElementById('projMetricCountDelayed');
    if (elDelayed) elDelayed.textContent = delayedList.length;
    const elDelayedSub = document.getElementById('projMetricSubDelayed');
    if (elDelayedSub) elDelayedSub.textContent = `${formatCurrency(delayedBudget)} · Pending clearance`;

    const elTotalBudgetValue = document.getElementById('projectTotalBudgetValue');
    if (elTotalBudgetValue) elTotalBudgetValue.textContent = formatCurrency(totalBudget);

    // Update Filter Pill Counters
    const elPillAll = document.getElementById('projPillAll');
    if (elPillAll) elPillAll.textContent = totalProjects;
    const elPillOngoing = document.getElementById('projPillOngoing');
    if (elPillOngoing) elPillOngoing.textContent = ongoingList.length;
    const elPillCompleted = document.getElementById('projPillCompleted');
    if (elPillCompleted) elPillCompleted.textContent = completedList.length;
    const elPillPlanning = document.getElementById('projPillPlanning');
    if (elPillPlanning) elPillPlanning.textContent = planningList.length;
    const elPillDelayed = document.getElementById('projPillDelayed');
    if (elPillDelayed) elPillDelayed.textContent = delayedList.length;

    const elNavCounterProjects = document.getElementById('navCounterProjects');
    if (elNavCounterProjects) elNavCounterProjects.textContent = totalProjects;

    const selectedYear = getActiveDashboardYear();
    refreshAdminDashboard(selectedYear);

    // 2. Render Projects Table Body
    const tbody = document.getElementById('projectsTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('projectsSearchInput')?.value || '').toLowerCase().trim();
    const filtered = capitalProjects.filter(p => {
      const matchFilter = currentProjectFilter === 'all' || p.status === currentProjectFilter;
      const matchSearch = !searchTerm ||
        p.code.toLowerCase().includes(searchTerm) ||
        p.title.toLowerCase().includes(searchTerm) ||
        p.location.toLowerCase().includes(searchTerm) ||
        p.contractor.toLowerCase().includes(searchTerm);
      return matchFilter && matchSearch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 24px;">No capital projects found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const pct = clampProjectProgress(p.progress);
      const statusKey = (p.status === 'delayed' && pct < 100)
        ? 'delayed'
        : calculateProjectStatusFromProgress(pct);
      p.progress = pct;
      p.status = statusKey;

      let badgeClass = 'blue';
      let barColor = '#0d47a1';
      if (statusKey === 'completed') {
        badgeClass = 'green';
        barColor = '#16a34a';
      } else if (statusKey === 'delayed') {
        badgeClass = 'red';
        barColor = '#dc2626';
      } else if (statusKey === 'planning') {
        badgeClass = 'yellow';
        barColor = '#d97706';
      }

      const canMarkDelayed = pct < 100 && statusKey !== 'delayed';

      return `
        <tr>
          <td><code>${escapeHtml(p.code)}</code></td>
          <td><strong>${escapeHtml(p.title)}</strong><br><small style="color: #64748b;">${escapeHtml(p.contractor)}</small></td>
          <td>${escapeHtml(p.location)}</td>
          <td><small>${escapeHtml(p.timeline)}</small></td>
          <td><strong>${escapeHtml(p.budget)}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden; min-width: 50px;" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                <div style="width: ${pct}%; height: 100%; background: ${barColor}; transition: width 0.25s ease, background-color 0.25s ease;"></div>
              </div>
              <span style="font-weight: 700; font-size: 11px; min-width: 30px; text-align: right;">${pct}%</span>
            </div>
          </td>
          <td><span class="badge-status ${badgeClass}">${escapeHtml(statusKey.toUpperCase())}</span></td>
          <td class="text-right">
            <div class="table-actions">
              ${canMarkDelayed ? `<button type="button" class="btn-table-action danger-text" onclick="window.markProjectDelayed('${p.code}')" title="Mark project as behind schedule">Delayed</button>` : ''}
              <button type="button" class="btn-table-action${pct < 100 ? ' primary' : ''}" onclick="window.advanceProjectProgress('${p.code}')">+ Progress</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.advanceProjectProgress = async function(code) {
  const proj = capitalProjects.find(p => p.code === code);
  if (!proj) return;

  const currentPct = clampProjectProgress(proj.progress);

  if (currentPct >= 100) {
    showAdminToast(
      'Project Finished',
      `${proj.title} is already 100% completed.`,
      'info'
    );
    return;
  }

  const previousStatus = proj.status;
  const updatedPct = clampProjectProgress(currentPct + 15);
  const updatedStatus = calculateProjectStatusFromProgress(updatedPct);

  try {
    const response = await fetch(`http://localhost:5000/api/projects/${proj.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        progress_percentage: updatedPct,
        project_status: updatedStatus
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update project progress.');
    }

    await loadProjectsFromDatabase();

    const statusNote = previousStatus !== updatedStatus
      ? ` Status updated from ${previousStatus.toUpperCase()} to ${updatedStatus.toUpperCase()}.`
      : ` Status: ${updatedStatus.toUpperCase()}.`;

    showAdminToast(
      'Project Updated',
      `${proj.title} advanced to ${updatedPct}%.${statusNote}`,
      'success'
    );

  } catch (error) {
    console.error('Advance project progress error:', error);

    showAdminToast(
      'Update Error',
      error.message || 'Unable to update project progress.',
      'danger'
    );
  }
};

  window.markProjectDelayed = async function(code) {
  const proj = capitalProjects.find(p => p.code === code);
  if (!proj) return;

  const currentPct = clampProjectProgress(proj.progress);

  if (currentPct >= 100) {
    showAdminToast(
      'Project Finished',
      `${proj.title} is already 100% completed.`,
      'info'
    );
    return;
  }

  try {
    const response = await fetch(`http://localhost:5000/api/projects/${proj.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        progress_percentage: currentPct,
        project_status: 'delayed'
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update project status.');
    }

    await loadProjectsFromDatabase();

    showAdminToast(
      'Marked Delayed',
      `${proj.title} marked as DELAYED (${currentPct}%).`,
      'warning'
    );

  } catch (error) {
    console.error('Mark project delayed error:', error);

    showAdminToast(
      'Update Error',
      error.message || 'Unable to mark project as delayed.',
      'danger'
    );
  }
};

  // C. Announcements Table Renderer & Dynamic Metrics Engine (Synced with Public Home Page)
  function persistAnnouncementsState() {
    // Retrieve and manage records through the Brgy360 backend API,
    // which uses Supabase PostgreSQL as its database.
  }

  
// Retrieve and manage records through the Brgy360 backend API,
// which uses Supabase PostgreSQL as its database.
  
function normalizeAnnouncementFromDatabase(row) {
  const publicationStatus = String(row.publication_status || '').trim();

  const status = publicationStatus === 'Published'
    ? 'Active'
    : 'Unpublished';

  const content = row.announcement_content || '';
  const publishedDate = row.published_at || row.created_at || '';

  return {
    id: String(row.announcement_id),
    title: row.headline || '',
    category: row.category || 'General',
    audience: row.target_audience || 'All Residents',
    department: 'Sangguniang Barangay',
    date: String(publishedDate).slice(0, 10),
    status: status,
    isCritical: row.urgency === 'Critical',
    isEmergency: row.urgency === 'Critical',
    summary: row.feed_summary || deriveSummaryFromText(content),
    content: content,
    plainContent: htmlToPlainText(content),
    publishedAt: row.published_at
      ? new Date(row.published_at).getTime()
      : 0,
    updatedAt: row.updated_at
      ? new Date(row.updated_at).getTime()
      : 0
  };
}

  // Retrieve and manage records through the Brgy360 backend API,
  // which uses Supabase PostgreSQL as its database.
  async function loadAnnouncementsFromBackend() {
    try {
      const response = await fetch(`${ADMIN_API_BASE}/announcements/admin/all`, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load announcements.');
      }

      announcementsList = (data.announcements || [])
        .map(normalizeAnnouncementFromDatabase);

      renderAnnouncementsTable();

    } catch (error) {
      console.error('Load announcements from database error:', error);

      showAdminToast(
        'Unable to Load Announcements',
        error.message || 'Could not retrieve announcements from the database.',
        'danger'
      );
    }
  }

  function renderAnnouncementsTable() {
    const tbody = document.getElementById('announcementsTableBody');

    // 1. Calculate announcement metrics dynamically
    const totalCount = announcementsList.length;
    const criticalCount = announcementsList.filter(a => !!a.isCritical && a.status === 'Active').length;
    const activeCount = announcementsList.filter(a => a.status === 'Active').length;

    const elTotal = document.getElementById('annMetricTotalCount');
    const elCrit = document.getElementById('annMetricCriticalCount');
    const elActive = document.getElementById('annMetricActiveCount');
    const elNavCounter = document.getElementById('navCounterAnnouncements');
    if (elTotal) elTotal.textContent = totalCount;
    if (elCrit) elCrit.textContent = criticalCount;
    if (elActive) elActive.textContent = activeCount;
    if (elNavCounter) elNavCounter.textContent = activeCount;

    if (!tbody) return;

    // 2. Filter & sort logic (matching public feed order: Active Critical pinned, then latest date & timestamp)
    const searchTerm = (document.getElementById('announcementsSearchInput')?.value || '').toLowerCase().trim();
    const filtered = announcementsList.filter(a => {
      let matchFilter = true;
      if (currentAnnouncementFilter === 'all') {
        matchFilter = true;
      } else if (currentAnnouncementFilter === 'Critical') {
        matchFilter = !!a.isCritical;
      } else if (currentAnnouncementFilter === 'active') {
        matchFilter = a.status === 'Active';
      } else if (currentAnnouncementFilter === 'unpublished') {
        matchFilter = a.status === 'Unpublished';
      } else {
        matchFilter = String(a.category || '').toLowerCase() === String(currentAnnouncementFilter).toLowerCase();
      }

      const plainPreview = a.plainContent || htmlToPlainText(a.content || a.summary || '');
      const matchSearch = !searchTerm ||
        String(a.id || '').toLowerCase().includes(searchTerm) ||
        String(a.title || '').toLowerCase().includes(searchTerm) ||
        String(a.category || '').toLowerCase().includes(searchTerm) ||
        String(a.audience || '').toLowerCase().includes(searchTerm) ||
        String(a.department || '').toLowerCase().includes(searchTerm) ||
        plainPreview.toLowerCase().includes(searchTerm);
      return matchFilter && matchSearch;
    }).sort((a, b) => {
      const aActiveCrit = a.status === 'Active' && !!a.isCritical;
      const bActiveCrit = b.status === 'Active' && !!b.isCritical;
      if (aActiveCrit && !bActiveCrit) return -1;
      if (!aActiveCrit && bActiveCrit) return 1;
      const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCmp !== 0) return dateCmp;
      return (Number(b.publishedAt) || 0) - (Number(a.publishedAt) || 0);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 28px; font-weight: 500;">No announcements or advisories matching criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(a => {
      let badgeClass = 'blue';
      if (a.category === 'Emergency') badgeClass = 'red';
      else if (a.category === 'Health') badgeClass = 'yellow';
      else if (a.category === 'Social Services') badgeClass = 'green';

      let statusBadgeClass = 'yellow';
      let statusLabel = a.status || 'Active';
      if (a.status === 'Active') {
        statusBadgeClass = 'green';
        statusLabel = 'Active (Public)';
      } else if (a.status === 'Unpublished') {
        statusBadgeClass = 'grey';
        statusLabel = 'Unpublished';
      }

      const excerptSource = a.summary || a.plainContent || htmlToPlainText(a.content || '');
      const safeIdAttr = escapeHtml(String(a.id));

      
      let statusActionsHtml = '';

      if (a.status === 'Active') {
        statusActionsHtml = `
          <button
            type="button"
            class="btn-table-action"
            onclick="window.setAnnouncementStatus('${safeIdAttr}', 'Unpublished')"
            title="Hide from public home page">
            Unpublish
          </button>
        `;
      } else {
        statusActionsHtml = `
          <button
            type="button"
            class="btn-table-action primary"
            onclick="window.setAnnouncementStatus('${safeIdAttr}', 'Active')"
            title="Publish live to public home page">
            Broadcast
          </button>
        `;
      }

      return `
        <tr style="${a.isCritical && a.status === 'Active' ? 'background: #fff8f8;' : ''}">
          <td><code>${escapeHtml(a.id)}</code></td>
          <td>
            ${a.isCritical ? '<div style="margin-bottom: 3px;"><span class="badge-critical-mini">🚨 CRITICAL ADVISORY</span></div>' : ''}
            <strong>${escapeHtml(a.title)}</strong><br>
            <small style="color: #64748b; display: block; margin-top: 2px;">${escapeHtml(truncate(excerptSource, 85))}</small>
            <small style="color: #94a3b8; font-size: 11px;">Issued by: ${escapeHtml(a.department || 'Sangguniang Barangay')}</small>
          </td>
          <td>
            ${a.isCritical ?
              `<span class="badge-status badge-critical-pill"><span class="status-dot dot-red"></span>Critical Advisory</span>` :
              `<span class="badge-status badge-standard-pill"><span class="dot-gray"></span>Standard</span>`
            }
          </td>
          <td><span class="badge-status ${badgeClass}">${escapeHtml(a.category)}</span></td>
          <td>${escapeHtml(a.audience)}</td>
          <td>${escapeHtml(a.date)}</td>
          <td><span class="badge-status ${statusBadgeClass}">${escapeHtml(statusLabel)}</span></td>
          <td class="text-right">
            <div style="display: inline-flex; align-items: center; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
              <button type="button" class="btn-table-action" onclick="window.openEditAnnouncementModal('${safeIdAttr}')" title="Edit announcement details">Edit</button>
              <button type="button" class="btn-table-action ${a.isCritical ? 'btn-priority-labeled' : 'btn-priority-label'}" onclick="window.toggleAnnouncementPriority('${safeIdAttr}')" title="${a.isCritical ? 'Click to remove Critical Priority label' : 'Click to label as Critical Priority / Emergency Advisory'}">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: -1px; margin-right: 3px;">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                ${a.isCritical ? 'Remove Critical' : 'Mark Critical'}
              </button>
              ${statusActionsHtml}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  

  // ==========================================
  // ADMIN: Publish and unpublish announcements
  // ==========================================
  window.setAnnouncementStatus = async function(id, nextStatus) {
    const ann = announcementsList.find(a => String(a.id) === String(id));
    if (!ann) return;

    if (nextStatus !== 'Active' && nextStatus !== 'Unpublished') {
      return;
    }

    try {
      const publicationStatus = nextStatus === 'Active'
        ? 'Published'
        : 'Unpublished';

      const response = await fetch(
        `${ADMIN_API_BASE}/announcements/${encodeURIComponent(id)}/status`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            publication_status: publicationStatus
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update announcement status.');
      }

      // Reload actual database records.
      await loadAnnouncementsFromBackend();

      if (nextStatus === 'Active') {
        showAdminToast(
          'Broadcast Live',
          `"${ann.title}" is now published on the Public Home Page.`,
          'success'
        );
      } else {
        showAdminToast(
          'Announcement Unpublished',
          `"${ann.title}" is now hidden from the Public Home Page.`,
          'info'
        );
      }

    } catch (error) {
      console.error('Update announcement status error:', error);

      showAdminToast(
        'Status Update Failed',
        error.message || 'Could not update announcement status.',
        'danger'
      );
    }
  };

  // Toggle between Published and Unpublished.
  window.toggleAnnouncementStatus = function(id) {
    const ann = announcementsList.find(a => String(a.id) === String(id));
    if (!ann) return;

    const nextStatus = ann.status === 'Active'
      ? 'Unpublished'
      : 'Active';

    window.setAnnouncementStatus(id, nextStatus);
  };

  // Toggle Critical Priority / Emergency Advisory status
  window.toggleAnnouncementPriority = async function(id) {
    const ann = announcementsList.find(a => String(a.id) === String(id));
    if (!ann) return;

    const nextCritical = !ann.isCritical;
    ann.isCritical = nextCritical;
    ann.isEmergency = nextCritical;
    ann.urgency = nextCritical ? 'Critical' : 'Standard';

    try {
      saveAnnouncements(announcementsList);
    } catch (e) {
      console.warn('LocalStorage announcement sync error:', e);
    }

    renderAnnouncementsTable();

    try {
      await fetch(`${ADMIN_API_BASE}/announcements/${encodeURIComponent(id)}/priority`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_critical: nextCritical,
          urgency: nextCritical ? 'Critical' : 'Standard'
        })
      });
    } catch (error) {
      console.warn('Backend announcement priority update optional sync:', error);
    }

    showAdminToast(
      nextCritical ? '🚨 Marked as Critical Priority' : 'Standard Priority Restored',
      `"${ann.title}" is now ${nextCritical ? 'flagged with Critical Advisory badge and prioritized.' : 'marked as standard priority.'}`,
      nextCritical ? 'warning' : 'info'
    );
  };

  // Event Listeners for Proposals Filters
  document.querySelectorAll('#proposalsFilterGroup .filter-pill').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#proposalsFilterGroup .filter-pill').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentProposalFilter = this.getAttribute('data-status');
      renderProposalsTable();
    });
  });

  // Click on any of the 4 Proposals Metric Cards to filter directly
  const metricCardStatuses = ['Pending', 'Under Review', 'Approved', 'Rejected'];
  document.querySelectorAll('#proposalMetricsBar .proposal-metric-card').forEach((card, idx) => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const targetStatus = metricCardStatuses[idx];
      const targetPill = document.querySelector(`#proposalsFilterGroup .filter-pill[data-status="${targetStatus}"]`);
      if (targetPill) targetPill.click();
    });
  });

  const propSearch = document.getElementById('proposalsSearchInput');
  if (propSearch) propSearch.addEventListener('input', renderProposalsTable);

  // Projects Filters
  document.querySelectorAll('#projectsStatusFilterGroup .filter-pill').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#projectsStatusFilterGroup .filter-pill').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentProjectFilter = this.getAttribute('data-status');
      renderProjectsTable();
    });
  });

  document.querySelectorAll('#projectMetricsBar .proposal-metric-card').forEach(card => {
    card.addEventListener('click', function() {
      const status = this.getAttribute('data-status');
      if (!status) return;
      const targetPill = document.querySelector(`#projectsStatusFilterGroup .filter-pill[data-status="${status}"]`);
      if (targetPill) targetPill.click();
    });
  });

  const projSearch = document.getElementById('projectsSearchInput');
  if (projSearch) projSearch.addEventListener('input', renderProjectsTable);

  // Announcements Filters
  document.querySelectorAll('#announcementsFilterGroup .filter-pill').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#announcementsFilterGroup .filter-pill').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentAnnouncementFilter = this.getAttribute('data-category');
      renderAnnouncementsTable();
    });
  });

  // Announcements Metric Cards Click Handlers
  document.querySelectorAll('#announcementMetricsBar .proposal-metric-card').forEach(card => {
    card.addEventListener('click', function() {
      const cat = this.getAttribute('data-category');
      if (!cat) return;
      const targetPill = document.querySelector(`#announcementsFilterGroup .filter-pill[data-category="${cat}"]`);
      if (targetPill) {
        targetPill.click();
      } else {
        document.querySelectorAll('#announcementsFilterGroup .filter-pill').forEach(b => b.classList.remove('active'));
        currentAnnouncementFilter = cat;
        renderAnnouncementsTable();
      }
    });
  });

  const annSearch = document.getElementById('announcementsSearchInput');
  if (annSearch) annSearch.addEventListener('input', renderAnnouncementsTable);

  // Create & Edit Announcement Modal Triggers & Priority Toggle Card
  const btnOpenNewAnnModal = document.getElementById('btnOpenNewAnnouncementModal');
  const modalNewAnn = document.getElementById('newAnnouncementModal');
  const btnCloseNewAnnModal = document.getElementById('btnCloseNewAnnModal');
  const btnCancelNewAnn = document.getElementById('btnCancelNewAnn');
  const btnSubmitNewAnn = document.getElementById('btnSubmitNewAnn');
  const btnToggleCriticalPriority = document.getElementById('btnToggleCriticalPriority');
  const annIsCriticalInput = document.getElementById('annIsCritical');
  const criticalToggleBadge = document.getElementById('criticalToggleBadge');
  const annEditIdInput = document.getElementById('annEditId');
  const annCategorySelect = document.getElementById('annCategory');
  const annDepartmentInput = document.getElementById('annDepartment');
  const annDateInput = document.getElementById('annDate');
  const annStatusSelect = document.getElementById('annStatus');
  const annSummaryInput = document.getElementById('annSummary');
  const annModalKicker = document.getElementById('annModalKicker');
  const annModalTitle = document.getElementById('annModalTitle');
  const annModalSub = document.getElementById('annModalSub');

  function setModalPriorityState(isCritical, autoSwitchCategory = true) {
    if (!btnToggleCriticalPriority || !annIsCriticalInput || !criticalToggleBadge) return;
    if (isCritical) {
      btnToggleCriticalPriority.classList.add('is-critical');
      annIsCriticalInput.value = 'true';
      criticalToggleBadge.innerHTML = '<span class="status-dot dot-red"></span><span class="badge-text">🚨 Critical Priority</span>';
      if (autoSwitchCategory && annCategorySelect && annCategorySelect.value !== 'Emergency') {
        const prevDefaultDept = DEFAULT_DEPARTMENT_BY_CATEGORY[annCategorySelect.value] || '';
        annCategorySelect.value = 'Emergency';
        if (annDepartmentInput && (!annDepartmentInput.value.trim() || annDepartmentInput.value.trim() === prevDefaultDept)) {
          annDepartmentInput.value = DEFAULT_DEPARTMENT_BY_CATEGORY.Emergency;
        }
      }
    } else {
      btnToggleCriticalPriority.classList.remove('is-critical');
      annIsCriticalInput.value = 'false';
      criticalToggleBadge.innerHTML = '<span class="dot-gray"></span><span class="badge-text">Standard</span>';
    }
  }

  if (annCategorySelect && annDepartmentInput) {
    annCategorySelect.addEventListener('change', () => {
      const currentDept = annDepartmentInput.value.trim();
      const isDefaultDept = !currentDept || Object.values(DEFAULT_DEPARTMENT_BY_CATEGORY).includes(currentDept);
      if (isDefaultDept) {
        annDepartmentInput.value = DEFAULT_DEPARTMENT_BY_CATEGORY[annCategorySelect.value] || 'Sangguniang Barangay Secretariat';
      }
    });
  }

  if (btnToggleCriticalPriority) {
    btnToggleCriticalPriority.addEventListener('click', () => {
      const currentlyCritical = annIsCriticalInput?.value === 'true';
      setModalPriorityState(!currentlyCritical, true);
    });
  }

  function clearAnnouncementFormValidation() {
    const titleEl = document.getElementById('annTitle');
    const contentEl = document.getElementById('annContent');
    const titleErr = document.getElementById('annTitleError');
    const contentErr = document.getElementById('annContentError');
    [titleErr, contentErr].forEach(e => { if (e) e.textContent = ''; });
    [titleEl, contentEl].forEach(e => { if (e) e.classList.remove('is-invalid', 'input-error'); });
  }

  function openCreateAnnouncementModal() {
    document.getElementById('newAnnouncementForm')?.reset();
    clearAnnouncementFormValidation();
    if (annEditIdInput) annEditIdInput.value = '';
    if (annCategorySelect) annCategorySelect.value = 'General';
    const audEl = document.getElementById('annAudience');
    if (audEl) audEl.value = 'All Residents';
    if (annDepartmentInput) {
      annDepartmentInput.value = DEFAULT_DEPARTMENT_BY_CATEGORY.General;
    }
    if (annDateInput) annDateInput.value = getLocalTodayISO();
    if (annStatusSelect) annStatusSelect.value = 'Active';
    if (annSummaryInput) {
      annSummaryInput.value = '';
      annSummaryInput.dataset.initialSummary = '';
      annSummaryInput.dataset.wasAutoDerived = 'true';
    }
    const contentEl = document.getElementById('annContent');
    if (contentEl) {
      contentEl.value = '';
      contentEl.dataset.initialPlain = '';
    }
    setModalPriorityState(false, false);

    if (annModalKicker) annModalKicker.textContent = 'COMMUNICATIONS · BROADCAST ADVISORY';
    if (annModalTitle) annModalTitle.textContent = 'Create Official Announcement';
    if (annModalSub) annModalSub.textContent = 'Broadcast to Public Portal & Resident Feeds';
    if (btnSubmitNewAnn) btnSubmitNewAnn.textContent = 'Broadcast Announcement';

    modalNewAnn?.classList.add('active');
  }

  window.openEditAnnouncementModal = function(id) {
    const ann = announcementsList.find(a => String(a.id) === String(id));
    if (!ann) return;

    clearAnnouncementFormValidation();
    if (annEditIdInput) annEditIdInput.value = String(ann.id);

    const titleEl = document.getElementById('annTitle');
    const audEl = document.getElementById('annAudience');
    const contentEl = document.getElementById('annContent');

    if (titleEl) titleEl.value = ann.title || '';
    if (annCategorySelect) {
      const hasOption = Array.from(annCategorySelect.options).some(opt => opt.value === ann.category);
      annCategorySelect.value = hasOption ? ann.category : 'General';
    }
    if (audEl) {
      const hasAud = Array.from(audEl.options).some(opt => opt.value === ann.audience);
      audEl.value = hasAud ? ann.audience : 'All Residents';
    }
    if (annDepartmentInput) {
      annDepartmentInput.value = ann.department || DEFAULT_DEPARTMENT_BY_CATEGORY[ann.category] || 'Sangguniang Barangay Secretariat';
    }
    if (annDateInput) {
      annDateInput.value = ann.date || getLocalTodayISO();
    }
    if (annStatusSelect) {
      annStatusSelect.value = ann.status || 'Active';
    }

    const initialPlain = ann.plainContent || htmlToPlainText(ann.content || ann.summary || '');
    const derivedFromInitial = deriveSummaryFromText(initialPlain);
    const currentSummary = ann.summary || '';

    if (annSummaryInput) {
      annSummaryInput.value = currentSummary;
      annSummaryInput.dataset.initialSummary = currentSummary;
      annSummaryInput.dataset.wasAutoDerived = (!currentSummary || currentSummary === derivedFromInitial) ? 'true' : 'false';
    }
    if (contentEl) {
      contentEl.value = initialPlain;
      contentEl.dataset.initialPlain = initialPlain;
    }

    setModalPriorityState(Boolean(ann.isCritical), false);

    if (annModalKicker) annModalKicker.textContent = `EDIT OFFICIAL NOTICE · ${ann.id}`;
    if (annModalTitle) annModalTitle.textContent = 'Edit Barangay Announcement';
    if (annModalSub) annModalSub.textContent = 'Changes synchronize automatically with the Public Home Page';
    if (btnSubmitNewAnn) btnSubmitNewAnn.textContent = 'Save & Sync Changes';

    modalNewAnn?.classList.add('active');
  };

  if (btnOpenNewAnnModal) {
    btnOpenNewAnnModal.addEventListener('click', openCreateAnnouncementModal);
  }
  if (btnCloseNewAnnModal) {
    btnCloseNewAnnModal.addEventListener('click', () => {
      setModalPriorityState(false, false);
      modalNewAnn?.classList.remove('active');
    });
  }
  if (btnCancelNewAnn) {
    btnCancelNewAnn.addEventListener('click', () => {
      setModalPriorityState(false, false);
      modalNewAnn?.classList.remove('active');
    });
  }

  // Real-time input clearing for Announcement Form
  const annTitleInput = document.getElementById('annTitle');
  const annContentInput = document.getElementById('annContent');

  if (annTitleInput) {
    annTitleInput.addEventListener('input', function () {
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('annTitleError');
      if (err) err.textContent = '';
    });
  }

  if (annContentInput) {
    annContentInput.addEventListener('input', function () {
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('annContentError');
      if (err) err.textContent = '';
    });
  }

  if (btnSubmitNewAnn) {
    btnSubmitNewAnn.addEventListener('click', async () => {
      const titleEl = document.getElementById('annTitle');
      const catEl = document.getElementById('annCategory');
      const audEl = document.getElementById('annAudience');
      const contentEl = document.getElementById('annContent');

      const editingId = (annEditIdInput?.value || '').trim();
      const title = (titleEl?.value || '').trim();
      const cat = catEl?.value || 'General';
      const aud = audEl?.value || 'All Residents';
      const department = (annDepartmentInput?.value || '').trim() || DEFAULT_DEPARTMENT_BY_CATEGORY[cat] || 'Sangguniang Barangay Secretariat';
      const datePublished = (annDateInput?.value || '').trim() || getLocalTodayISO();
      const status = annStatusSelect?.value || 'Active';
      const rawSummary = (annSummaryInput?.value || '').trim();
      const rawContent = (contentEl?.value || '').trim();
      const isCritical = annIsCriticalInput?.value === 'true';

      clearAnnouncementFormValidation();

      let isValid = true;
      let firstInvalid = null;

      if (!title || title.length < 3) {
        const titleErr = document.getElementById('annTitleError');
        if (titleErr) titleErr.textContent = 'Please enter an announcement headline (at least 3 characters).';
        if (titleEl) titleEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = titleEl;
      }

      if (!rawContent || rawContent.length < 10) {
        const contentErr = document.getElementById('annContentError');
        if (contentErr) contentErr.textContent = 'Please provide detailed announcement content (at least 10 characters).';
        if (contentEl) contentEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = contentEl;
      }

      if (!isValid) {
        if (firstInvalid) firstInvalid.focus();
        showAdminToast('Validation Error', 'Please complete all required fields.', 'danger');
        return;
      }

      if (editingId) {
        const existingIdx = announcementsList.findIndex(a => String(a.id) === editingId);
        if (existingIdx !== -1) {
          const prev = announcementsList[existingIdx];
          const initialPlain = contentEl?.dataset.initialPlain ?? '';
          const contentChanged = rawContent !== initialPlain;
          const initialSummary = annSummaryInput?.dataset.initialSummary ?? '';
          const summaryChanged = rawSummary !== initialSummary;
          const wasAutoDerived = annSummaryInput?.dataset.wasAutoDerived === 'true';

          const finalHtmlContent = rawContent;
          let finalSummary = rawSummary;
          if (!rawSummary || (contentChanged && !summaryChanged && wasAutoDerived)) {
            finalSummary = deriveSummaryFromText(rawContent);
          }

          announcementsList[existingIdx] = normalizeAnnouncement({
            ...prev,
            title,
            category: cat,
            audience: aud,
            department,
            date: datePublished,
            status,
            isCritical,
            isEmergency: isCritical,
            summary: finalSummary,
            content: finalHtmlContent,
            plainContent: rawContent,
            publishedAt: prev.publishedAt || Date.now(),
            updatedAt: Date.now()
          }, existingIdx);

          persistAnnouncementsState();
          renderAnnouncementsTable();
          modalNewAnn?.classList.remove('active');
          document.getElementById('newAnnouncementForm')?.reset();
          if (annEditIdInput) annEditIdInput.value = '';
          setModalPriorityState(false, false);

          showAdminToast(
            'Announcement Updated',
            status === 'Active'
              ? `"${title}" updated and synchronized with the Public Home Page.`
              : `"${title}" saved with status: ${status} (hidden from Public Home Page).`,
            'success'
          );
          return;
        }
      }

            try {
        btnSubmitNewAnn.disabled = true;
        btnSubmitNewAnn.textContent = 'Saving...';

        const response = await fetch(`${ADMIN_API_BASE}/announcements`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            headline: title,
            category: cat,
            target_audience: aud,
            urgency: isCritical ? 'Critical' : 'Standard',
            feed_summary: rawSummary || deriveSummaryFromText(rawContent),
            announcement_content: rawContent,
            publication_status: status === 'Active' ? 'Published' : 'Unpublished',
            published_at: status === 'Active' ? datePublished : null
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Unable to save announcement.');
        }

        await loadAnnouncementsFromBackend();

        modalNewAnn?.classList.remove('active');
        document.getElementById('newAnnouncementForm')?.reset();

        if (annEditIdInput) annEditIdInput.value = '';
        setModalPriorityState(false, false);

        showAdminToast(
          'Announcement Saved',
          `"${title}" has been saved to the database.`,
          'success'
        );

      } catch (error) {
        console.error('Create announcement error:', error);

        showAdminToast(
          'Announcement Error',
          error.message || 'Unable to save announcement.',
          'danger'
        );

      } finally {
        btnSubmitNewAnn.disabled = false;
        btnSubmitNewAnn.textContent = 'Broadcast Announcement';
      }
    });
  }

  // Retrieve and manage records through the Brgy360 backend API,
  // which uses Supabase PostgreSQL as its database.

  // New Project Modal Triggers
  const btnNewProjectModal = document.getElementById('btnNewProjectModal');
  const modalNewProj = document.getElementById('newProjectModal');
  const btnCloseNewProjModal = document.getElementById('btnCloseNewProjModal');
  const btnCancelNewProj = document.getElementById('btnCancelNewProj');
  const btnSubmitNewProj = document.getElementById('btnSubmitNewProj');
  const projStatusSelect = document.getElementById('projStatus');
  const projProgressInput = document.getElementById('projProgress');

  function syncNewProjectModalStatusFromProgress() {
    if (!projProgressInput || !projStatusSelect) return;
    const rawVal = projProgressInput.value;
    const pct = rawVal === '' ? 0 : clampProjectProgress(rawVal);
    projStatusSelect.value = calculateProjectStatusFromProgress(pct);
  }

  if (projProgressInput) {
    projProgressInput.addEventListener('input', syncNewProjectModalStatusFromProgress);
    projProgressInput.addEventListener('change', function () {
      const pct = this.value === '' ? 0 : clampProjectProgress(this.value);
      this.value = String(pct);
      syncNewProjectModalStatusFromProgress();
    });
  }

  if (projStatusSelect && projProgressInput) {
    projStatusSelect.addEventListener('change', function () {
      const selected = this.value;
      const pct = projProgressInput.value === '' ? 0 : clampProjectProgress(projProgressInput.value);
      if (selected === 'completed') {
        projProgressInput.value = '100';
      } else if (selected === 'ongoing' && (pct < 25 || pct === 100)) {
        projProgressInput.value = '25';
      } else if (selected === 'planning' && pct >= 25) {
        projProgressInput.value = '0';
      } else if (selected === 'delayed' && pct === 100) {
        projProgressInput.value = '85';
      }
    });
  }

  if (btnNewProjectModal) {
    btnNewProjectModal.addEventListener('click', () => {
      syncNewProjectModalStatusFromProgress();
      modalNewProj?.classList.add('active');
    });
  }
  if (btnCloseNewProjModal) btnCloseNewProjModal.addEventListener('click', () => modalNewProj?.classList.remove('active'));
  if (btnCancelNewProj) btnCancelNewProj.addEventListener('click', () => modalNewProj?.classList.remove('active'));

  // Real-time restrictions and clearing for Project Form
  const projBudgetInput = document.getElementById('projBudget');
  const projTitleInput = document.getElementById('projTitle');
  const projScopeInput = document.getElementById('projScope');
const projBeneficiariesInput = document.getElementById('projBeneficiaries');

  if (projBudgetInput) {
    projBudgetInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '');
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('projBudgetError');
      if (err) err.textContent = '';
    });
  }

  if (projTitleInput) {
    projTitleInput.addEventListener('input', function () {
      this.classList.remove('is-invalid', 'input-error');
      const err = document.getElementById('projTitleError');
      if (err) err.textContent = '';
    });
  }

  if (projScopeInput) {
  projScopeInput.addEventListener('input', function () {
    this.classList.remove('is-invalid', 'input-error');
    const err = document.getElementById('projScopeError');
    if (err) err.textContent = '';
  });
}

if (projBeneficiariesInput) {
  projBeneficiariesInput.addEventListener('input', function () {
    this.classList.remove('is-invalid', 'input-error');
    const err = document.getElementById('projBeneficiariesError');
    if (err) err.textContent = '';
  });
}

  if (btnSubmitNewProj) {
  btnSubmitNewProj.addEventListener('click', async () => {
    const titleEl = document.getElementById('projTitle');
    const locEl = document.getElementById('projLocation');
    const budgetEl = document.getElementById('projBudget');
    const statusEl = document.getElementById('projStatus');
    const progressEl = document.getElementById('projProgress');
    const scopeEl = document.getElementById('projScope');
    const beneficiariesEl = document.getElementById('projBeneficiaries');

    const title = (titleEl?.value || '').trim();
    const loc = (locEl?.value || '').trim();
    const budget = (budgetEl?.value || '').trim();
    const scope = (scopeEl?.value || '').trim();
    const beneficiaries = (beneficiariesEl?.value || '').trim();

    const rawProgress = progressEl && progressEl.value !== ''
      ? progressEl.value
      : '0';

    const progress = clampProjectProgress(rawProgress);
    const requestedStatus = (statusEl?.value || '').toLowerCase();

    const status = (requestedStatus === 'delayed' && progress < 100)
      ? 'delayed'
      : calculateProjectStatusFromProgress(progress);

    const titleErr = document.getElementById('projTitleError');
    const budgetErr = document.getElementById('projBudgetError');
    const scopeErr = document.getElementById('projScopeError');
    const beneficiariesErr = document.getElementById('projBeneficiariesError');

    [titleErr, budgetErr, scopeErr, beneficiariesErr].forEach(e => {
      if (e) e.textContent = '';
    });

    [titleEl, budgetEl, scopeEl, beneficiariesEl].forEach(e => {
      if (e) e.classList.remove('is-invalid', 'input-error');
    });

    let isValid = true;
    let firstInvalid = null;

    if (!title || title.length < 3) {
      if (titleErr) titleErr.textContent = 'Project title must be at least 3 characters.';
      if (titleEl) titleEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = titleEl;
    }

    const budgetNum = parseFloat(budget.replace(/[^\d.]/g, ''));

    if (!budget || !Number.isFinite(budgetNum) || budgetNum <= 0) {
      if (budgetErr) budgetErr.textContent = 'Budget must be numeric and greater than 0.';
      if (budgetEl) budgetEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = budgetEl;
    }

    if (!scope || scope.length < 10) {
      if (scopeErr) scopeErr.textContent = 'Project scope must be at least 10 characters.';
      if (scopeEl) scopeEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = scopeEl;
    }

    if (!beneficiaries || beneficiaries.length < 5) {
      if (beneficiariesErr) beneficiariesErr.textContent = 'Target beneficiaries must be at least 5 characters.';
      if (beneficiariesEl) beneficiariesEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = beneficiariesEl;
    }

    if (!isValid) {
      if (firstInvalid) firstInvalid.focus();
      showAdminToast('Validation Error', 'Please correct the highlighted project fields.', 'danger');
      return;
    }

    btnSubmitNewProj.disabled = true;

    try {
      const response = await fetch('http://localhost:5000/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_title: title,
          location_purok: loc,
          allocated_budget: budgetNum,
          initial_status: status,
          progress_percentage: progress,
          project_scope: scope,
          target_beneficiaries: beneficiaries,
          project_status: status
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create project.');
      }

      await loadProjectsFromDatabase();

      modalNewProj?.classList.remove('active');
      document.getElementById('newProjectForm')?.reset();
      syncNewProjectModalStatusFromProgress();

      showAdminToast(
        'Project Added',
        `${title} saved successfully (${progress}% · ${status.toUpperCase()}).`,
        'success'
      );

    } catch (error) {
      console.error('Create project error:', error);

      showAdminToast(
        'Project Error',
        error.message || 'Unable to save project.',
        'danger'
      );

    } finally {
      btnSubmitNewProj.disabled = false;
    }
  });
}

  // Settings Save Trigger
  const btnSaveAdminSettings = document.getElementById('btnSaveAdminSettings');
  if (btnSaveAdminSettings) {
    btnSaveAdminSettings.addEventListener('click', () => {
      showAdminToast('Settings Preserved', 'Governance Console preferences saved successfully.', 'success');
    });
  }

  // ==============================================================
  // 11. BUDGET ALLOCATION & EXPENSE RECORDS (ADMIN PORTAL & PUBLIC SYNC)
  // ==============================================================
  function formatPHP(amount) {
    return formatCurrencyPHP(amount);
  }

  function syncAdminBudgetYearSelectors() {
    const years = getAvailableFiscalYears(adminBudgetRecords);

    const adminYearSelect = document.getElementById('adminBudgetYearFilter');
    if (adminYearSelect) {
      const prev = adminYearSelect.value || '2026';
      adminYearSelect.innerHTML =
        '<option value="all">All Years</option>' +
        years.map((y) => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join('');
      adminYearSelect.value = prev === 'all' || years.includes(prev) ? prev : (years[0] || '2026');
    }

    const sumYearSelect = document.getElementById('sumEditYear');
    if (sumYearSelect) {
      const prevSum = sumYearSelect.value || '2026';
      sumYearSelect.innerHTML = years
        .map((y) => `<option value="${escapeHtml(y)}">FY ${escapeHtml(y)}</option>`)
        .join('');
      sumYearSelect.value = years.includes(prevSum) ? prevSum : (years[0] || '2026');
    }

    ['dashboardFiscalYearSelect', 'reportsFiscalYearSelect'].forEach((selId) => {
      const sel = document.getElementById(selId);
      if (sel) {
        const prevVal = sel.value || '2026';
        sel.innerHTML = years
          .map((y) => `<option value="${escapeHtml(y)}">FY ${escapeHtml(y)}</option>`)
          .join('');
        sel.value = years.includes(prevVal) ? prevVal : (years[0] || '2026');
      }
    });
  }

  function initAdminPublicSyncedCharts() {
    if (typeof Chart === 'undefined') return;

    const barCanvas = document.getElementById('adminBudgetQuarterBarChart');
    if (barCanvas && !adminBudgetQuarterBarChart) {
      adminBudgetQuarterBarChart = new Chart(barCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: [...BUDGET_QUARTERS],
          datasets: [
            {
              label: 'Budget',
              data: [0, 0, 0, 0],
              backgroundColor: '#0d47a1',
              borderRadius: 6,
              barPercentage: 0.65,
              categoryPercentage: 0.6
            },
            {
              label: 'Actual',
              data: [0, 0, 0, 0],
              backgroundColor: '#f59e0b',
              borderRadius: 6,
              barPercentage: 0.65,
              categoryPercentage: 0.6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: { boxWidth: 12, font: { size: 11.5, weight: '600' }, color: '#334155' }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${formatPHP(ctx.raw)}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11.5, weight: '600' }, color: '#475569' }
            },
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: {
                callback: (val) => {
                  const num = Number(val) || 0;
                  if (num === 0) return '₱0';
                  if (Math.abs(num) >= 1000000) {
                    return '₱' + (Math.round((num / 1000000) * 100) / 100).toLocaleString('en-PH') + 'M';
                  }
                  return '₱' + Math.round(num / 1000).toLocaleString('en-PH') + 'k';
                }
              }
            }
          }
        }
      });
    }

    const pieCanvas = document.getElementById('adminBudgetCategoryPieChart');
    if (pieCanvas && !adminBudgetCategoryPieChart) {
      adminBudgetCategoryPieChart = new Chart(pieCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Infrastructure', 'Health', 'Administration', 'Social Services'],
          datasets: [
            {
              data: [0, 0, 0, 0],
              backgroundColor: ['#0d47a1', '#16a34a', '#f59e0b', '#7c3aed'],
              borderWidth: 2,
              borderColor: '#ffffff',
              hoverOffset: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 10, font: { size: 11, weight: '500' }, color: '#334155', padding: 12 }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              callbacks: {
                label: (ctx) => {
                  if (ctx.label === 'No Active Budget Data') return ' ₱0 (0%)';
                  const ds = ctx.dataset.data || [];
                  const total = ds.reduce((a, b) => a + (Number(b) || 0), 0);
                  const raw = Number(ctx.raw) || 0;
                  const pct = total > 0 ? formatPercentValue((raw / total) * 100) : '0%';
                  return ` ${ctx.label}: ${formatPHP(raw)} (${pct})`;
                }
              }
            }
          }
        }
      });
    }
  }

  function updateAdminPublicSyncedCharts(selectedYear = '2026', selectedQuarter = 'all', selectedCategory = 'all') {
    const applicable = adminBudgetRecords.filter(
      (r) => isApplicableBudgetRecord(r) && (selectedYear === 'all' || String(r.year) === String(selectedYear))
    );

    if (adminBudgetQuarterBarChart) {
      const quarters = selectedQuarter === 'all' ? [...BUDGET_QUARTERS] : [selectedQuarter];
      const budgetSeries = quarters.map((q) =>
        applicable
          .filter((r) => r.quarter === q && (selectedCategory === 'all' || r.category === selectedCategory))
          .reduce((s, r) => s + (Number(r.budget) || 0), 0)
      );
      const actualSeries = quarters.map((q) =>
        applicable
          .filter((r) => r.quarter === q && (selectedCategory === 'all' || r.category === selectedCategory))
          .reduce((s, r) => s + (Number(r.actual) || 0), 0)
      );

      adminBudgetQuarterBarChart.data.labels = quarters;
      adminBudgetQuarterBarChart.data.datasets[0].data = budgetSeries;
      adminBudgetQuarterBarChart.data.datasets[1].data = actualSeries;
      adminBudgetQuarterBarChart.update();

      const barSub = document.getElementById('adminQuarterBarSubtitle');
      if (barSub) {
        const yearTxt = selectedYear === 'all' ? 'All Fiscal Years' : `FY ${selectedYear}`;
        barSub.textContent = `${yearTxt} quarterly allocation and actual spending synced with the Public Home Page`;
      }
    }

    if (adminBudgetCategoryPieChart) {
      const catsForYear = getActiveCategoriesForYear(adminBudgetRecords, selectedYear);
      const activeCats = selectedCategory === 'all' ? catsForYear : [selectedCategory];

      const actualPerCat = activeCats.map((cat) =>
        applicable
          .filter((r) => r.category === cat && (selectedQuarter === 'all' || r.quarter === selectedQuarter))
          .reduce((s, r) => s + (Number(r.actual) || 0), 0)
      );
      const budgetPerCat = activeCats.map((cat) =>
        applicable
          .filter((r) => r.category === cat && (selectedQuarter === 'all' || r.quarter === selectedQuarter))
          .reduce((s, r) => s + (Number(r.budget) || 0), 0)
      );

      const sumActual = actualPerCat.reduce((a, b) => a + b, 0);
      const sumBudget = budgetPerCat.reduce((a, b) => a + b, 0);

      let effectiveMode = adminPieChartMode;
      let fallbackToBudget = false;
      if (effectiveMode === 'actual' && sumActual === 0 && sumBudget > 0) {
        effectiveMode = 'budget';
        fallbackToBudget = true;
      }

      const pieTitle = document.getElementById('adminCategoryPieTitle');
      const pieSub = document.getElementById('adminCategoryPieSubtitle');
      if (pieTitle) {
        pieTitle.textContent =
          effectiveMode === 'budget' ? 'Allocated Budget by Category' : 'Spending by Category';
      }
      if (pieSub) {
        if (sumActual === 0 && sumBudget === 0) {
          pieSub.textContent = 'No active allocations recorded for current selection';
        } else if (fallbackToBudget) {
          pieSub.textContent = 'No disbursements recorded yet — displaying allocated budget shares';
        } else {
          pieSub.textContent =
            effectiveMode === 'budget'
              ? 'Category budget share synced with the Public Home Page'
              : 'Category spending share synced with the Public Home Page';
        }
      }

      if (sumActual === 0 && sumBudget === 0) {
        adminBudgetCategoryPieChart.data.labels = ['No Active Budget Data'];
        adminBudgetCategoryPieChart.data.datasets[0].data = [1];
        adminBudgetCategoryPieChart.data.datasets[0].backgroundColor = ['#e2e8f0'];
      } else {
        const series = effectiveMode === 'budget' ? budgetPerCat : actualPerCat;
        adminBudgetCategoryPieChart.data.labels = activeCats;
        adminBudgetCategoryPieChart.data.datasets[0].data = series;
        adminBudgetCategoryPieChart.data.datasets[0].backgroundColor = activeCats.map(
          (c) => BUDGET_CATEGORY_COLORS[c] || '#64748b'
        );
      }
      adminBudgetCategoryPieChart.update();
    }
  }

  function renderAdminRecentDisbursements(selectedYear = '2026') {
    const tbody = document.getElementById('adminRecentVouchersTbody');
    if (!tbody) return;

    const disbursed = adminBudgetRecords
      .filter(
        (r) =>
          isApplicableBudgetRecord(r) &&
          (selectedYear === 'all' || String(r.year) === String(selectedYear)) &&
          Number(r.actual) > 0
      )
      .slice(0, 6);

    if (disbursed.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:18px;">No disbursed expenditures recorded for the selected fiscal period.</td></tr>';
      return;
    }

    tbody.innerHTML = disbursed
      .map(
        (r) => `
        <tr>
          <td><code>#${escapeHtml(r.id)}</code></td>
          <td>${escapeHtml(r.category)}</td>
          <td>${escapeHtml(r.description)}</td>
          <td><strong>${formatPHP(r.actual)}</strong></td>
        </tr>
      `
      )
      .join('');
  }

  function updateBudgetMetricCards(selectedYear, filteredRecords) {
    const elTotal = document.getElementById('bgtMetricTotal');
    const elSpent = document.getElementById('bgtMetricSpent');
    const elRemaining = document.getElementById('bgtMetricRemaining');
    const elUtil = document.getElementById('bgtMetricUtil');
    const elBadge = document.getElementById('bgtMetricUtilBadge');
    const elRemBadge = document.getElementById('bgtMetricRemainingBadge');
    const elYearBadge = document.getElementById('bgtMetricYearBadge');

    if (!elTotal) return;

    if (elYearBadge) {
      elYearBadge.innerHTML = `<span class="status-dot dot-blue"></span> ${
        selectedYear === 'all' ? 'All Fiscal Years' : 'FY ' + escapeHtml(selectedYear)
      }`;
    }

    // Sum only applicable (non-Inactive) records in the current selection; never fall back to all years when empty
    const applicableList = Array.isArray(filteredRecords)
      ? filteredRecords.filter(isApplicableBudgetRecord)
      : adminBudgetRecords.filter(
          (r) => isApplicableBudgetRecord(r) && (selectedYear === 'all' || String(r.year) === String(selectedYear))
        );

    const metrics = computeBudgetMetrics(applicableList);

    elTotal.textContent = formatPHP(metrics.totalBudget);
    elSpent.textContent = formatPHP(metrics.totalSpending);
    elRemaining.textContent = formatPHP(metrics.remainingBudget);
    elUtil.textContent = metrics.utilizationText;

    if (elRemBadge) {
      if (metrics.remainingBudget < 0) {
        elRemBadge.className = 'metric-badge badge-amber';
        elRemBadge.innerHTML = '<span class="status-dot dot-amber"></span> Over Cap';
      } else {
        elRemBadge.className = 'metric-badge badge-green';
        elRemBadge.innerHTML = '<span class="status-dot dot-green"></span> Available';
      }
    }

    if (elBadge) {
      if (metrics.utilizationRate >= 80) {
        elBadge.className = 'metric-badge badge-green';
        elBadge.style.background = '';
        elBadge.style.color = '';
        elBadge.innerHTML = `<span class="status-dot dot-green"></span> ${metrics.utilizationText} Rate`;
      } else if (metrics.utilizationRate >= 50) {
        elBadge.className = 'metric-badge badge-amber';
        elBadge.style.background = '';
        elBadge.style.color = '';
        elBadge.innerHTML = `<span class="status-dot dot-amber"></span> ${metrics.utilizationText} Rate`;
      } else {
        elBadge.className = 'metric-badge';
        elBadge.style.background = '#f1f5f9';
        elBadge.style.color = '#64748b';
        elBadge.innerHTML = `<span class="status-dot" style="background:#94a3b8;"></span> ${metrics.utilizationText} Rate`;
      }
    }

    // Update Admin Budget Utilization Progress Bar Card (matches KPI cards 100%)
    const adminUtilBadge = document.getElementById('adminUtilBadge');
    const adminUtilSpentBar = document.getElementById('adminUtilSpentBar');
    const adminUtilRemBar = document.getElementById('adminUtilRemainingBar');
    const adminUtilTrack = document.getElementById('adminUtilProgressBar');
    const adminUtilSubtext = document.getElementById('adminUtilSubtextLabel');

    if (adminUtilBadge) adminUtilBadge.textContent = `${metrics.utilizationText} spent`;
    if (adminUtilSpentBar) adminUtilSpentBar.style.width = `${metrics.spentBarPct}%`;
    if (adminUtilRemBar) adminUtilRemBar.style.width = `${metrics.remainingBarPct}%`;
    if (adminUtilTrack) adminUtilTrack.setAttribute('aria-valuenow', String(Math.round(metrics.utilizationRate)));
    if (adminUtilSubtext) {
      adminUtilSubtext.innerHTML = `<strong>${formatPHP(metrics.totalSpending)}</strong> of <strong>${formatPHP(
        metrics.totalBudget
      )}</strong> used · <strong>${formatPHP(metrics.remainingBudget)}</strong> remaining`;
    }

    const quarterVal = document.getElementById('adminBudgetQuarterFilter')?.value || 'all';
    const catVal = document.getElementById('adminBudgetCategoryFilter')?.value || 'all';

    updateSectoralCards(selectedYear);
    updateAdminPublicSyncedCharts(selectedYear, quarterVal, catVal);
    updateBudgetBurnChart(selectedYear);
    renderAdminRecentDisbursements(selectedYear);
  }

  function updateSectoralCards(yearVal) {
    const records = adminBudgetRecords.filter(
      (r) => isApplicableBudgetRecord(r) && (yearVal === 'all' || String(r.year) === String(yearVal))
    );
    const currentCatFilter = document.getElementById('adminBudgetCategoryFilter')?.value || 'all';

    const sectors = [
      { key: 'Infra', cat: 'Infrastructure', spentId: 'secSpentInfra', totalId: 'secTotalInfra', burnId: 'secBurnInfra', fillId: 'secFillInfra', cardId: 'secCardInfra', alwaysShow: true },
      { key: 'Health', cat: 'Health', spentId: 'secSpentHealth', totalId: 'secTotalHealth', burnId: 'secBurnHealth', fillId: 'secFillHealth', cardId: 'secCardHealth', alwaysShow: true },
      { key: 'Social', cat: 'Social Services', spentId: 'secSpentSocial', totalId: 'secTotalSocial', burnId: 'secBurnSocial', fillId: 'secFillSocial', cardId: 'secCardSocial', alwaysShow: true },
      { key: 'Admin', cat: 'Administration', spentId: 'secSpentAdmin', totalId: 'secTotalAdmin', burnId: 'secBurnAdmin', fillId: 'secFillAdmin', cardId: 'secCardAdmin', alwaysShow: true },
      { key: 'Emergency', cat: 'Emergency Preparedness', spentId: 'secSpentEmergency', totalId: 'secTotalEmergency', burnId: 'secBurnEmergency', fillId: 'secFillEmergency', cardId: 'secCardEmergency', alwaysShow: true },
      { key: 'EduSports', cat: 'Education, Sports & Recreation', spentId: 'secSpentEduSports', totalId: 'secTotalEduSports', burnId: 'secBurnEduSports', fillId: 'secFillEduSports', cardId: 'secCardEduSports', alwaysShow: true },
      { key: 'Agri', cat: 'Agriculture & Livelihood', spentId: 'secSpentAgri', totalId: 'secTotalAgri', burnId: 'secBurnAgri', fillId: 'secFillAgri', cardId: 'secCardAgri', alwaysShow: true },
      { key: 'Env', cat: 'Environment & Waste Management', spentId: 'secSpentEnv', totalId: 'secTotalEnv', burnId: 'secBurnEnv', fillId: 'secFillEnv', cardId: 'secCardEnv', alwaysShow: true }
    ];

    sectors.forEach((s) => {
      const sRecords = records.filter((r) => r.category === s.cat);
      const sMetrics = computeBudgetMetrics(sRecords);
      const bgt = sMetrics.totalBudget;
      const spent = sMetrics.totalSpending;
      const pct = sMetrics.utilizationRate;
      const pctFormatted = sMetrics.utilizationText;

      const elSpent = document.getElementById(s.spentId);
      const elTotal = document.getElementById(s.totalId);
      const elBurn = document.getElementById(s.burnId);
      const elFill = document.getElementById(s.fillId);
      const elCard = document.getElementById(s.cardId);

      if (elCard) {
        if (s.alwaysShow) {
          elCard.hidden = false;
        } else {
          const hasAnyForCat = sRecords.length > 0 || currentCatFilter === s.cat;
          elCard.hidden = !hasAnyForCat;
        }
      }

      if (elSpent) elSpent.textContent = formatPHP(spent);
      if (elTotal) elTotal.textContent = `/ ${formatPHP(bgt)} Cap`;
      if (elFill) {
        elFill.style.width = `${sMetrics.spentBarPct}%`;
        elFill.className = 'sec-fill ' + (pct >= 85 ? 'danger' : pct >= 50 ? 'normal' : 'success');
      }
      if (elBurn) {
        if (bgt === 0 && spent === 0) {
          elBurn.textContent = '0% Unallocated';
          elBurn.className = 'sec-burn-tag';
          if (elCard) elCard.classList.remove('surplus-accent', 'warning-accent');
        } else if (pct >= 85) {
          elBurn.textContent = `${pctFormatted} (Cap Risk)`;
          elBurn.className = 'sec-burn-tag danger';
          if (elCard) {
            elCard.classList.remove('surplus-accent');
            elCard.classList.add('warning-accent');
          }
        } else if (pct >= 50) {
          elBurn.textContent = `${pctFormatted} Spent`;
          elBurn.className = 'sec-burn-tag';
          if (elCard) {
            elCard.classList.remove('surplus-accent', 'warning-accent');
          }
        } else {
          elBurn.textContent = `${pctFormatted} (Surplus)`;
          elBurn.className = 'sec-burn-tag success';
          if (elCard) {
            elCard.classList.remove('warning-accent');
            elCard.classList.add('surplus-accent');
          }
        }
      }

      if (elCard) {
        if (currentCatFilter === s.cat) {
          elCard.classList.add('active-sector-filter');
        } else {
          elCard.classList.remove('active-sector-filter');
        }
      }
    });
  }

  function renderAdminBudgetTable() {
    const tbody = document.getElementById('adminBudgetTbody');
    if (!tbody) return;

    syncAdminBudgetYearSelectors();

    const searchInput = document.getElementById('adminBudgetSearchInput');
    const yearFilter = document.getElementById('adminBudgetYearFilter');
    const quarterFilter = document.getElementById('adminBudgetQuarterFilter');
    const categoryFilter = document.getElementById('adminBudgetCategoryFilter');
    const counterText = document.getElementById('adminBudgetCounterText');

    const searchVal = (searchInput?.value || '').toLowerCase().trim();
    const yearVal = yearFilter?.value || '2026';
    const quarterVal = quarterFilter?.value || 'all';
    const catVal = categoryFilter?.value || 'all';

    const filtered = adminBudgetRecords.filter((item) => {
      const matchYear = yearVal === 'all' || String(item.year) === String(yearVal);
      const matchQuarter = quarterVal === 'all' || item.quarter === quarterVal;
      const matchCategory = catVal === 'all' || item.category === catVal;
      const matchSearch =
        !searchVal ||
        (item.id && String(item.id).toLowerCase().includes(searchVal)) ||
        (item.category && item.category.toLowerCase().includes(searchVal)) ||
        (item.description && item.description.toLowerCase().includes(searchVal)) ||
        (item.remarks && item.remarks.toLowerCase().includes(searchVal)) ||
        (item.status && item.status.toLowerCase().includes(searchVal)) ||
        (item.year && String(item.year).includes(searchVal)) ||
        (item.quarter && item.quarter.toLowerCase().includes(searchVal));

      return matchYear && matchQuarter && matchCategory && matchSearch;
    });

    if (counterText) {
      counterText.textContent = `Showing ${filtered.length} of ${adminBudgetRecords.length} budget allocation line items`;
    }

    updateBudgetMetricCards(yearVal, filtered);
    if (typeof initOrUpdateReportsCharts === 'function') {
      const activeDashYear = document.getElementById('dashboardFiscalYearSelect')?.value || '2026';
      initOrUpdateReportsCharts(activeDashYear);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="budget-empty-state-row">
            <div class="budget-empty-state-inner">
              <div class="budget-empty-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <strong style="color: #1e293b; font-size: 14px;">No budget records found</strong>
              <span style="font-size: 12.5px; color: #64748b;">No allocations matched your search or filter selection. Try resetting filters or add a new record.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered
      .map((item) => {
        const budgetNum = Number(item.budget) || 0;
        const actualNum = Number(item.actual) || 0;
        const utilPctRaw = budgetNum > 0 ? (actualNum / budgetNum) * 100 : 0;
        const utilText = formatPercentValue(utilPctRaw);

        let utilClass = 'util-low';
        if (utilPctRaw >= 80) {
          utilClass = 'util-high';
        } else if (utilPctRaw >= 50) {
          utilClass = 'util-mid';
        }

        const statusLabel = item.status || 'Active';
        const statusSlug = statusLabel.toLowerCase();
        const remarksSub = item.remarks
          ? `<span class="admin-budget-remarks-sub">${escapeHtml(item.remarks)}</span>`
          : '';

        return `
          <tr data-record-id="${escapeHtml(item.id)}">
            <td class="col-year">${escapeHtml(item.year)}</td>
            <td><span class="quarter-pill">${escapeHtml(item.quarter)}</span></td>
            <td class="col-category">${escapeHtml(item.category)}</td>
            <td class="col-description">
              <span>${escapeHtml(item.description)}</span>
              ${remarksSub}
            </td>
            <td class="col-currency col-budget-val">${formatPHP(budgetNum)}</td>
            <td class="col-currency col-actual-val">${formatPHP(actualNum)}</td>
            <td class="col-util-val ${utilClass}">${utilText}</td>
            <td style="text-align: center;">
              <span class="budget-status-pill status-${escapeHtml(statusSlug)}">${escapeHtml(statusLabel)}</span>
            </td>
            <td class="col-actions-center">
              <button type="button" class="btn-budget-action action-edit" data-id="${escapeHtml(item.id)}" title="Edit Record" aria-label="Edit Record">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button type="button" class="btn-budget-action action-delete" data-id="${escapeHtml(item.id)}" title="Delete Record" aria-label="Delete Record">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    attachBudgetRowActions();
  }

  function updateRecordModalCalcPreview() {
    const amountVal = parseFloat(document.getElementById('budgetInputAmount')?.value || '0');
    const actualVal = parseFloat(document.getElementById('budgetInputActual')?.value || '0');
    const safeBudget = Number.isFinite(amountVal) && amountVal >= 0 ? amountVal : 0;
    const safeActual = Number.isFinite(actualVal) && actualVal >= 0 ? actualVal : 0;
    const remaining = safeBudget - safeActual;
    const utilRate = safeBudget > 0 ? (safeActual / safeBudget) * 100 : 0;

    const remEl = document.getElementById('budgetModalCalcRemaining');
    const utilEl = document.getElementById('budgetModalCalcUtil');
    if (remEl) remEl.textContent = formatPHP(remaining);
    if (utilEl) utilEl.textContent = formatPercentValue(utilRate);
  }

  function clearRecordModalErrors() {
    ['budgetInputYearError', 'budgetInputDescError', 'budgetInputAmountError', 'budgetInputActualError'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    ['budgetInputYear', 'budgetInputDesc', 'budgetInputAmount', 'budgetInputActual'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('is-invalid', 'input-error');
    });
  }

  function openAddBudgetModal() {
    const modal = document.getElementById('adminBudgetModal');
    const form = document.getElementById('adminBudgetForm');
    const title = document.getElementById('budgetModalTitle');
    const recordIdInput = document.getElementById('budgetRecordId');
    const yearInput = document.getElementById('budgetInputYear');
    const quarterInput = document.getElementById('budgetInputQuarter');
    const catInput = document.getElementById('budgetInputCategory');
    const statusInput = document.getElementById('budgetInputStatus');
    const descInput = document.getElementById('budgetInputDesc');
    const remarksInput = document.getElementById('budgetInputRemarks');
    const amountInput = document.getElementById('budgetInputAmount');
    const actualInput = document.getElementById('budgetInputActual');

    if (!modal) return;
    if (form) form.reset();
    clearRecordModalErrors();

    const activeFilterYear = document.getElementById('adminBudgetYearFilter')?.value;
    const defaultYear = activeFilterYear && activeFilterYear !== 'all' ? activeFilterYear : '2026';

    if (title) title.textContent = 'Add Budget Record';
    if (recordIdInput) recordIdInput.value = '';
    if (yearInput) yearInput.value = defaultYear;
    if (quarterInput) quarterInput.value = 'Q1';
    if (catInput) catInput.value = 'Infrastructure';
    if (statusInput) statusInput.value = 'Active';
    if (amountInput) amountInput.value = '';
    if (actualInput) actualInput.value = '0';
    if (remarksInput) remarksInput.value = '';

    updateRecordModalCalcPreview();
    modal.classList.add('active');
    setTimeout(() => amountInput?.focus(), 80);
  }

  function openEditBudgetModal(recordId) {
    const record = adminBudgetRecords.find((r) => String(r.id) === String(recordId));
    if (!record) return;

    const modal = document.getElementById('adminBudgetModal');
    const title = document.getElementById('budgetModalTitle');
    const recordIdInput = document.getElementById('budgetRecordId');
    const yearInput = document.getElementById('budgetInputYear');
    const quarterInput = document.getElementById('budgetInputQuarter');
    const catInput = document.getElementById('budgetInputCategory');
    const statusInput = document.getElementById('budgetInputStatus');
    const descInput = document.getElementById('budgetInputDesc');
    const remarksInput = document.getElementById('budgetInputRemarks');
    const amountInput = document.getElementById('budgetInputAmount');
    const actualInput = document.getElementById('budgetInputActual');

    if (!modal) return;
    clearRecordModalErrors();

    if (title) title.textContent = 'Edit Budget Record';
    if (recordIdInput) recordIdInput.value = record.id;
    if (yearInput) yearInput.value = record.year || '2026';
    if (quarterInput) quarterInput.value = record.quarter || 'Q1';
    if (catInput) catInput.value = record.category || 'Administration';
    if (statusInput) statusInput.value = record.status || 'Active';
    if (descInput) descInput.value = record.description || '';
    if (remarksInput) remarksInput.value = record.remarks || '';
    if (amountInput) amountInput.value = record.budget ?? 0;
    if (actualInput) actualInput.value = record.actual ?? 0;

    updateRecordModalCalcPreview();
    modal.classList.add('active');
    setTimeout(() => amountInput?.focus(), 80);
  }

  function closeBudgetModal() {
    const modal = document.getElementById('adminBudgetModal');
    if (modal) modal.classList.remove('active');
    const form = document.getElementById('adminBudgetForm');
    if (form) form.reset();
    clearRecordModalErrors();
  }

  async function saveBudgetRecord() {
    const recordId = document.getElementById('budgetRecordId')?.value.trim();
    const yearEl = document.getElementById('budgetInputYear');
    const quarterEl = document.getElementById('budgetInputQuarter');
    const catEl = document.getElementById('budgetInputCategory');
    const statusEl = document.getElementById('budgetInputStatus');
    const descEl = document.getElementById('budgetInputDesc');
    const remarksEl = document.getElementById('budgetInputRemarks');
    const amountEl = document.getElementById('budgetInputAmount');
    const actualEl = document.getElementById('budgetInputActual');

    const year = (yearEl?.value || '').trim();
    const quarter = quarterEl?.value || 'Q1';
    const category = catEl?.value || 'Administration';
    const status = statusEl?.value || 'Active';
    const description = (descEl?.value || '').trim();
    const remarks = (remarksEl?.value || '').trim();
    const budgetRaw = (amountEl?.value ?? '').trim();
    const actualRaw = (actualEl?.value ?? '0').trim();
    const budget = budgetRaw === '' ? NaN : parseFloat(budgetRaw);
    const actual = actualRaw === '' ? 0 : parseFloat(actualRaw);

    const yearErr = document.getElementById('budgetInputYearError');
    const descErr = document.getElementById('budgetInputDescError');
    const amountErr = document.getElementById('budgetInputAmountError');
    const actualErr = document.getElementById('budgetInputActualError');

    clearRecordModalErrors();

    let isValid = true;
    let firstInvalid = null;

    const yearNum = parseInt(year, 10);

    if (!year || isNaN(yearNum) || yearNum < 2020 || yearNum > 2035) {
        if (yearErr) yearErr.textContent = 'Please enter a valid 4-digit fiscal year between 2020 and 2035.';
        if (yearEl) yearEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = yearEl;
    }

    if (!description || description.length < 3) {
        if (descErr) descErr.textContent = 'Description must be at least 3 characters.';
        if (descEl) descEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = descEl;
    }

    if (budgetRaw === '' || isNaN(budget) || budget < 0) {
        if (amountErr) amountErr.textContent = 'Allocated budget must be ₱0 or a positive amount.';
        if (amountEl) amountEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = amountEl;
    }

    if (isNaN(actual) || actual < 0) {
        if (actualErr) actualErr.textContent = 'Actual spending must be ₱0 or a positive amount.';
        if (actualEl) actualEl.classList.add('is-invalid');
        isValid = false;
        if (!firstInvalid) firstInvalid = actualEl;
    }

    if (!isValid) {
        if (firstInvalid) firstInvalid.focus();
        showAdminToast('Validation Error', 'Please correct the highlighted budget fields.', 'danger');
        return;
    }

    const payload = {
        fiscal_year: year,
        quarter,
        budget_category: category,
        allocated_budget: budget,
        actual_spending: actual,
        record_status: status,
        budget_description: description,
        remarks
    };

    try {
        const url = recordId
            ? `http://localhost:5000/api/budget/${encodeURIComponent(recordId)}`
            : 'http://localhost:5000/api/budget';

        const response = await fetch(url, {
            method: recordId ? 'PUT' : 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to save budget record.');
        }

        await loadAdminBudgetRecordsFromDatabase();

        closeBudgetModal();

        showAdminToast(
            recordId ? 'Budget Record Updated' : 'Budget Record Added',
            result.message || 'Budget record successfully saved to the database.',
            'success'
        );

    } catch (error) {
        console.error('Save budget record error:', error);
        showAdminToast(
            'Save Failed',
            error.message || 'Unable to save the budget record to the database.',
            'danger'
        );
    }
}

  async function deleteBudgetRecord(recordId) {
    const record = adminBudgetRecords.find(
        (r) => String(r.id) === String(recordId)
    );

    if (!record) return;

    showAdminConfirm(
        'Delete Budget Record',
        `Are you sure you want to delete "${record.description}" (${record.quarter} ${record.year} · ${formatPHP(record.budget)})?`,
        async function () {
            try {
                const response = await fetch(
                    `http://localhost:5000/api/budget/${encodeURIComponent(recordId)}`,
                    {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json'
                        }
                    }
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'Failed to delete budget record.');
                }

                await loadAdminBudgetRecordsFromDatabase();

                showAdminToast(
                    'Budget Record Removed',
                    result.message || 'Budget record deleted successfully.',
                    'success'
                );

            } catch (error) {
                console.error('Delete budget record error:', error);

                showAdminToast(
                    'Delete Failed',
                    error.message || 'Unable to delete the budget record from the database.',
                    'danger'
                );
            }
        }
    );
}

  // ==============================================================
  // COMPREHENSIVE SUMMARY, CATEGORY & QUARTERLY GRAPH EDITOR MODAL
  // ==============================================================
  let summaryDraftYear = '2026';
  let summaryWorkingRecords = [];
  let summaryFocusedCategory = null;

  function loadDraftRecordsForYear(year) {
    summaryDraftYear = String(year || '2026');
    summaryWorkingRecords = adminBudgetRecords
      .filter((r) => String(r.year) === summaryDraftYear)
      .map((r, i) => ({ ...normalizeBudgetRecord(r, i) }));

    const batchStatusEl = document.getElementById('sumInputBatchStatus');
    const remarksEl = document.getElementById('sumInputRemarks');
    if (batchStatusEl) batchStatusEl.value = '';
    if (remarksEl) remarksEl.value = '';
  }

  function ensureDraftRecordsExist(filterFn, defaults = {}) {
    let matches = summaryWorkingRecords.filter((r) => isApplicableBudgetRecord(r) && filterFn(r));
    if (matches.length === 0) {
      const fallbackId = generateNextBudgetId(
        [...adminBudgetRecords, ...summaryWorkingRecords],
        summaryDraftYear
      );
      const created = normalizeBudgetRecord({
        id: fallbackId,
        year: summaryDraftYear,
        quarter: defaults.quarter || 'Q1',
        category: defaults.category || 'Infrastructure',
        description:
          defaults.description ||
          `${defaults.quarter || 'Q1'} ${defaults.category || 'General'} Budget Allocation`,
        remarks: defaults.remarks || '',
        budget: 0,
        actual: 0,
        status: 'Active',
        updatedAt: Date.now()
      });
      summaryWorkingRecords.push(created);
      matches = [created];
    }
    return matches;
  }

  function getApplicableDraftRecords() {
    return summaryWorkingRecords.filter(isApplicableBudgetRecord);
  }

  function refreshSummaryOverviewFields(skipActiveElement = true) {
    const metrics = computeBudgetMetrics(getApplicableDraftRecords());
    const activeEl = skipActiveElement ? document.activeElement : null;

    const totalEl = document.getElementById('sumInputTotalBudget');
    const spentEl = document.getElementById('sumInputTotalSpending');
    const remEl = document.getElementById('sumInputRemainingBudget');
    const utilEl = document.getElementById('sumInputUtilRate');

    if (totalEl && activeEl !== totalEl) totalEl.value = metrics.totalBudget;
    if (spentEl && activeEl !== spentEl) spentEl.value = metrics.totalSpending;
    if (remEl && activeEl !== remEl) remEl.value = metrics.remainingBudget;
    if (utilEl && activeEl !== utilEl) utilEl.value = metrics.utilizationRate;

    const badge = document.getElementById('sumPreviewBadge');
    const spentBar = document.getElementById('sumPreviewSpentBar');
    const remBar = document.getElementById('sumPreviewRemBar');
    const text = document.getElementById('sumPreviewText');

    if (badge) badge.textContent = `${metrics.utilizationText} spent`;
    if (spentBar) spentBar.style.width = `${metrics.spentBarPct}%`;
    if (remBar) remBar.style.width = `${metrics.remainingBarPct}%`;
    if (text) {
      text.innerHTML = `<strong>${formatPHP(metrics.totalSpending)}</strong> of <strong>${formatPHP(
        metrics.totalBudget
      )}</strong> used · <strong>${formatPHP(metrics.remainingBudget)}</strong> remaining`;
    }
  }

  function renderSummaryCategoriesPane() {
    const tbody = document.getElementById('sumCategoriesEditTbody');
    const tfoot = document.getElementById('sumCategoriesEditTfoot');
    if (!tbody || !tfoot) return;

    const categories = [...BUDGET_CATEGORIES];
    summaryWorkingRecords.forEach((r) => {
      if (r.category && !categories.includes(r.category)) {
        categories.push(r.category);
      }
    });

    tbody.innerHTML = categories
      .map((cat) => {
        const allCatRecs = summaryWorkingRecords.filter((r) => r.category === cat);
        const appCatRecs = allCatRecs.filter(isApplicableBudgetRecord);
        const m = computeBudgetMetrics(appCatRecs);
        const color = BUDGET_CATEGORY_COLORS[cat] || '#64748b';
        const isFocused = summaryFocusedCategory === cat ? 'bulk-row-focused' : '';

        const uniqueStatuses = Array.from(new Set(allCatRecs.map((r) => r.status || 'Active')));
        const currentStatus = uniqueStatuses.length === 1 ? uniqueStatuses[0] : '';
        const sharedRemark =
          allCatRecs.length > 0 && allCatRecs.every((r) => (r.remarks || '') === (allCatRecs[0].remarks || ''))
            ? allCatRecs[0].remarks || ''
            : '';

        return `
          <tr class="${isFocused}" data-bulk-cat="${escapeHtml(cat)}">
            <td>
              <span class="bulk-cat-label">
                <span class="bulk-cat-dot" style="background-color: ${color};"></span>
                ${escapeHtml(cat)}
              </span>
            </td>
            <td>
              <input type="number" class="bulk-edit-input js-cat-budget-input" data-cat="${escapeHtml(cat)}" min="0" step="any" value="${m.totalBudget}">
            </td>
            <td>
              <input type="number" class="bulk-edit-input js-cat-actual-input" data-cat="${escapeHtml(cat)}" min="0" step="any" value="${m.totalSpending}">
            </td>
            <td style="text-align: right; font-weight: 600;" class="js-cat-rem-cell">${formatPHP(m.remainingBudget)}</td>
            <td style="text-align: right; font-weight: 700;" class="js-cat-util-cell">${m.utilizationText}</td>
            <td>
              <select class="bulk-edit-input js-cat-status-select" data-cat="${escapeHtml(cat)}">
                <option value="" ${currentStatus === '' ? 'selected' : ''}>Keep (${allCatRecs.length || 0})</option>
                <option value="Active" ${currentStatus === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Ongoing" ${currentStatus === 'Ongoing' ? 'selected' : ''}>Ongoing</option>
                <option value="Completed" ${currentStatus === 'Completed' ? 'selected' : ''}>Completed</option>
                <option value="Planned" ${currentStatus === 'Planned' ? 'selected' : ''}>Planned</option>
                <option value="Inactive" ${currentStatus === 'Inactive' ? 'selected' : ''}>Inactive</option>
              </select>
            </td>
            <td>
              <input type="text" class="bulk-edit-input js-cat-remarks-input" data-cat="${escapeHtml(cat)}" placeholder="Sector note / remarks" value="${escapeHtml(sharedRemark)}">
            </td>
          </tr>
        `;
      })
      .join('');

    updateSummaryCategoriesFooter();

    tbody.querySelectorAll('.js-cat-budget-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const cat = inp.getAttribute('data-cat');
        const val = Math.max(0, parseFloat(inp.value || '0') || 0);
        const recs = ensureDraftRecordsExist((r) => r.category === cat, {
          category: cat,
          quarter: 'Q1',
          description: `${cat} Annual Allocation`
        });
        distributeTargetAmountAcrossRecords(recs, 'budget', val);
        const row = inp.closest('tr');
        const m = computeBudgetMetrics(summaryWorkingRecords.filter((r) => isApplicableBudgetRecord(r) && r.category === cat));
        if (row) {
          const remCell = row.querySelector('.js-cat-rem-cell');
          const utilCell = row.querySelector('.js-cat-util-cell');
          if (remCell) remCell.textContent = formatPHP(m.remainingBudget);
          if (utilCell) utilCell.textContent = m.utilizationText;
        }
        updateSummaryCategoriesFooter();
        refreshSummaryOverviewFields(false);
      });
    });

    tbody.querySelectorAll('.js-cat-actual-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const cat = inp.getAttribute('data-cat');
        const val = Math.max(0, parseFloat(inp.value || '0') || 0);
        const recs = ensureDraftRecordsExist((r) => r.category === cat, {
          category: cat,
          quarter: 'Q1',
          description: `${cat} Annual Expenditure`
        });
        distributeTargetAmountAcrossRecords(recs, 'actual', val);
        const row = inp.closest('tr');
        const m = computeBudgetMetrics(summaryWorkingRecords.filter((r) => isApplicableBudgetRecord(r) && r.category === cat));
        if (row) {
          const remCell = row.querySelector('.js-cat-rem-cell');
          const utilCell = row.querySelector('.js-cat-util-cell');
          if (remCell) remCell.textContent = formatPHP(m.remainingBudget);
          if (utilCell) utilCell.textContent = m.utilizationText;
        }
        updateSummaryCategoriesFooter();
        refreshSummaryOverviewFields(false);
      });
    });

    tbody.querySelectorAll('.js-cat-status-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const cat = sel.getAttribute('data-cat');
        const newStatus = sel.value;
        if (!newStatus) return;
        let catRecs = summaryWorkingRecords.filter((r) => r.category === cat);
        if (catRecs.length === 0 && newStatus !== 'Inactive') {
          catRecs = ensureDraftRecordsExist((r) => r.category === cat, { category: cat, quarter: 'Q1' });
        }
        catRecs.forEach((r) => {
          r.status = newStatus;
        });
        renderSummaryCategoriesPane();
        refreshSummaryOverviewFields(false);
      });
    });

    tbody.querySelectorAll('.js-cat-remarks-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const cat = inp.getAttribute('data-cat');
        const note = inp.value.trim();
        summaryWorkingRecords
          .filter((r) => r.category === cat)
          .forEach((r) => {
            r.remarks = note;
          });
      });
    });
  }

  function updateSummaryCategoriesFooter() {
    const tfoot = document.getElementById('sumCategoriesEditTfoot');
    if (!tfoot) return;
    const m = computeBudgetMetrics(getApplicableDraftRecords());
    tfoot.innerHTML = `
      <tr>
        <td>Total Active FY ${escapeHtml(summaryDraftYear)}</td>
        <td>${formatPHP(m.totalBudget)}</td>
        <td>${formatPHP(m.totalSpending)}</td>
        <td style="text-align: right;">${formatPHP(m.remainingBudget)}</td>
        <td style="text-align: right;">${m.utilizationText}</td>
        <td colspan="2">Synced with Pie Chart &amp; Summary Cards</td>
      </tr>
    `;
  }

  function renderSummaryQuartersPane() {
    const tbody = document.getElementById('sumQuartersEditTbody');
    const tfoot = document.getElementById('sumQuartersEditTfoot');
    if (!tbody || !tfoot) return;

    const quarterTitles = {
      Q1: 'Q1 (Jan – Mar)',
      Q2: 'Q2 (Apr – Jun)',
      Q3: 'Q3 (Jul – Sep)',
      Q4: 'Q4 (Oct – Dec)'
    };

    tbody.innerHTML = BUDGET_QUARTERS.map((q) => {
      const allQRecs = summaryWorkingRecords.filter((r) => r.quarter === q);
      const appQRecs = allQRecs.filter(isApplicableBudgetRecord);
      const m = computeBudgetMetrics(appQRecs);

      const uniqueStatuses = Array.from(new Set(allQRecs.map((r) => r.status || 'Active')));
      const currentStatus = uniqueStatuses.length === 1 ? uniqueStatuses[0] : '';
      const sharedRemark =
        allQRecs.length > 0 && allQRecs.every((r) => (r.remarks || '') === (allQRecs[0].remarks || ''))
          ? allQRecs[0].remarks || ''
          : '';

      return `
        <tr data-bulk-quarter="${escapeHtml(q)}">
          <td><strong>${escapeHtml(quarterTitles[q] || q)}</strong></td>
          <td>
            <input type="number" class="bulk-edit-input js-q-budget-input" data-quarter="${escapeHtml(q)}" min="0" step="any" value="${m.totalBudget}">
          </td>
          <td>
            <input type="number" class="bulk-edit-input js-q-actual-input" data-quarter="${escapeHtml(q)}" min="0" step="any" value="${m.totalSpending}">
          </td>
          <td style="text-align: right; font-weight: 600;" class="js-q-rem-cell">${formatPHP(m.remainingBudget)}</td>
          <td style="text-align: right; font-weight: 700;" class="js-q-util-cell">${m.utilizationText}</td>
          <td>
            <select class="bulk-edit-input js-q-status-select" data-quarter="${escapeHtml(q)}">
              <option value="" ${currentStatus === '' ? 'selected' : ''}>Keep (${allQRecs.length || 0})</option>
              <option value="Active" ${currentStatus === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Ongoing" ${currentStatus === 'Ongoing' ? 'selected' : ''}>Ongoing</option>
              <option value="Completed" ${currentStatus === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="Planned" ${currentStatus === 'Planned' ? 'selected' : ''}>Planned</option>
              <option value="Inactive" ${currentStatus === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </td>
          <td>
            <input type="text" class="bulk-edit-input js-q-remarks-input" data-quarter="${escapeHtml(q)}" placeholder="Quarter note / remarks" value="${escapeHtml(sharedRemark)}">
          </td>
        </tr>
      `;
    }).join('');

    updateSummaryQuartersFooter();

    tbody.querySelectorAll('.js-q-budget-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const q = inp.getAttribute('data-quarter');
        const val = Math.max(0, parseFloat(inp.value || '0') || 0);
        const recs = ensureDraftRecordsExist((r) => r.quarter === q, {
          quarter: q,
          category: 'Infrastructure',
          description: `${q} Consolidated Budget Allocation`
        });
        distributeTargetAmountAcrossRecords(recs, 'budget', val);
        const row = inp.closest('tr');
        const m = computeBudgetMetrics(summaryWorkingRecords.filter((r) => isApplicableBudgetRecord(r) && r.quarter === q));
        if (row) {
          const remCell = row.querySelector('.js-q-rem-cell');
          const utilCell = row.querySelector('.js-q-util-cell');
          if (remCell) remCell.textContent = formatPHP(m.remainingBudget);
          if (utilCell) utilCell.textContent = m.utilizationText;
        }
        updateSummaryQuartersFooter();
        refreshSummaryOverviewFields(false);
      });
    });

    tbody.querySelectorAll('.js-q-actual-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const q = inp.getAttribute('data-quarter');
        const val = Math.max(0, parseFloat(inp.value || '0') || 0);
        const recs = ensureDraftRecordsExist((r) => r.quarter === q, {
          quarter: q,
          category: 'Infrastructure',
          description: `${q} Consolidated Expenditure`
        });
        distributeTargetAmountAcrossRecords(recs, 'actual', val);
        const row = inp.closest('tr');
        const m = computeBudgetMetrics(summaryWorkingRecords.filter((r) => isApplicableBudgetRecord(r) && r.quarter === q));
        if (row) {
          const remCell = row.querySelector('.js-q-rem-cell');
          const utilCell = row.querySelector('.js-q-util-cell');
          if (remCell) remCell.textContent = formatPHP(m.remainingBudget);
          if (utilCell) utilCell.textContent = m.utilizationText;
        }
        updateSummaryQuartersFooter();
        refreshSummaryOverviewFields(false);
      });
    });

    tbody.querySelectorAll('.js-q-status-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const q = sel.getAttribute('data-quarter');
        const newStatus = sel.value;
        if (!newStatus) return;
        let qRecs = summaryWorkingRecords.filter((r) => r.quarter === q);
        if (qRecs.length === 0 && newStatus !== 'Inactive') {
          qRecs = ensureDraftRecordsExist((r) => r.quarter === q, { quarter: q, category: 'Infrastructure' });
        }
        qRecs.forEach((r) => {
          r.status = newStatus;
        });
        renderSummaryQuartersPane();
        refreshSummaryOverviewFields(false);
      });
    });

    tbody.querySelectorAll('.js-q-remarks-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const q = inp.getAttribute('data-quarter');
        const note = inp.value.trim();
        summaryWorkingRecords
          .filter((r) => r.quarter === q)
          .forEach((r) => {
            r.remarks = note;
          });
      });
    });
  }

  function updateSummaryQuartersFooter() {
    const tfoot = document.getElementById('sumQuartersEditTfoot');
    if (!tfoot) return;
    const m = computeBudgetMetrics(getApplicableDraftRecords());
    tfoot.innerHTML = `
      <tr>
        <td>Annual Total (FY ${escapeHtml(summaryDraftYear)})</td>
        <td>${formatPHP(m.totalBudget)}</td>
        <td>${formatPHP(m.totalSpending)}</td>
        <td style="text-align: right;">${formatPHP(m.remainingBudget)}</td>
        <td style="text-align: right;">${m.utilizationText}</td>
        <td colspan="2">Synced with Bar Graph &amp; Summary Cards</td>
      </tr>
    `;
  }

  function switchSummaryModalTab(tabKey) {
    const panes = {
      overview: document.getElementById('sumTabPaneOverview'),
      categories: document.getElementById('sumTabPaneCategories'),
      quarters: document.getElementById('sumTabPaneQuarters')
    };

    document.querySelectorAll('.sum-tab-btn').forEach((btn) => {
      const isMatch = btn.getAttribute('data-sum-tab') === tabKey;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    Object.entries(panes).forEach(([k, el]) => {
      if (el) el.classList.toggle('active', k === tabKey);
    });

    if (tabKey === 'overview') {
      refreshSummaryOverviewFields(false);
    } else if (tabKey === 'categories') {
      renderSummaryCategoriesPane();
    } else if (tabKey === 'quarters') {
      renderSummaryQuartersPane();
    }
  }

  function openBudgetSummaryModal(mode = 'overview', focusCategory = null) {
    const modal = document.getElementById('adminBudgetSummaryModal');
    if (!modal) return;

    syncAdminBudgetYearSelectors();
    const filterYear = document.getElementById('adminBudgetYearFilter')?.value;
    const initialYear = filterYear && filterYear !== 'all' ? filterYear : '2026';

    const sumYearSelect = document.getElementById('sumEditYear');
    if (sumYearSelect) sumYearSelect.value = initialYear;

    summaryFocusedCategory = focusCategory;
    loadDraftRecordsForYear(initialYear);
    refreshSummaryOverviewFields(false);
    renderSummaryCategoriesPane();
    renderSummaryQuartersPane();

    let targetTab = 'overview';
    if (mode === 'categories' || focusCategory) targetTab = 'categories';
    else if (mode === 'quarters') targetTab = 'quarters';

    switchSummaryModalTab(targetTab);
    modal.classList.add('active');

    setTimeout(() => {
      if (focusCategory) {
        const catInput = Array.from(document.querySelectorAll('.js-cat-budget-input')).find(
          (el) => el.getAttribute('data-cat') === focusCategory
        );
        catInput?.focus();
        catInput?.select?.();
      } else if (mode === 'summary-total') {
        const el = document.getElementById('sumInputTotalBudget');
        el?.focus();
        el?.select?.();
      } else if (mode === 'summary-spent') {
        const el = document.getElementById('sumInputTotalSpending');
        el?.focus();
        el?.select?.();
      } else if (mode === 'summary-remaining') {
        const el = document.getElementById('sumInputRemainingBudget');
        el?.focus();
        el?.select?.();
      } else if (mode === 'summary-util' || mode === 'summary-utilization') {
        const el = document.getElementById('sumInputUtilRate');
        el?.focus();
        el?.select?.();
      }
    }, 90);
  }

  function closeBudgetSummaryModal() {
    const modal = document.getElementById('adminBudgetSummaryModal');
    if (modal) modal.classList.remove('active');
    summaryFocusedCategory = null;
  }

  async function saveBudgetSummaryModalChanges() {
    const batchStatus = document.getElementById('sumInputBatchStatus')?.value || '';
    const batchRemarks = (document.getElementById('sumInputRemarks')?.value || '').trim();

    if (batchStatus) {
        if (summaryWorkingRecords.length === 0 && batchStatus !== 'Inactive') {
            ensureDraftRecordsExist(() => true, {
                quarter: 'Q1',
                category: 'Infrastructure'
            });
        }

        summaryWorkingRecords.forEach((r) => {
            r.status = batchStatus;
        });
    }

    if (batchRemarks) {
        summaryWorkingRecords.forEach((r) => {
            r.remarks = batchRemarks;
        });
    }

    try {
        const existingYearRecords = adminBudgetRecords.filter(
            (r) => String(r.year) === String(summaryDraftYear)
        );

        const existingIds = new Set(
            existingYearRecords.map((r) => String(r.id))
        );

        for (const record of summaryWorkingRecords) {
            const payload = {
                fiscal_year: String(summaryDraftYear),
                quarter: record.quarter,
                budget_category: record.category,
                allocated_budget: Number(record.budget) || 0,
                actual_spending: Number(record.actual) || 0,
                record_status: record.status || 'Planned',
                budget_description: record.description || 'Budget Allocation',
                remarks: record.remarks || ''
            };

            const isExistingRecord = existingIds.has(String(record.id));

            const response = await fetch(
                isExistingRecord
                    ? `http://localhost:5000/api/budget/${encodeURIComponent(record.id)}`
                    : 'http://localhost:5000/api/budget',
                {
                    method: isExistingRecord ? 'PUT' : 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to save budget summary.');
            }
        }

        await loadAdminBudgetRecordsFromDatabase();

        closeBudgetSummaryModal();

        showAdminToast(
            'Budget Synchronized',
            `FY ${summaryDraftYear} budget summary successfully saved to the database.`,
            'success'
        );

    } catch (error) {
        console.error('Save budget summary error:', error);

        showAdminToast(
            'Save Failed',
            error.message || 'Unable to save the budget summary to the database.',
            'danger'
        );
    }
}

  function exportBudgetCSV() {
    const searchInput = document.getElementById('adminBudgetSearchInput');
    const yearFilter = document.getElementById('adminBudgetYearFilter');
    const quarterFilter = document.getElementById('adminBudgetQuarterFilter');
    const categoryFilter = document.getElementById('adminBudgetCategoryFilter');

    const searchVal = (searchInput?.value || '').toLowerCase().trim();
    const yearVal = yearFilter?.value || '2026';
    const quarterVal = quarterFilter?.value || 'all';
    const catVal = categoryFilter?.value || 'all';

    const records = adminBudgetRecords.filter((item) => {
      const matchYear = yearVal === 'all' || String(item.year) === String(yearVal);
      const matchQuarter = quarterVal === 'all' || item.quarter === quarterVal;
      const matchCategory = catVal === 'all' || item.category === catVal;
      const matchSearch =
        !searchVal ||
        (item.category && item.category.toLowerCase().includes(searchVal)) ||
        (item.description && item.description.toLowerCase().includes(searchVal)) ||
        (item.remarks && item.remarks.toLowerCase().includes(searchVal));
      return matchYear && matchQuarter && matchCategory && matchSearch;
    });

    if (records.length === 0) {
      showAdminToast('No Records', 'No budget records available to export for the selected filter.', 'warning');
      return;
    }

    const headers = [
      'Record ID',
      'Fiscal Year',
      'Quarter',
      'Sectoral Category',
      'Description / Purpose',
      'Remarks',
      'Status',
      'Allocated Budget (PHP)',
      'Actual Spending (PHP)',
      'Remaining Budget (PHP)',
      'Utilization Rate (%)'
    ];
    const rows = records.map((r) => {
      const b = Number(r.budget) || 0;
      const a = Number(r.actual) || 0;
      const rem = b - a;
      const u = b > 0 ? formatPercentValue((a / b) * 100) : '0%';
      return [
        r.id,
        r.year,
        r.quarter,
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        `"${(r.remarks || '').replace(/"/g, '""')}"`,
        `"${(r.status || 'Active').replace(/"/g, '""')}"`,
        b,
        a,
        rem,
        u
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Barangay_Budget_Allocation_${yearVal}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showAdminToast('Export Completed', `Exported ${records.length} budget allocation records to CSV.`, 'success');
  }

  function attachBudgetRowActions() {
    document.querySelectorAll('.btn-budget-action.action-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) openEditBudgetModal(id);
      });
    });

    document.querySelectorAll('.btn-budget-action.action-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) deleteBudgetRecord(id);
      });
    });
  }

  function initAdminBudgetModule() {
    initAdminPublicSyncedCharts();
    syncAdminBudgetYearSelectors();

    const searchInput = document.getElementById('adminBudgetSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => renderAdminBudgetTable());
    }

    const yearFilter = document.getElementById('adminBudgetYearFilter');
    if (yearFilter) {
      yearFilter.addEventListener('change', () => renderAdminBudgetTable());
    }

    const quarterFilter = document.getElementById('adminBudgetQuarterFilter');
    if (quarterFilter) {
      quarterFilter.addEventListener('change', () => renderAdminBudgetTable());
    }

    const categoryFilter = document.getElementById('adminBudgetCategoryFilter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => renderAdminBudgetTable());
    }

    const resetBtn = document.getElementById('adminBudgetResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (yearFilter) yearFilter.value = '2026';
        if (quarterFilter) quarterFilter.value = 'all';
        if (categoryFilter) categoryFilter.value = 'all';
        renderAdminBudgetTable();
        showAdminToast('Filters Reset', 'Showing all Fiscal Year 2026 budget allocations.', 'info');
      });
    }

    // Admin Pie Chart Mode Toggle (Actual vs Allocated)
    const adminPieToggle = document.getElementById('adminPieChartModeToggle');
    if (adminPieToggle) {
      adminPieToggle.querySelectorAll('.admin-pie-mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          adminPieChartMode = btn.getAttribute('data-admin-pie-mode') || 'actual';
          adminPieToggle.querySelectorAll('.admin-pie-mode-btn').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
          const yr = document.getElementById('adminBudgetYearFilter')?.value || '2026';
          const q = document.getElementById('adminBudgetQuarterFilter')?.value || 'all';
          const c = document.getElementById('adminBudgetCategoryFilter')?.value || 'all';
          updateAdminPublicSyncedCharts(yr, q, c);
        });
      });
    }

    const btnOpenAdd = document.getElementById('btnOpenAddBudgetModal');
    if (btnOpenAdd) {
      btnOpenAdd.addEventListener('click', openAddBudgetModal);
    }

    const btnExport = document.getElementById('btnExportBudgetReport');
    if (btnExport) {
      btnExport.addEventListener('click', exportBudgetCSV);
    }

    const btnCloseModal = document.getElementById('btnCloseBudgetModal');
    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', closeBudgetModal);
    }

    const btnCancelModal = document.getElementById('btnCancelBudgetModal');
    if (btnCancelModal) {
      btnCancelModal.addEventListener('click', closeBudgetModal);
    }

    const modal = document.getElementById('adminBudgetModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeBudgetModal();
      });
    }

    const btnSave = document.getElementById('btnSaveBudgetRecord');
    if (btnSave) {
      btnSave.addEventListener('click', (e) => {
        e.preventDefault();
        saveBudgetRecord();
      });
    }

    const form = document.getElementById('adminBudgetForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveBudgetRecord();
      });
    }

    // Real-time validation clearing & live Remaining / Utilization calculation inside Record Modal
    const bgtAmtInput = document.getElementById('budgetInputAmount');
    const bgtActInput = document.getElementById('budgetInputActual');
    const bgtYearInput = document.getElementById('budgetInputYear');
    const bgtDescInput = document.getElementById('budgetInputDesc');

    if (bgtAmtInput) {
      bgtAmtInput.addEventListener('input', function () {
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('budgetInputAmountError');
        if (err) err.textContent = '';
        updateRecordModalCalcPreview();
      });
    }

    if (bgtActInput) {
      bgtActInput.addEventListener('input', function () {
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('budgetInputActualError');
        if (err) err.textContent = '';
        updateRecordModalCalcPreview();
      });
    }

    if (bgtYearInput) {
      bgtYearInput.addEventListener('input', function () {
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('budgetInputYearError');
        if (err) err.textContent = '';
      });
    }

    if (bgtDescInput) {
      bgtDescInput.addEventListener('input', function () {
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('budgetInputDescError');
        if (err) err.textContent = '';
      });
    }

    // Wire all Summary / Utilization / Bar Graph / Pie Chart Edit Buttons
    document.querySelectorAll('[data-budget-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.getAttribute('data-budget-edit') || 'overview';
        openBudgetSummaryModal(mode, null);
      });
    });

    // Wire Category Card inline Edit Buttons (without triggering card filter)
    document.querySelectorAll('[data-sector-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = btn.getAttribute('data-sector-edit');
        openBudgetSummaryModal('categories', cat);
      });
    });

    // Summary Modal Tabs, Year Selector, Live Bi-directional Formulas, Save & Cancel
    document.querySelectorAll('.sum-tab-btn').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const tabKey = tabBtn.getAttribute('data-sum-tab') || 'overview';
        switchSummaryModalTab(tabKey);
      });
    });

    const sumEditYear = document.getElementById('sumEditYear');
    if (sumEditYear) {
      sumEditYear.addEventListener('change', () => {
        loadDraftRecordsForYear(sumEditYear.value);
        refreshSummaryOverviewFields(false);
        renderSummaryCategoriesPane();
        renderSummaryQuartersPane();
      });
    }

    const sumTotalInput = document.getElementById('sumInputTotalBudget');
    const sumSpentInput = document.getElementById('sumInputTotalSpending');
    const sumRemInput = document.getElementById('sumInputRemainingBudget');
    const sumUtilInput = document.getElementById('sumInputUtilRate');

    if (sumTotalInput) {
      sumTotalInput.addEventListener('input', () => {
        const newTotal = Math.max(0, parseFloat(sumTotalInput.value || '0') || 0);
        const recs = ensureDraftRecordsExist(() => true, {
          quarter: 'Q1',
          category: 'Infrastructure',
          description: `FY ${summaryDraftYear} Annual Budget Allocation`
        });
        distributeTargetAmountAcrossRecords(recs, 'budget', newTotal);
        refreshSummaryOverviewFields(true);
      });
    }

    if (sumSpentInput) {
      sumSpentInput.addEventListener('input', () => {
        const newSpent = Math.max(0, parseFloat(sumSpentInput.value || '0') || 0);
        const recs = ensureDraftRecordsExist(() => true, {
          quarter: 'Q1',
          category: 'Infrastructure',
          description: `FY ${summaryDraftYear} Annual Expenditure`
        });
        distributeTargetAmountAcrossRecords(recs, 'actual', newSpent);
        refreshSummaryOverviewFields(true);
      });
    }

    if (sumRemInput) {
      sumRemInput.addEventListener('input', () => {
        const desiredRemaining = parseFloat(sumRemInput.value || '0') || 0;
        const recs = ensureDraftRecordsExist(() => true, {
          quarter: 'Q1',
          category: 'Infrastructure',
          description: `FY ${summaryDraftYear} Budget Allocation`
        });
        const currentMetrics = computeBudgetMetrics(recs);
        if (desiredRemaining > currentMetrics.totalBudget) {
          distributeTargetAmountAcrossRecords(recs, 'budget', Math.max(0, desiredRemaining));
          distributeTargetAmountAcrossRecords(recs, 'actual', 0);
        } else {
          const newSpent = Math.max(0, currentMetrics.totalBudget - desiredRemaining);
          distributeTargetAmountAcrossRecords(recs, 'actual', newSpent);
        }
        refreshSummaryOverviewFields(true);
      });
    }

    if (sumUtilInput) {
      sumUtilInput.addEventListener('input', () => {
        const desiredRate = Math.max(0, parseFloat(sumUtilInput.value || '0') || 0);
        const recs = ensureDraftRecordsExist(() => true, {
          quarter: 'Q1',
          category: 'Infrastructure',
          description: `FY ${summaryDraftYear} Budget Allocation`
        });
        const currentMetrics = computeBudgetMetrics(recs);
        const newSpent =
          currentMetrics.totalBudget > 0
            ? Math.round((currentMetrics.totalBudget * desiredRate) / 100)
            : 0;
        distributeTargetAmountAcrossRecords(recs, 'actual', newSpent);
        refreshSummaryOverviewFields(true);
      });
    }

    const summaryModal = document.getElementById('adminBudgetSummaryModal');
    if (summaryModal) {
      summaryModal.addEventListener('click', (e) => {
        if (e.target === summaryModal) closeBudgetSummaryModal();
      });
    }

    document.getElementById('btnCloseBudgetSummaryModal')?.addEventListener('click', closeBudgetSummaryModal);
    document.getElementById('btnCancelBudgetSummaryModal')?.addEventListener('click', closeBudgetSummaryModal);
    document.getElementById('btnSaveBudgetSummaryModal')?.addEventListener('click', (e) => {
      e.preventDefault();
      saveBudgetSummaryModalChanges();
    });

    // Sector cards quick click-to-filter
    const sectorCards = [
      { id: 'secCardInfra', cat: 'Infrastructure' },
      { id: 'secCardHealth', cat: 'Health' },
      { id: 'secCardSocial', cat: 'Social Services' },
      { id: 'secCardAdmin', cat: 'Administration' },
      { id: 'secCardEmergency', cat: 'Emergency Preparedness' },
      { id: 'secCardEduSports', cat: 'Education, Sports & Recreation' },
      { id: 'secCardAgri', cat: 'Agriculture & Livelihood' },
      { id: 'secCardEnv', cat: 'Environment & Waste Management' }
    ];

    sectorCards.forEach((s) => {
      const cardEl = document.getElementById(s.id);
      if (cardEl) {
        cardEl.addEventListener('click', (e) => {
          if (e.target.closest('[data-sector-edit]')) return;
          const catSelect = document.getElementById('adminBudgetCategoryFilter');
          if (!catSelect) return;

          if (catSelect.value === s.cat) {
            catSelect.value = 'all';
            showAdminToast('Filter Reset', 'Showing all sectoral categories in quarterly budget list.', 'info');
          } else {
            catSelect.value = s.cat;
            showAdminToast('Sector Filter', `Filtered quarterly budget ledger for ${s.cat}.`, 'info');
          }
          renderAdminBudgetTable();

          const tableCard = document.getElementById('adminQuarterlyBudgetListCard');
          if (tableCard) {
            tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
    });

    // Retrieve and manage records through the Brgy360 backend API,
    // which uses Supabase PostgreSQL as its database.
    subscribeBudgetRecords(() => {
      loadAdminBudgetRecordsFromDatabase();
    });

    // Retrieve and manage records through the Brgy360 backend API,
    // which uses Supabase PostgreSQL as its database.
    loadAdminBudgetRecordsFromDatabase();
  }

  // ==============================================================
  // 11.B RESIDENT VERIFICATION & PRE-REGISTRATION WORKFLOW MODULE
  // ==============================================================

  function getInitials(name) {
    if (!name) return 'R';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function formatDobAndAge(dobStr, fallbackAge) {
    if (!dobStr) return `${fallbackAge || 30} yrs old`;
    try {
      const d = new Date(dobStr);
      if (isNaN(d.getTime())) return `${fallbackAge || 30} yrs old`;
      const options = { month: 'long', day: 'numeric', year: 'numeric' };
      const formatted = d.toLocaleDateString('en-US', options);
      const diffMs = Date.now() - d.getTime();
      const ageDate = new Date(diffMs);
      const computedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
      return `${formatted} (${computedAge} yrs old)`;
    } catch (e) {
      return `${fallbackAge || 30} yrs old`;
    }
  }

  function renderResidentVerificationTable() {
    const tableBody = document.getElementById('resVerificationTableBody');
    const table = document.getElementById('resVerificationTable');
    const emptyState = document.getElementById('resTableEmptyState');
    const countIndicator = document.getElementById('resTotalCountIndicator');

    if (!tableBody) return;

    const total = residentApplications.length;
    const pendingCount = residentApplications.filter(a => a.status === 'Pending').length;
    const verifiedCount = residentApplications.filter(a => a.status === 'Verified').length;
    const rejectedCount = residentApplications.filter(a => a.status === 'Rejected').length;

    // Update Top KPI Counters
    const kpiTotal = document.getElementById('kpiValTotalApps');
    const kpiPending = document.getElementById('kpiValPendingApps');
    const kpiVerified = document.getElementById('kpiValVerifiedApps');
    const kpiRejected = document.getElementById('kpiValRejectedApps');
    if (kpiTotal) kpiTotal.textContent = total.toString();
    if (kpiPending) kpiPending.textContent = pendingCount.toString();
    if (kpiVerified) kpiVerified.textContent = verifiedCount.toString();
    if (kpiRejected) kpiRejected.textContent = rejectedCount.toString();

    // Update Filter Pills Badges
    const countAll = document.getElementById('resCountAll');
    const countPending = document.getElementById('resCountPending');
    const countVerified = document.getElementById('resCountVerified');
    const countRejected = document.getElementById('resCountRejected');
    if (countAll) countAll.textContent = total.toString();
    if (countPending) countPending.textContent = pendingCount.toString();
    if (countVerified) countVerified.textContent = verifiedCount.toString();
    if (countRejected) countRejected.textContent = rejectedCount.toString();

    // Update Sidebar Navigation Badge
    const sidebarBadge = document.getElementById('sidebarPendingVerifBadge');
    if (sidebarBadge) {
      sidebarBadge.textContent = pendingCount.toString();
      sidebarBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    // Filter applications
    const searchLower = (currentResSearch || '').trim().toLowerCase();
    const filtered = residentApplications.filter(app => {
      // Status filter
      if (currentResStatusFilter !== 'all' && app.status.toLowerCase() !== currentResStatusFilter.toLowerCase()) {
        return false;
      }
      // Sitio filter
      if (currentResSitioFilter !== 'all' && app.sitio !== currentResSitioFilter) {
        return false;
      }
      // Search by resident name only
      if (searchLower) {
          const matchName = String(app.fullName || '').toLowerCase().includes(searchLower);

          if (!matchName) {
              return false;
          }
      }
      return true;
    });

    // Update Count Indicator
    if (countIndicator) {
      countIndicator.innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${total}</strong> applications`;
    }

    // Render Table Content
    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      if (table) table.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (table) table.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = filtered.map(app => {
      const initials = getInitials(app.fullName);
      
      let statusClass = 'status-pending';
      let statusLabel = 'Pending';
      if (app.status === 'Verified') {
        statusClass = 'status-verified';
        statusLabel = 'Verified';
      } else if (app.status === 'Rejected') {
        statusClass = 'status-rejected';
        statusLabel = 'Rejected';
      }

      return `
        <tr data-app-id="${escapeHtml(app.id)}">
          <td>
            <div class="res-name-wrapper">
              <div class="res-avatar" aria-hidden="true">${initials}</div>
              <div class="res-name-info">
                <span class="res-name-title">${escapeHtml(app.fullName)}</span>
                <span class="res-email-sub">${escapeHtml(app.email)}</span>
              </div>
            </div>
          </td>
          <td>
            <div class="res-address-cell">${escapeHtml(app.address)}</div>
          </td>
          <td>
            <span class="res-sitio-tag">${escapeHtml(app.sitio)}</span>
          </td>
          <td>
            <span class="res-mobile-cell">${escapeHtml(app.mobile)}</span>
          </td>
          <td>
            <span class="res-registered-cell">${escapeHtml(app.registeredDate)}</span>
          </td>
          <td>
            <span class="res-status-pill ${statusClass}">
              <span class="status-pill-dot"></span> ${statusLabel}
            </span>
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn-res-view btn-view-res-modal" data-res-id="${escapeHtml(app.id)}" aria-label="View application details for ${escapeHtml(app.fullName)}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span>View</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function openResidentReviewModal(appId) {
    const app = residentApplications.find(a => String(a.id) === String(appId));
    if (!app) return;

    currentReviewingResId = appId;

    // Helper: Split name handling suffixes (Jr., Sr., II, III, etc.)
    function parseNameWithSuffix(fullName) {
      const suffixes = ['JR.', 'JR', 'SR.', 'SR', 'II', 'III', 'IV', 'V'];
      const clean = (fullName || '').trim();
      const parts = clean.split(/\s+/);
      if (parts.length <= 1) {
        return { lastName: clean.toUpperCase(), givenName: clean.toUpperCase() };
      }
      let suffix = '';
      if (parts.length > 2 && suffixes.includes(parts[parts.length - 1].toUpperCase())) {
        suffix = parts.pop().toUpperCase();
      }
      const lastName = parts.pop().toUpperCase() + (suffix ? ' ' + suffix : '');
      const givenName = parts.join(' ').toUpperCase();
      return { lastName, givenName };
    }

    const gender = app.gender || (app.fullName.toLowerCase().includes('clarisse') || app.fullName.toLowerCase().includes('maria') || app.fullName.toLowerCase().includes('rhea') || app.fullName.toLowerCase().includes('lourdes') || app.fullName.toLowerCase().includes('carmela') ? 'Female' : 'Male');

    // Header & Meta
    const modalSub = document.getElementById('resReviewModalSub');
    if (modalSub) {
      modalSub.innerHTML = `Application ID: <strong id="resReviewAppId">${escapeHtml(app.id)}</strong> · Submitted on <span id="resReviewAppDate">${escapeHtml(app.registeredDate)}</span>`;
    }

    const statusBadge = document.getElementById('resReviewStatusBadge');
    if (statusBadge) {
      statusBadge.className = `res-status-pill status-${app.status.toLowerCase()}`;
      statusBadge.innerHTML = `<span class="status-pill-dot"></span> ${escapeHtml(app.status)} Application`;
    }

    // Basic Profile Details
    const avatarEl = document.getElementById('resReviewAvatar');
    if (avatarEl) avatarEl.textContent = getInitials(app.fullName);

    const nameLg = document.getElementById('resReviewFullName');
    if (nameLg) nameLg.textContent = app.fullName;

    const subChannel = document.getElementById('resReviewSubchannel');
    if (subChannel) subChannel.textContent = `${app.channel || 'Online Resident Portal'} · Submitted`;

    const dName = document.getElementById('resReviewDetailName');
    if (dName) dName.textContent = app.fullName;

    const dDob = document.getElementById('resReviewDetailDob');
    if (dDob) dDob.textContent = formatDobAndAge(app.dob, app.age);

    const dGender = document.getElementById('resReviewDetailGender');
    if (dGender) dGender.textContent = gender;

    const dCivil = document.getElementById('resReviewDetailCivil');
    if (dCivil) dCivil.textContent = app.civilStatus || 'Single';

    const dMobile = document.getElementById('resReviewDetailMobile');
    if (dMobile) dMobile.textContent = app.mobile;

    const dEmail = document.getElementById('resReviewDetailEmail');
    if (dEmail) dEmail.textContent = app.email;

    const dAddress = document.getElementById('resReviewDetailAddress');
    if (dAddress) dAddress.textContent = app.address;

    const dSitio = document.getElementById('resReviewDetailSitio');
    if (dSitio) dSitio.textContent = app.sitio;

    // Prior Rejection History Banner
    const rejBanner = document.getElementById('resReviewRejectionBanner');
    const rejReasonText = document.getElementById('resReviewRejectionReasonText');
    const rejNotesText = document.getElementById('resReviewRejectionNotesText');
    if (rejBanner) {
      if (app.status === 'Rejected') {
        rejBanner.style.display = 'block';
        if (rejReasonText) rejReasonText.textContent = app.rejectionReason || 'Criteria Unmet';
        if (rejNotesText) rejNotesText.textContent = app.rejectionNotes ? `Remarks: ${app.rejectionNotes}` : 'Application declined by civil registry administration.';
      } else {
        rejBanner.style.display = 'none';
      }
    }

    // Uploaded Documents Rendering
    const idTypeTag = document.getElementById('resReviewIdTypeTag');
    if (idTypeTag) idTypeTag.textContent = app.idType || 'Philippine National ID (PhilID)';

    const proofTypeTag = document.getElementById('resReviewProofTypeTag');
    if (proofTypeTag) {
      proofTypeTag.textContent = app.proofType && !app.proofType.includes('None')
        ? app.proofType
        : 'Optional Proof (Not Attached)';
    }

    // Populate Dynamic Graphic Text / Image in Document 1: Government ID
    const nameInfo = parseNameWithSuffix(app.fullName);
    const idPreviewBox = document.getElementById('resReviewIdPreviewBox');

if (idPreviewBox) {
  const idDocumentUrl = getResidentDocumentUrl(app.idFilePath);

  if (idDocumentUrl) {
    idPreviewBox.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; padding:12px; background:#ffffff; border-radius:8px; width:100%;">
        <img
          src="${escapeHtml(idDocumentUrl)}"
          alt="Submitted Government ID"
          style="max-height:190px; max-width:100%; object-fit:contain; border-radius:6px;"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
        >
        <div style="display:none; color:#fca5a5; padding:12px; text-align:center;">
          Unable to load the submitted ID file.
        </div>
        <div style="margin-top:10px; font-size:12px; color:#0f172a; width:100%;">
          📎 ${escapeHtml(app.idType || 'Government ID')}
        </div>
        <a
          href="${escapeHtml(idDocumentUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          style="margin-top:8px; color:#0369a1; font-size:12px;"
        >
          Open Original Document
        </a>
      </div>
    `;
  } else {
    idPreviewBox.innerHTML = `
      <div style="padding:20px; text-align:center; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px;">
        <div style="font-weight:600; color:#334155;">No Government ID File Found</div>
        <div style="font-size:12px; color:#64748b; margin-top:4px;">
          No ID attachment path was returned for this resident.
        </div>
      </div>
    `;
  }
}

// Populate Proof of Residency with the original uploaded document
const proofPreviewBox = document.getElementById('resReviewProofPreviewBox');

if (proofPreviewBox) {
  const proofDocumentUrl = getResidentDocumentUrl(app.residencyProofPath);

  if (proofDocumentUrl) {
    proofPreviewBox.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; padding:12px; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; width:100%;">
        <img
          src="${escapeHtml(proofDocumentUrl)}"
          alt="Submitted Proof of Residency"
          style="max-height:190px; max-width:100%; object-fit:contain; border-radius:6px;"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
        >
        <div style="display:none; color:#b91c1c; padding:12px; text-align:center;">
          Unable to load the submitted proof document.
        </div>
        <div style="margin-top:10px; font-size:12px; color:#0f172a; width:100%;">
          📎 ${escapeHtml(app.proofType || 'Proof of Residency')}
        </div>
        <a
          href="${escapeHtml(proofDocumentUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          style="margin-top:8px; color:#0369a1; font-size:12px;"
        >
          Open Original Document
        </a>
      </div>
    `;
  } else {
    proofPreviewBox.innerHTML = `
      <div style="padding:24px 18px; text-align:center; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px;">
        <div style="font-weight:600; color:#334155; font-size:13px;">
          No Proof of Residency
        </div>
        <div style="font-size:12px; color:#64748b; margin-top:4px;">
          The applicant did not attach an optional proof-of-residency document.
        </div>
      </div>
    `;
  }
}

    // Workflow Action Controls Configuration
    const auditStatus = document.getElementById('resReviewAuditStatus');
    const auditDot = document.querySelector('#resReviewModal .res-modal-audit-note .status-pill-dot');
    const btnApprove = document.getElementById('btnApproveResident');
    const btnReject = document.getElementById('btnTriggerRejectModal');

    if (auditStatus) {
      if (app.status === 'Verified') {
        auditStatus.innerHTML = `<span style="color: #16a34a;">✓ Verified by Admin (${app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : 'Active'})</span>`;
        if (auditDot) auditDot.style.background = '#16a34a';
      } else if (app.status === 'Rejected') {
        auditStatus.innerHTML = `<span style="color: #dc2626;">✕ Declined (${app.rejectionReason || 'Criteria Unmet'})</span>`;
        if (auditDot) auditDot.style.background = '#dc2626';
      } else {
        auditStatus.innerHTML = `<span style="color: #d97706;">⚡ Awaiting Initial Verification Review</span>`;
        if (auditDot) auditDot.style.background = '#d97706';
      }
    }

    if (btnApprove) {
      if (app.status === 'Verified') {
        btnApprove.style.display = 'none';
      } else if (app.status === 'Rejected') {
        btnApprove.style.display = 'inline-flex';
        btnApprove.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Reconsider &amp; Approve</span>`;
      } else {
        btnApprove.style.display = 'inline-flex';
        btnApprove.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Approve Account</span>`;
      }
    }

    if (btnReject) {
      btnReject.style.display = (app.status === 'Verified' || app.status === 'Rejected') ? 'none' : 'inline-flex';
    }

    // Open Modal
    const modal = document.getElementById('resReviewModal');
    if (modal) modal.classList.add('active');
  }

  
async function approveResidentAccount(appId) {
    const app = residentApplications.find(
        a => String(a.id) === String(appId)
    );

    if (!app || app.status === 'Verified') return;

    try {
        // Retrieve and manage records through the Brgy360 backend API,
        // which uses Supabase PostgreSQL as its database.
        const response = await fetch(
            `${ADMIN_API_BASE}/admin/residents/${app.id}/verification`,
            {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    verification_status: 'Verified',
                    verification_notes: null
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to approve resident.');
        }

        app.status = 'Verified';

        // Send a setup email only if the resident has no password yet.
        if (!app.hasPassword) {
            const emailResponse = await fetch(
                `${ADMIN_API_BASE}/admin/residents/${app.id}/send-setup-email`,
                {
                    method: 'POST',
                    credentials: 'include'
                }
            );

            const emailData = await emailResponse.json();

            if (!emailResponse.ok) {
                throw new Error(
                    emailData.message ||
                    'Resident approved, but the setup email could not be sent.'
                );
            }
        }

        // Close the review modal.
        document.getElementById('resReviewModal')?.classList.remove('active');

        // Show the appropriate success message.
        if (app.hasPassword) {
            showAdminToast(
                'Resident Approved',
                `${app.fullName} has been approved. They can now log in using their registered email and password.`,
                'success'
            );
        } else {
            showAdminToast(
                'Resident Approved',
                `${app.fullName} has been approved. The account setup email was sent to ${app.email}.`,
                'success'
            );
        }

        // Retrieve and manage records through the Brgy360 backend API,
        // which uses Supabase PostgreSQL as its database.
        await loadResidentApplicationsFromAPI();
        await loadGeographicBreakdownFromAPI();
        refreshAdminDashboard();

    } catch (error) {
        console.error('Approval error:', error);
        alert(error.message);
    }
}

  function openResidentRejectModal(appId) {
    const app = residentApplications.find(
    a => String(a.id) === String(appId)
);
    if (!app || app.status === 'Verified') return;

    currentRejectingResId = appId;

    const summaryEl = document.getElementById('resRejectApplicantSummary');
    if (summaryEl) {
      summaryEl.textContent = `${app.fullName} (${app.id}) · ${app.sitio}`;
    }

    // Reset radio selection
    const reasonInvalid = document.getElementById('reasonInvalidId');
    if (reasonInvalid) reasonInvalid.checked = true;

    const reasonCards = document.querySelectorAll('.res-reason-card');
    reasonCards.forEach(c => c.classList.remove('selected'));
    const firstCard = document.querySelector('.res-reason-card[for="reasonInvalidId"]');
    if (firstCard) firstCard.classList.add('selected');

    // Clear notes
    const notesInput = document.getElementById('resRejectNotesInput');
    if (notesInput) notesInput.value = '';

    const rejectModal = document.getElementById('resRejectModal');
    if (rejectModal) rejectModal.classList.add('active');
  }

    async function confirmResidentRejection() {
    if (!currentRejectingResId) return;

    const app = residentApplications.find(
        a => String(a.id) === String(currentRejectingResId)
    );

    if (!app || app.status === 'Verified') return;

    const selectedRadio = document.querySelector(
        'input[name="resRejectReason"]:checked'
    );

    const reasonVal = selectedRadio
        ? selectedRadio.value
        : 'Invalid ID';

    const notesInput = document.getElementById('resRejectNotesInput');
    const notesVal = notesInput ? notesInput.value.trim() : '';

    const verificationNotes = notesVal
        ? `${reasonVal}: ${notesVal}`
        : reasonVal;

    try {
        const response = await fetch(
            `${ADMIN_API_BASE}/admin/residents/${app.id}/verification`,
            {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    verification_status: 'Rejected',
                    verification_notes: verificationNotes
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to reject application.');
        }

        // Close both modals.
        document.getElementById('resRejectModal')?.classList.remove('active');
        document.getElementById('resReviewModal')?.classList.remove('active');

        showAdminToast(
            'Application Rejected',
            `The application for ${app.fullName} has been rejected.`,
            'danger'
        );

        // Retrieve and manage records through the Brgy360 backend API,
        // which uses Supabase PostgreSQL as its database.
        await loadResidentApplicationsFromAPI();
        await loadGeographicBreakdownFromAPI();
        refreshAdminDashboard();

        currentRejectingResId = null;

    } catch (error) {
        console.error('Rejection error:', error);
        alert(error.message);
    }
}

  // Lightbox Zoom & Preview Engine
  function applyLightboxTransform() {
    const viewport = document.getElementById('resLightboxViewport');
    if (viewport) {
      viewport.style.transform = `scale(${currentLightboxZoom}) rotate(${currentLightboxRotation}deg)`;
    }
  }

  function openDocumentLightbox(type) {
    const lightbox = document.getElementById('resDocLightboxModal');
    const viewport = document.getElementById('resLightboxViewport');
    const titleEl = document.getElementById('resLightboxTitle');

    if (!lightbox || !viewport) return;

    viewport.innerHTML = '';
    currentLightboxZoom = 1;
    currentLightboxRotation = 0;
    applyLightboxTransform();

    if (type === 'id') {
      if (titleEl) titleEl.textContent = 'Government Identification Preview & Inspection';
      const uploadedImg = document.querySelector('#resReviewIdPreviewBox img');
      if (uploadedImg) {
        const cloned = uploadedImg.cloneNode(true);
        cloned.style.maxHeight = '70vh';
        cloned.style.maxWidth = '90vw';
        viewport.appendChild(cloned);
      } else {
        const source = document.querySelector('#resReviewIdPreviewBox .res-id-graphic');
        if (source) viewport.appendChild(source.cloneNode(true));
      }
    } else {
      if (titleEl) titleEl.textContent = 'Proof of Residency Document Inspection';
      const uploadedImg = document.querySelector('#resReviewProofPreviewBox img');
      if (uploadedImg) {
        const cloned = uploadedImg.cloneNode(true);
        cloned.style.maxHeight = '70vh';
        cloned.style.maxWidth = '90vw';
        viewport.appendChild(cloned);
      } else {
        const source = document.querySelector('#resReviewProofPreviewBox .res-proof-graphic') || document.querySelector('#resReviewProofPreviewBox > div');
        if (source) viewport.appendChild(source.cloneNode(true));
      }
    }

    lightbox.classList.add('active');
  }

  // Export Registry CSV
  function exportResidentRegistryCsv() {
    if (!residentApplications || residentApplications.length === 0) {
      showAdminToast('Export Warning', 'No resident records available to export.', 'warning');
      return;
    }

    const headers = [
      'Application ID',
      'Full Name',
      'Email Address',
      'Mobile Number',
      'Date of Birth',
      'Civil Status',
      'Full Address',
      'Sitio / Purok',
      'Registered Date',
      'Verification Status',
      'ID Type',
      'ID Number',
      'Proof Document',
      'Rejection Reason'
    ];

    const rows = residentApplications.map(app => [
      `"${app.id || ''}"`,
      `"${(app.fullName || '').replace(/"/g, '""')}"`,
      `"${app.email || ''}"`,
      `"${app.mobile || ''}"`,
      `"${app.dob || ''}"`,
      `"${app.civilStatus || ''}"`,
      `"${(app.address || '').replace(/"/g, '""')}"`,
      `"${app.sitio || ''}"`,
      `"${app.registeredDate || ''}"`,
      `"${app.status || ''}"`,
      `"${app.idType || ''}"`,
      `"${app.idNumber || ''}"`,
      `"${app.proofType || ''}"`,
      `"${app.rejectionReason || 'None'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Barangay_Pallocan_West_Resident_Verification_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showAdminToast('Export Completed', 'Resident verification registry downloaded as CSV.', 'success');
  }

  // Pre-Registration Submission Handler
  async function handlePreRegistrationSubmit() {
    const fullNameInput = document.getElementById('preRegFullName');
    const dobInput = document.getElementById('preRegDob');
    const ageInput = document.getElementById('preRegAge');
    const mobileInput = document.getElementById('preRegMobile');
    const emailInput = document.getElementById('preRegEmail');
    const addressInput = document.getElementById('preRegAddress');
    const sitioInput = document.getElementById('preRegSitio');

    const fullNameErr = document.getElementById('preRegFullNameError');
    const dobErr = document.getElementById('preRegDobError');
    const ageErr = document.getElementById('preRegAgeError');
    const mobileErr = document.getElementById('preRegMobileError');
    const emailErr = document.getElementById('preRegEmailError');
    const addressErr = document.getElementById('preRegAddressError');
    const sitioErr = document.getElementById('preRegSitioError');

    let isValid = true;
    let firstInvalid = null;

    function markInvalid(inputEl, errorEl, message) {
      if (inputEl) inputEl.classList.add('is-invalid');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      }
      if (!firstInvalid && inputEl) firstInvalid = inputEl;
      isValid = false;
    }

    function markValid(inputEl, errorEl) {
      if (inputEl) inputEl.classList.remove('is-invalid');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
      }
    }

    const fullName = (fullNameInput?.value || '').trim();
    const dob = dobInput?.value || '';
    const ageVal = (ageInput?.value || '').trim();
    const mobile = (mobileInput?.value || '').trim();
    const email = (emailInput?.value || '').trim();
    const address = (addressInput?.value || '').trim();
    const sitio = sitioInput?.value || '';
    const gender = document.getElementById('preRegGender')?.value || 'Female';
    const civil = document.getElementById('preRegCivilStatus')?.value || 'Single';
    const idType = document.getElementById('preRegIdType')?.value;
    const idNumber = document.getElementById('preRegIdNumber')?.value?.trim() || '';
    const proofType = document.getElementById('preRegProofType')?.value;

    // 1. Name: Letters and spaces only. No numbers or special characters.
    if (!fullName) {
      markInvalid(fullNameInput, fullNameErr, 'Full legal name is required.');
    } else if (!/^[a-zA-Z\s]+$/.test(fullName)) {
      markInvalid(fullNameInput, fullNameErr, 'Name must contain letters and spaces only. Numbers and special characters are not allowed.');
    } else if (fullName.length < 2) {
      markInvalid(fullNameInput, fullNameErr, 'Name must be at least 2 characters long.');
    } else {
      markValid(fullNameInput, fullNameErr);
    }

    // 2. Date of Birth
    if (!dob) {
      markInvalid(dobInput, dobErr, 'Date of birth is required.');
    } else {
      const d = new Date(dob);
      const today = new Date();
      if (isNaN(d.getTime()) || d > today || d.getFullYear() < 1900) {
        markInvalid(dobInput, dobErr, 'Please select a valid past date of birth.');
      } else {
        markValid(dobInput, dobErr);
      }
    }

    // 3. Age: Numeric digits only. No letters or special characters.
    if (!ageVal) {
      markInvalid(ageInput, ageErr, 'Age is required.');
    } else if (!/^\d+$/.test(ageVal)) {
      markInvalid(ageInput, ageErr, 'Age must contain numeric digits only. Letters and special characters are not allowed.');
    } else {
      const a = parseInt(ageVal, 10);
      if (isNaN(a) || a < 1 || a > 120) {
        markInvalid(ageInput, ageErr, 'Please enter a valid age between 1 and 120.');
      } else {
        markValid(ageInput, ageErr);
      }
    }

    // 4. Contact Number: Numeric digits only. No letters or special characters.
    if (!mobile) {
      markInvalid(mobileInput, mobileErr, 'Contact number is required.');
    } else if (!/^\d+$/.test(mobile)) {
      markInvalid(mobileInput, mobileErr, 'Contact number must contain numeric digits only. Letters and special characters are not allowed.');
    } else if (mobile.length < 7 || mobile.length > 11) {
      markInvalid(mobileInput, mobileErr, 'Contact number must be between 7 and 11 numeric digits (e.g. 09171234567).');
    } else {
      markValid(mobileInput, mobileErr);
    }

    // 5. Email Address: Valid format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email) {
      markInvalid(emailInput, emailErr, 'Email address is required.');
    } else if (!emailRegex.test(email)) {
      markInvalid(emailInput, emailErr, 'Please enter a valid email address (e.g. resident@example.com).');
    } else {
      markValid(emailInput, emailErr);
    }

    // 6. Address
    if (!address || address.length < 5) {
      markInvalid(addressInput, addressErr, 'Street address is required (at least 5 characters).');
    } else {
      markValid(addressInput, addressErr);
    }

    // 7. Sitio
    if (!sitio) {
      markInvalid(sitioInput, sitioErr, 'Please select Sitio / Purok.');
    } else {
      markValid(sitioInput, sitioErr);
    }

    if (!isValid) {
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    
    // Prepare resident information for the backend
    const residentData = {
        full_legal_name: fullName,
        gender: gender,
        civil_status: civil,
        date_of_birth: dob,
        mobile_number: mobile,
        email: email,
        address: address,
        sitio_purok: sitio,
        id_type: idType || null,
        id_card_number: idNumber || null,
        residency_proof_type: proofType || null
    };

    try {
        const enrollButton = document.querySelector(
            '#preRegisterForm button[type="submit"]'
        );

        if (enrollButton) {
            enrollButton.disabled = true;
            enrollButton.textContent = 'Enrolling...';
        }

        const response = await fetch(
            `${ADMIN_API_BASE}/admin/residents/pre-register`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(residentData)
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || 'Unable to pre-register resident.'
            );
        }

        // Reload pending residents from the database
        await loadResidentApplicationsFromAPI();
        await loadGeographicBreakdownFromAPI();

        // Close modal and reset form
        const modal = document.getElementById('resPreRegisterModal');

        if (modal) {
            modal.classList.remove('active');
        }

        document.getElementById('preRegisterForm')?.reset();

        showAdminToast(
            'Pre-Registration Successful',
            `Applicant ${fullName} has been added to the pending verification list.`,
            'success'
        );

        renderResidentVerificationTable();
        refreshAdminDashboard();

    } catch (error) {
        console.error('Pre-registration error:', error);

        showAdminToast(
            'Pre-Registration Failed',
            error.message || 'Unable to save resident information.',
            'error'
        );

    } finally {
        const enrollButton = document.querySelector(
            '#preRegisterForm button[type="submit"]'
        );

        if (enrollButton) {
            enrollButton.disabled = false;
            enrollButton.textContent = 'Enroll';
        }
    }
  }

document.getElementById('preRegisterForm')?.addEventListener('submit', function (event) {
    event.preventDefault();
    handlePreRegistrationSubmit();
});

  // Initialize Resident Verification Module Event Handlers
  function initResidentVerificationModule() {
    // 1. Status Filter Pills
    const filterPills = document.querySelectorAll('.res-filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', function () {
        filterPills.forEach(p => {
          p.classList.remove('active');
          p.setAttribute('aria-selected', 'false');
        });
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');
        currentResStatusFilter = this.getAttribute('data-res-status') || 'all';
        renderResidentVerificationTable();
      });
    });

    // 2. Search Input
    const searchInput = document.getElementById('resSearchInput');
    const clearSearchBtn = document.getElementById('btnClearResSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        currentResSearch = this.value;
        if (clearSearchBtn) {
          clearSearchBtn.style.display = this.value.length > 0 ? 'block' : 'none';
        }
        renderResidentVerificationTable();
      });
    } else {
    console.error('Residents List search input was not found.');
}

    if (clearSearchBtn && searchInput) {
      clearSearchBtn.addEventListener('click', function () {
        searchInput.value = '';
        currentResSearch = '';
        this.style.display = 'none';
        renderResidentVerificationTable();
        searchInput.focus();
      });
    }

    // 3. Sitio Dropdown Filter
    const sitioFilter = document.getElementById('resSitioFilter');
    if (sitioFilter) {
      sitioFilter.addEventListener('change', function () {
        currentResSitioFilter = this.value;
        renderResidentVerificationTable();
      });
    }

    // 4. Reset Filters Button in Empty State
    const btnResetFilters = document.getElementById('btnResetResFilters');
    if (btnResetFilters) {
      btnResetFilters.addEventListener('click', () => {
        currentResStatusFilter = 'all';
        currentResSearch = '';
        currentResSitioFilter = 'all';
        if (searchInput) searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        if (sitioFilter) sitioFilter.value = 'all';

        filterPills.forEach(p => {
          const isAll = p.getAttribute('data-res-status') === 'all';
          p.classList.toggle('active', isAll);
          p.setAttribute('aria-selected', isAll ? 'true' : 'false');
        });

        renderResidentVerificationTable();
      });
    }

    // 5. Table "View" Button Click Delegation
    const tableBody = document.getElementById('resVerificationTableBody');
    if (tableBody) {
      tableBody.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-view-res-modal');
        if (btn) {
          const appId = btn.getAttribute('data-res-id');
          if (appId) openResidentReviewModal(appId);
        }
      });
    }

    // 6. Detailed Review Modal Controls
    const btnCloseReview = document.getElementById('btnCloseResReviewModal');
    const btnFooterClose = document.getElementById('btnFooterCloseReview');
    const reviewModal = document.getElementById('resReviewModal');

    const closeReviewModal = () => {
      if (reviewModal) reviewModal.classList.remove('active');
    };

    if (btnCloseReview) btnCloseReview.addEventListener('click', closeReviewModal);
    if (btnFooterClose) btnFooterClose.addEventListener('click', closeReviewModal);

    // Approve Button in Review Modal
    const btnApprove = document.getElementById('btnApproveResident');
    if (btnApprove) {
      btnApprove.addEventListener('click', () => {
        if (currentReviewingResId) approveResidentAccount(currentReviewingResId);
      });
    }

    // Reject Button in Review Modal
    const btnTriggerReject = document.getElementById('btnTriggerRejectModal');
    if (btnTriggerReject) {
      btnTriggerReject.addEventListener('click', () => {
        if (currentReviewingResId) openResidentRejectModal(currentReviewingResId);
      });
    }

    // Document Zoom Buttons in Review Modal
    const btnZoomId = document.getElementById('btnZoomInspectId');
    if (btnZoomId) {
      btnZoomId.addEventListener('click', () => openDocumentLightbox('id'));
    }

    const btnZoomProof = document.getElementById('btnZoomInspectProof');
    if (btnZoomProof) {
      btnZoomProof.addEventListener('click', () => openDocumentLightbox('proof'));
    }

    // 7. Rejection Modal Controls
    const rejectModal = document.getElementById('resRejectModal');
    const btnCloseReject = document.getElementById('btnCloseResRejectModal');
    const btnCancelReject = document.getElementById('btnCancelResReject');
    const btnConfirmReject = document.getElementById('btnConfirmResReject');

    const closeRejectModal = () => {
      if (rejectModal) rejectModal.classList.remove('active');
    };

    if (btnCloseReject) btnCloseReject.addEventListener('click', closeRejectModal);
    if (btnCancelReject) btnCancelReject.addEventListener('click', closeRejectModal);
    if (btnConfirmReject) btnConfirmReject.addEventListener('click', confirmResidentRejection);

    // Rejection reason card selector interactive styling
    const reasonCards = document.querySelectorAll('.res-reason-card');
    reasonCards.forEach(card => {
      card.addEventListener('click', function () {
        reasonCards.forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        const radio = this.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    // 8. Document Lightbox Controls
    const lightboxModal = document.getElementById('resDocLightboxModal');
    const btnCloseLightbox = document.getElementById('btnCloseLightbox');
    if (btnCloseLightbox && lightboxModal) {
      btnCloseLightbox.addEventListener('click', () => lightboxModal.classList.remove('active'));
    }

    const btnZoomIn = document.getElementById('btnLightboxZoomIn');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        currentLightboxZoom = Math.min(2.5, currentLightboxZoom + 0.25);
        applyLightboxTransform();
      });
    }

    const btnZoomOut = document.getElementById('btnLightboxZoomOut');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        currentLightboxZoom = Math.max(0.5, currentLightboxZoom - 0.25);
        applyLightboxTransform();
      });
    }

    const btnResetZoom = document.getElementById('btnLightboxReset');
    if (btnResetZoom) {
      btnResetZoom.addEventListener('click', () => {
        currentLightboxZoom = 1;
        currentLightboxRotation = 0;
        applyLightboxTransform();
      });
    }

    const btnRotate = document.getElementById('btnLightboxRotate');
    if (btnRotate) {
      btnRotate.addEventListener('click', () => {
        currentLightboxRotation = (currentLightboxRotation + 90) % 360;
        applyLightboxTransform();
      });
    }

    // 9. Pre-Registration Intake Modal Controls
    const preRegModal = document.getElementById('resPreRegisterModal');
    const btnOpenPreReg = document.getElementById('btnOpenPreRegisterModal');
    const btnClosePreReg = document.getElementById('btnClosePreRegisterModal');
    const btnCancelPreReg = document.getElementById('btnCancelPreRegister');
    const btnSubmitPreReg = document.getElementById('btnSubmitPreRegister');

    if (btnOpenPreReg && preRegModal) {
      btnOpenPreReg.addEventListener('click', () => preRegModal.classList.add('active'));
    }

    const closePreRegModal = () => {
      if (preRegModal) preRegModal.classList.remove('active');
    };

    if (btnClosePreReg) btnClosePreReg.addEventListener('click', closePreRegModal);
    if (btnCancelPreReg) btnCancelPreReg.addEventListener('click', closePreRegModal);
    if (btnSubmitPreReg) btnSubmitPreReg.addEventListener('click', handlePreRegistrationSubmit);

    // Real-time input restrictions and error clearing for Pre-Registration Intake Form
    const preRegNameEl = document.getElementById('preRegFullName');
    const preRegMobileEl = document.getElementById('preRegMobile');
    const preRegAgeEl = document.getElementById('preRegAge');
    const preRegDobEl = document.getElementById('preRegDob');
    const preRegEmailEl = document.getElementById('preRegEmail');
    const preRegAddrEl = document.getElementById('preRegAddress');
    const preRegSitioEl = document.getElementById('preRegSitio');

    if (preRegNameEl) {
      preRegNameEl.addEventListener('input', function () {
        this.value = this.value.replace(/[^a-zA-Z\s]/g, '');
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('preRegFullNameError');
        if (err) err.textContent = '';
      });
    }

    if (preRegMobileEl) {
      preRegMobileEl.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '');
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('preRegMobileError');
        if (err) err.textContent = '';
      });
    }

    if (preRegAgeEl) {
      preRegAgeEl.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '');
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('preRegAgeError');
        if (err) err.textContent = '';
      });
    }

    if (preRegDobEl) {
      preRegDobEl.max = new Date().toISOString().split('T')[0];
      preRegDobEl.addEventListener('change', function () {
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('preRegDobError');
        if (err) err.textContent = '';
        if (this.value) {
          const birthDate = new Date(this.value);
          const today = new Date();
          let calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
          }
          if (calculatedAge >= 0 && preRegAgeEl) {
            preRegAgeEl.value = calculatedAge;
            preRegAgeEl.classList.remove('is-invalid', 'input-error');
            const aErr = document.getElementById('preRegAgeError');
            if (aErr) aErr.textContent = '';
          }
        }
      });
    }

    if (preRegEmailEl) {
      preRegEmailEl.addEventListener('input', function () {
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('preRegEmailError');
        if (err) err.textContent = '';
      });
    }

    if (preRegAddrEl) {
      preRegAddrEl.addEventListener('input', function () {
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('preRegAddressError');
        if (err) err.textContent = '';
      });
    }

    if (preRegSitioEl) {
      preRegSitioEl.addEventListener('change', function () {
        this.classList.remove('is-invalid', 'input-error');
        const err = document.getElementById('preRegSitioError');
        if (err) err.textContent = '';
      });
    }

    // 10. Activation Notice Modal Controls
    const actNoticeModal = document.getElementById('resActivationNoticeModal');
    const btnCloseActNotice = document.getElementById('btnCloseActivationNotice');
    if (btnCloseActNotice && actNoticeModal) {
      btnCloseActNotice.addEventListener('click', () => actNoticeModal.classList.remove('active'));
    }

    const btnCopyLink = document.getElementById('btnCopyActivationLink');
    if (btnCopyLink) {
      btnCopyLink.addEventListener('click', function () {
        const urlText = document.getElementById('resActivationUrlText')?.textContent || '';
        navigator.clipboard?.writeText(urlText).then(() => {
          this.textContent = 'Copied!';
          setTimeout(() => { this.textContent = 'Copy'; }, 2000);
        }).catch(() => {
          this.textContent = 'Copied!';
          setTimeout(() => { this.textContent = 'Copy'; }, 2000);
        });
      });
    }

    // 11. Export Registry Button
    const btnExport = document.getElementById('btnExportResidentRegistry');
    if (btnExport) btnExport.addEventListener('click', exportResidentRegistryCsv);
  }

// Barangay Officials filter and search state
let officialsFilterMode = 'all';
let officialsSearchQuery = '';

// Initial render of all sub-tables
renderProposalsTable();
loadProjectsFromDatabase();
loadAnnouncementsFromBackend();
initAdminBudgetModule();
initResidentVerificationModule();
loadResidentApplicationsFromAPI();
loadGeographicBreakdownFromAPI();
refreshAdminDashboard(getActiveDashboardYear());

  // Activate view from URL hash on load (once all datasets and modules are ready)
  const initialHash = window.location.hash.replace('#', '').toLowerCase();
  if (initialHash && viewTitles[initialHash]) {
    switchView(initialHash);
  }

  // ==============================================================
  // 12. TOAST NOTIFICATION ENGINE
  // ==============================================================
  function showAdminToast(title, message, type = 'info') {
    const container = document.getElementById('adminToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'danger') icon = '⚠️';
    if (type === 'warning') icon = '⚡';
    if (type === 'purple') icon = '🔮';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-body">
        <span class="toast-title">${escapeHtml(title)}</span>
        <span class="toast-msg">${escapeHtml(message)}</span>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 4200);
  }

  window.showAdminToast = showAdminToast;
  window.residentApplications = residentApplications;
  window.renderResidentVerificationTable = renderResidentVerificationTable;
  window.openResidentReviewModal = openResidentReviewModal;
  window.approveResidentAccount = approveResidentAccount;
  window.openResidentRejectModal = openResidentRejectModal;

  // ==============================================================
  // BARANGAY OFFICIALS ROSTER & COUNCIL MANAGEMENT
  // ==============================================================

  function renderAdminOfficialsView() {
    const officials = loadOfficials();
    const tableBody = document.getElementById('officialsTableBody');
    const emptyState = document.getElementById('officialsEmptyState');
    const countIndicator = document.getElementById('officialsCountIndicator');

    // 1. Compute summary counters
    const total = officials.length;
    const leaders = officials.filter(o => o.isLeader || o.position === 'Punong Barangay');
    const councilors = officials.filter(o => o.position === 'Sangguniang Barangay Member');
    const appointive = officials.filter(o => o.position === 'Brgy. Secretary' || o.position === 'Brgy. Treasurer');

    // Update KPI Card values
    const kpiValTotal = document.getElementById('kpiValTotalOfficials');
    const kpiValLeader = document.getElementById('kpiValLeaderCount');
    const kpiSubLeader = document.getElementById('kpiSubLeaderName');
    const kpiValCouncilors = document.getElementById('kpiValCouncilorsCount');
    const kpiValAppointive = document.getElementById('kpiValAppointiveCount');

    if (kpiValTotal) kpiValTotal.textContent = total;
    if (kpiValLeader) kpiValLeader.textContent = leaders.length;
    if (kpiSubLeader) kpiSubLeader.textContent = leaders.length > 0 ? ('Hon. ' + leaders[0].name) : 'Vacant';
    if (kpiValCouncilors) kpiValCouncilors.textContent = councilors.length;
    if (kpiValAppointive) kpiValAppointive.textContent = appointive.length;

    // Update filter pill counts
    const pillAll = document.getElementById('officialPillCountAll');
    const pillCouncilor = document.getElementById('officialPillCountCouncilor');
    const pillLeader = document.getElementById('officialPillCountLeader');
    const pillAppointive = document.getElementById('officialPillCountAppointive');

    if (pillAll) pillAll.textContent = total;
    if (pillCouncilor) pillCouncilor.textContent = councilors.length;
    if (pillLeader) pillLeader.textContent = leaders.length;
    if (pillAppointive) pillAppointive.textContent = appointive.length;

    // 2. Apply filtering & administrative hierarchy sorting (Captain -> Councilors -> Secretary & Treasurer last)
    const getAdminOfficialRank = (o) => {
      const pos = (o.position || '').toLowerCase();
      if (o.isLeader || pos.includes('punong barangay') || pos.includes('captain')) return 1;
      if (pos.includes('secretary')) return 3;
      if (pos.includes('treasurer')) return 4;
      return 2; // Sangguniang Barangay Members / Councilors
    };

    const orderedOfficials = [...officials].sort((a, b) => {
      const rankDiff = getAdminOfficialRank(a) - getAdminOfficialRank(b);
      if (rankDiff !== 0) return rankDiff;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    const q = officialsSearchQuery.trim().toLowerCase();
    const filtered = orderedOfficials.filter(official => {
      // Pill category filter
      if (officialsFilterMode === 'councilor' && official.position !== 'Sangguniang Barangay Member') {
        return false;
      }
      if (officialsFilterMode === 'leader' && !(official.isLeader || official.position === 'Punong Barangay')) {
        return false;
      }
      if (officialsFilterMode === 'appointive' && !(official.position === 'Brgy. Secretary' || official.position === 'Brgy. Treasurer')) {
        return false;
      }

      // Search query filter
      if (q) {
        const matchName = (official.name || '').toLowerCase().includes(q);
        const matchPos = (official.position || '').toLowerCase().includes(q);
        const matchRole = (official.role || '').toLowerCase().includes(q);
        const matchContact = (official.contact || '').toLowerCase().includes(q);
        const matchSched = (official.schedule || '').toLowerCase().includes(q);
        if (!matchName && !matchPos && !matchRole && !matchContact && !matchSched) {
          return false;
        }
      }
      return true;
    });

    // 3. Render table rows
    if (!tableBody) return;

    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (countIndicator) {
        countIndicator.innerHTML = `Showing <strong>0</strong> of <strong>${total}</strong> officials`;
      }
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = filtered.map(official => {
      const isLeader = Boolean(official.isLeader || official.position === 'Punong Barangay');
      const initials = (official.name || 'Official')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('');

      const cleanPhone = (official.contact || '').replace(/\s+/g, '');

      // Status pill badge
      let statusBadge = '';
      if (official.status === 'Term Completed') {
        statusBadge = `<span class="badge-status yellow" style="font-size: 10px; margin-left: 6px;">Term Done</span>`;
      } else if (official.status === 'On Leave') {
        statusBadge = `<span class="badge-status warning" style="font-size: 10px; margin-left: 6px;">On Leave</span>`;
      } else {
        statusBadge = `<span class="badge-status green" style="font-size: 10px; margin-left: 6px;">Active</span>`;
      }

      // Position pill styling
      let posColor = '#2563eb';
      let posBg = '#eff6ff';
      let posBorder = '#bfdbfe';
      if (isLeader) {
        posColor = '#0d47a1';
        posBg = '#e0f2fe';
        posBorder = '#7dd3fc';
      } else if (official.position === 'Brgy. Secretary' || official.position === 'Brgy. Treasurer') {
        posColor = '#b45309';
        posBg = '#fef3c7';
        posBorder = '#fde68a';
      }

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: ${isLeader ? 'linear-gradient(135deg, #0d47a1 0%, #1e40af 100%)' : '#e2e8f0'}; color: ${isLeader ? '#fff' : '#1e293b'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0; border: 1.5px solid ${isLeader ? '#f59e0b' : '#cbd5e1'};">
                ${isLeader ? '★' : initials}
              </div>
              <div>
                <div style="font-weight: 700; color: #0f172a; font-size: 13.5px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                  <span>${escapeOfficialHtml(official.name)}</span>
                  ${statusBadge}
                </div>
                <div style="font-size: 11px; color: #64748b;">ID #${official.id} · Term: ${escapeOfficialHtml(official.term || 'Active')}</div>
              </div>
            </div>
          </td>
          <td>
            <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: ${posBg}; color: ${posColor}; border: 1px solid ${posBorder};">
              ${escapeOfficialHtml(official.position)}
            </span>
          </td>
          <td style="color: #334155; font-size: 12px; line-height: 1.4;">
            ${escapeOfficialHtml(official.role || 'General Council Duties')}
          </td>
          <td>
            <a href="tel:${escapeOfficialHtml(cleanPhone)}" style="color: #0d47a1; font-weight: 600; text-decoration: none; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span>${escapeOfficialHtml(official.contact || 'None')}</span>
            </a>
          </td>
          <td style="color: #475569; font-size: 12px;">
            <div style="display: inline-flex; align-items: center; gap: 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>${escapeOfficialHtml(official.schedule || 'Regular Office Hours')}</span>
            </div>
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn-res-action secondary" data-official-id="${official.id}" style="padding: 5px 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              <span>Edit</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Handle Edit button clicks using event delegation
tableBody.onclick = function (event) {
  const editButton = event.target.closest('button[data-official-id]');

  if (!editButton) return;

  event.preventDefault();
  event.stopPropagation();

  const id = editButton.getAttribute('data-official-id');
  openEditOfficialModal(id);
};

    if (countIndicator) {
      countIndicator.innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${total}</strong> officials`;
    }
  }

  function openEditOfficialModal(id) {
    const officials = loadOfficials();
    const official = officials.find(o => Number(o.id) === Number(id));
    if (!official) {
      showAdminToast('Official Not Found', 'Could not locate official record to edit.', 'warning');
      return;
    }

    const modal = document.getElementById('editOfficialModal');
    if (!modal) return;

    document.getElementById('editOfficialId').value = official.id;
    document.getElementById('editOfficialName').value = official.name || '';
    document.getElementById('editOfficialPosition').value = official.position || 'Sangguniang Barangay Member';
    document.getElementById('editOfficialStatus').value = official.status || 'Active';
    document.getElementById('editOfficialRole').value = official.role || '';
    document.getElementById('editOfficialContact').value = official.contact || '';
    document.getElementById('editOfficialSchedule').value = official.schedule || '';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeEditOfficialModal() {
    const modal = document.getElementById('editOfficialModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  
  async function saveOfficialFromModal() {
  const id = document.getElementById('editOfficialId')?.value;
  const nameInput = document.getElementById('editOfficialName');
  const name = nameInput?.value?.trim();
  const position = document.getElementById('editOfficialPosition')?.value;
  const status = document.getElementById('editOfficialStatus')?.value || 'Active';
  const role = document.getElementById('editOfficialRole')?.value?.trim();
  const contact = document.getElementById('editOfficialContact')?.value?.trim();
  const schedule = document.getElementById('editOfficialSchedule')?.value?.trim();

  if (!name) {
    if (nameInput) {
      nameInput.focus();
      nameInput.style.borderColor = '#ef4444';
    }

    showAdminToast(
      'Name Required',
      'Please provide the official’s legal name.',
      'warning'
    );
    return;
  }

  const currentOfficial = loadOfficials().find(
    official => Number(official.id) === Number(id)
  );

  if (!currentOfficial) {
    showAdminToast(
      'Official Not Found',
      'Could not locate the official record.',
      'warning'
    );
    return;
  }

  const isLeader = position === 'Punong Barangay';

  const btnSave = document.getElementById('btnSaveOfficialChanges');

  try {
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = 'Saving...';
    }

    await updateOfficial(id, {
      name,
      position,
      term: currentOfficial.term || '',
      status,
      role: role || 'General Council Duties',
      contact: contact || 'None',
      schedule: schedule || 'Regular Office Hours',
      isLeader,
      gridClass: currentOfficial.gridClass,
      displayOrder: currentOfficial.displayOrder
    });

    closeEditOfficialModal();
    renderAdminOfficialsView();

    showAdminToast(
      'Barangay Official Updated',
      `Successfully updated record for "${escapeOfficialHtml(name)}".`,
      'success'
    );

  } catch (error) {
    console.error('Official update error:', error);

    showAdminToast(
      'Update Failed',
      error.message || 'Could not save official details.',
      'danger'
    );

  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = 'Save Changes';
    }
  }
}

  async function initOfficialsModule() {
    // Search input
    const searchInput = document.getElementById('officialsSearchInput');
    const clearBtn = document.getElementById('btnClearOfficialsSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        officialsSearchQuery = this.value;
        if (clearBtn) clearBtn.style.display = officialsSearchQuery ? 'inline-block' : 'none';
        renderAdminOfficialsView();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (searchInput) searchInput.value = '';
        officialsSearchQuery = '';
        this.style.display = 'none';
        renderAdminOfficialsView();
      });
    }

    // Filter pills
    const pillContainer = document.getElementById('officialsFilterPills');
    if (pillContainer) {
      const pills = pillContainer.querySelectorAll('button[data-official-filter]');
      pills.forEach(pill => {
        pill.addEventListener('click', function () {
          pills.forEach(p => p.classList.remove('active'));
          this.classList.add('active');
          officialsFilterMode = this.getAttribute('data-official-filter') || 'all';
          renderAdminOfficialsView();
        });
      });
    }

    // Reset filters button
    const btnResetFilters = document.getElementById('btnResetOfficialsFilters');
    if (btnResetFilters) {
      btnResetFilters.addEventListener('click', function () {
        officialsSearchQuery = '';
        officialsFilterMode = 'all';
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        const pills = pillContainer?.querySelectorAll('button[data-official-filter]');
        pills?.forEach(p => p.classList.toggle('active', p.getAttribute('data-official-filter') === 'all'));
        renderAdminOfficialsView();
      });
    }
    
    // Reset roster to default in PostgreSQL
    const btnResetRoster = document.getElementById('btnResetOfficialsRoster');

    if (btnResetRoster) {
      btnResetRoster.addEventListener('click', async function () {
        if (!confirm('Are you sure you want to reset all Barangay Officials to the original default roster?')) {
          return;
        }

        try {
          btnResetRoster.disabled = true;

          await resetOfficialsToDefault();

          renderAdminOfficialsView();

          showAdminToast(
            'Roster Reset',
            'Barangay Officials roster has been restored to default.',
            'info'
          );

        } catch (error) {
          console.error('Officials roster reset failed:', error);

          showAdminToast(
            'Reset Failed',
            error.message || 'Could not restore the default roster.',
            'danger'
          );

        } finally {
          btnResetRoster.disabled = false;
        }
      });
    }

    // Modal buttons
    const btnCloseModal = document.getElementById('btnCloseEditOfficialModal');
    const btnCancelModal = document.getElementById('btnCancelEditOfficial');
    const btnSaveModal = document.getElementById('btnSaveOfficialChanges');
    const modalOverlay = document.getElementById('editOfficialModal');

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeEditOfficialModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeEditOfficialModal);
    if (btnSaveModal) btnSaveModal.addEventListener('click', saveOfficialFromModal);

    if (modalOverlay) {
      modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) closeEditOfficialModal();
      });
    }

    // Update the Admin Console header with the current Barangay Secretary.
    function syncAdminSecretaryName() {
    const secretary = loadOfficials().find(official =>
      String(official.position || '').toLowerCase().includes('secretary')
    );

    if (!secretary) return;

    // Top-right header name
    const headerName = document.querySelector(
      '.topbar-user-badge .user-name-tag'
    );

    // Sidebar profile name above Public Home
    const sidebarName = document.querySelector(
      '.sidebar-footer .profile-name'
    );

    if (headerName) {
      headerName.textContent = secretary.name;
    }

    if (sidebarName) {
      sidebarName.textContent = secretary.name;
      sidebarName.title = secretary.name;
    }
  }

// Subscribe to external store changes.
subscribeOfficials(() => {
  renderAdminOfficialsView();
  syncAdminSecretaryName();
});

    // Make functions accessible globally
    window.renderAdminOfficialsView = renderAdminOfficialsView;
    window.openEditOfficialModal = openEditOfficialModal;
    window.closeEditOfficialModal = closeEditOfficialModal;

    // Load Barangay Officials from PostgreSQL before rendering.
    try {
      await loadOfficialsFromAPI();

      renderAdminOfficialsView();

      syncAdminSecretaryName();

      console.log('Barangay Officials loaded from PostgreSQL:', loadOfficials());

    } catch (error) {
      console.error('Failed to load Barangay Officials from PostgreSQL:', error);

      renderAdminOfficialsView();

      showAdminToast(
        'Officials Loading Failed',
        error.message || 'Could not load Barangay Officials from the database.',
        'danger'
      );
    }
  }

  initOfficialsModule();

  // ==============================================================
  // 13. UTILITY HELPERS
  // ==============================================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function truncate(str, maxLen = 30) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
  }

});