// JavaScript for Brgy360: Navigation, Mobile Menu, Forms & Auth Modal
import {
  getPublicActiveAnnouncements,
  subscribeAnnouncements,
  escapeAnnouncementHtml
} from './announcements-store.js';
import {
  loadBudgetRecords,
  fetchBudgetRecords,
  getPublicApplicableBudgetRecords,
  computeBudgetMetrics,
  formatCurrencyPHP,
  formatPercentValue,
  getAvailableFiscalYears,
  getActiveCategoriesForYear,
  BUDGET_CATEGORIES,
  BUDGET_QUARTERS,
  BUDGET_CATEGORY_COLORS,
  escapeBudgetHtml,
  subscribeBudgetRecords
} from './budget-store.js';
import {
  loadOfficials,
  loadOfficialsFromAPI,
  subscribeOfficials,
  escapeOfficialHtml
} from './officials-store.js';

document.addEventListener('DOMContentLoaded', function () {
  // Navigation & Mobile Menu
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  // Modal & Auth Elements
  const authModal = document.getElementById('authModal');
  const openLoginBtn = document.getElementById('openLoginBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const loginView = document.getElementById('login-view');
  const registerView = document.getElementById('register-view');
  const switchToRegisterBtn = document.getElementById('switchToRegisterBtn');
  const switchToLoginBtn = document.getElementById('switchToLoginBtn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  // Interactive Forms
  const docServiceForm = document.getElementById('docServiceForm');
  const complaintReportForm = document.getElementById('complaintReportForm');
  const projectProposalForm = document.getElementById('projectProposalForm');

  // 1. Mobile Menu Toggle & Navigation Active Highlighting
  const navAnchorLinks = navLinks ? navLinks.querySelectorAll('a:not(.nav-btn-auth)') : [];

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function () {
      navLinks.classList.toggle('active');
    });
  }

  // Handle immediate highlighting when clicking or tapping any nav link
  navAnchorLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      navAnchorLinks.forEach(function (l) {
        l.classList.remove('active');
      });
      link.classList.add('active');

      if (navLinks && navLinks.classList.contains('active')) {
        navLinks.classList.remove('active');
      }
    });
  });

  // Scroll Spy to highlight navigation link based on current section in view
  const sectionIds = ['home', 'about', 'projects', 'services', 'budget', 'reports', 'announcements'];
  const trackedSections = sectionIds
    .map(function (id) { return document.getElementById(id); })
    .filter(function (sec) { return sec !== null; });

  let isScrollDebounced = false;
  function updateNavHighlightOnScroll() {
    if (isScrollDebounced) return;
    isScrollDebounced = true;

    requestAnimationFrame(function () {
      const scrollPos = window.scrollY + 140; // 80px navbar height + offset
      let currentSectionId = '';

      if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 50) {
        currentSectionId = 'announcements';
      } else {
        trackedSections.forEach(function (section) {
          const top = section.offsetTop;
          const height = section.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            currentSectionId = section.getAttribute('id');
          }
        });

        if (!currentSectionId && window.scrollY < 300) {
          currentSectionId = 'home';
        }
      }

      if (currentSectionId) {
        navAnchorLinks.forEach(function (link) {
          const href = link.getAttribute('href');
          if (href === '#' + currentSectionId) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }

      isScrollDebounced = false;
    });
  }

  window.addEventListener('scroll', updateNavHighlightOnScroll, { passive: true });
  updateNavHighlightOnScroll();

  // 2. Authentication Modal & View Toggling
  function clearAuthFeedback() {
    if (!authModal) return;
    const errorSpans = authModal.querySelectorAll('.auth-error-text');
    errorSpans.forEach(function (span) {
      span.textContent = '';
      span.classList.remove('show');
    });
    const invalidInputs = authModal.querySelectorAll('.is-invalid');
    invalidInputs.forEach(function (inp) {
      inp.classList.remove('is-invalid');
    });
    const banners = authModal.querySelectorAll('.auth-feedback-banner');
    banners.forEach(function (b) {
      b.style.display = 'none';
      b.textContent = '';
      b.className = 'auth-feedback-banner';
    });
  }

  function resetPasswordVisibility(scope = document) {
    if (!scope) return;
    scope.querySelectorAll('.password-toggle-btn').forEach(btn => {
      const targetId = btn.getAttribute('data-target');
      const input = targetId ? document.getElementById(targetId) : btn.parentElement.querySelector('input');
      if (input && input.type === 'text') {
        input.type = 'password';
        const showIcon = btn.querySelector('.eye-show');
        const hideIcon = btn.querySelector('.eye-hide');
        if (showIcon) showIcon.style.display = 'block';
        if (hideIcon) hideIcon.style.display = 'none';
        btn.setAttribute('aria-label', 'Show password');
        btn.setAttribute('title', 'Show password');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  function showLoginView() {
    if (loginView) loginView.style.display = 'block';
    if (registerView) registerView.style.display = 'none';
    clearAuthFeedback();
    resetPasswordVisibility(authModal);
  }

  function showRegisterView() {
    if (loginView) loginView.style.display = 'none';
    if (registerView) registerView.style.display = 'block';
    clearAuthFeedback();
    resetPasswordVisibility(authModal);
  }

  function getActiveSessionInfo() {
    const rawSession = localStorage.getItem('brgy360_session');
    const currentRole = localStorage.getItem('currentUserRole');
    if (!rawSession) return { active: false, role: null };
    if (rawSession === 'active') {
      return { active: true, role: currentRole || 'resident' };
    }
    try {
      const parsed = JSON.parse(rawSession);
      if (parsed && typeof parsed === 'object') {
        return { active: true, role: parsed.role || currentRole || 'resident' };
      }
    } catch (e) {}
    return { active: false, role: null };
  }

  function openAuthModal(view, forceOpen = false) {
    const sessionInfo = getActiveSessionInfo();
    if (!forceOpen && sessionInfo.active) {
      window.location.href = sessionInfo.role === 'admin' ? 'admin.html' : 'user.html';
      return;
    }
    if (!authModal) return;
    authModal.classList.add('active');
    document.body.classList.add('auth-modal-open');
    authModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (view === 'register') {
      showRegisterView();
    } else {
      showLoginView();
    }
  }

  function closeAuthModal() {
    if (!authModal) return;
    authModal.classList.remove('active');
    document.body.classList.remove('auth-modal-open');
    authModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = 'auto';
    clearAuthFeedback();
    resetPasswordVisibility(authModal);
  }

  // ==========================================================
  // LOGGED-IN SESSION STATE SYNCHRONIZATION ON PUBLIC VIEW
  // ==========================================================
  function updatePublicViewStateForSession() {
    const sessionInfo = getActiveSessionInfo();
    const isAdminSession = sessionInfo.active && sessionInfo.role === 'admin';
    const isSessionActive = sessionInfo.active && sessionInfo.role === 'resident';

    let currentUser = null;

    if (isSessionActive) {
      try {
        currentUser = JSON.parse(localStorage.getItem('brgy360_user')) || {};
      } catch (e) {
        currentUser = {};
      }
    }

    const userName = currentUser
      ? (currentUser.full_legal_name || currentUser.name || currentUser.email || '')
      : '';

    const userSitio = currentUser ? (currentUser.sitio || currentUser.sitio_purok || '') : '';

    // 1. Update Navbar Auth Slot
    const navAuthSlot = document.getElementById('navAuthSlot');
    if (navAuthSlot) {
      if (isAdminSession) {
        navAuthSlot.innerHTML = `<a href="admin.html" class="nav-btn-auth" id="navAdminConsoleBtn" title="Access Admin Console">Admin Console &rarr;</a>`;
      } else if (isSessionActive) {
        navAuthSlot.innerHTML = `<a href="user.html" class="nav-btn-auth" id="navResidentPortalBtn" title="Access your Resident Portal">Resident Portal &rarr;</a>`;
      } else {
        navAuthSlot.innerHTML = `<a href="#login" class="nav-btn-auth" id="openLoginBtn">Login / Register</a>`;
        const newLoginBtn = document.getElementById('openLoginBtn');
        if (newLoginBtn) {
          newLoginBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openAuthModal('login', true);
          });
        }
      }
    }

    // 2. Update Services Section Banner Subtext
    const servicesBannerSubtext = document.getElementById('servicesBannerSubtext');
    if (servicesBannerSubtext) {
      if (isSessionActive) {
        const sitioLabel = userSitio ? ` • ${userSitio}` : '';
        servicesBannerSubtext.innerHTML = `Welcome back, <strong>${userName}</strong> (Verified Resident${sitioLabel}). Select any document below to view official requirements and submit an application directly via your resident portal.`;
      } else {
        servicesBannerSubtext.textContent = 'Browse the services available at the barangay. Log in or create a verified resident account to submit a request.';
      }
    }

    // 3. Update Report a Concern Section
    const workflowStep1Text = document.getElementById('workflowStep1Text');
    if (workflowStep1Text) {
      if (isSessionActive) {
        const sitioLabel = userSitio ? ` (${userSitio} • Verified)` : ' (Verified)';
        workflowStep1Text.innerHTML = `<strong>Already signed in:</strong> Logged in as ${userName}${sitioLabel}.`;
      } else {
        workflowStep1Text.textContent = 'Create a resident account or sign in to the portal.';
      }
    }

    const concernCtaTitle = document.getElementById('concernCtaTitle');
    const concernCtaDescription = document.getElementById('concernCtaDescription');
    const concernCtaActions = document.getElementById('concernCtaActions');

    if (concernCtaTitle && concernCtaDescription && concernCtaActions) {
      if (isSessionActive) {
        const sitioLabel = userSitio ? ` (${userSitio})` : '';
        concernCtaTitle.innerHTML = `Ready to report a concern, ${userName}?`;
        concernCtaDescription.textContent = `You are logged in with your verified resident account${sitioLabel}. You do not need to sign in again — submit your concern directly with an automated tracking number and monitor site inspection status in real-time.`;
        concernCtaActions.innerHTML = `
          <a href="user.html#reports" class="btn-concern-login" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            <span>Report Concern in Portal &rarr;</span>
          </a>
          <a href="user.html#reports" class="btn-concern-register" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            <span>View My Active Tickets</span>
          </a>
        `;
      } else {
        concernCtaTitle.textContent = 'Ready to report a concern?';
        concernCtaDescription.textContent = "Sign in to your resident account to file a concern and track the barangay's response, or create an account if you are not registered yet.";
        concernCtaActions.innerHTML = `
          <button type="button" class="btn-concern-login" id="btnConcernLogin">Log in</button>
          <button type="button" class="btn-concern-register" id="btnConcernRegister">Create an Account</button>
        `;
        const loginBtn = document.getElementById('btnConcernLogin');
        const regBtn = document.getElementById('btnConcernRegister');
        if (loginBtn) {
          loginBtn.addEventListener('click', function () { openAuthModal('login'); });
        }
        if (regBtn) {
          regBtn.addEventListener('click', function () { openAuthModal('register'); });
        }
      }
    }
  }

  updatePublicViewStateForSession();
  window.addEventListener('storage', updatePublicViewStateForSession);

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeAuthModal);
  }

  if (authModal) {
    authModal.addEventListener('click', function (e) {
      if (e.target === authModal) {
        closeAuthModal();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && authModal && authModal.classList.contains('active')) {
      closeAuthModal();
    }
  });

  // Switch Links between Login & Registration
  if (switchToRegisterBtn) {
    switchToRegisterBtn.addEventListener('click', function (e) {
      e.preventDefault();
      showRegisterView();
    });
  }

  if (switchToLoginBtn) {
    switchToLoginBtn.addEventListener('click', function (e) {
      e.preventDefault();
      showLoginView();
    });
  }

  // Report a Concern CTA Auth Triggers
  const btnConcernLogin = document.getElementById('btnConcernLogin');
  if (btnConcernLogin) {
    btnConcernLogin.addEventListener('click', function () {
      openAuthModal('login');
    });
  }

  const btnConcernRegister = document.getElementById('btnConcernRegister');
  if (btnConcernRegister) {
    btnConcernRegister.addEventListener('click', function () {
      openAuthModal('register');
    });
  }

  // Inline Validation Helpers
  function setFieldError(inputEl, errorEl, message) {
    if (inputEl) inputEl.classList.add('is-invalid');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
    }
  }

  function clearFieldError(inputEl, errorEl) {
    if (inputEl) inputEl.classList.remove('is-invalid');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('show');
    }
  }

  // 3. Client-Side Validation: Login Form
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginEmailError = document.getElementById('loginEmailError');
  const loginPasswordError = document.getElementById('loginPasswordError');
  const loginFeedback = document.getElementById('loginFeedback');

  if (loginEmail) {
    loginEmail.addEventListener('input', function () {
      clearFieldError(loginEmail, loginEmailError);
    });
  }
  if (loginPassword) {
    loginPassword.addEventListener('input', function () {
      clearFieldError(loginPassword, loginPasswordError);
    });
  }

  const footerAdminLink = document.getElementById('footerAdminLink');
  if (footerAdminLink) {
    footerAdminLink.addEventListener('click', function (e) {
      const sessionInfo = getActiveSessionInfo();
      if (sessionInfo.active && sessionInfo.role === 'admin') {
        return;
      }
      e.preventDefault();
      openAuthModal('login', true);
      if (loginFeedback) {
        loginFeedback.className = 'auth-feedback-banner warning';
        loginFeedback.textContent = 'Administrator Sign-In Required: Please enter your administrator email and password to access the Admin Console.';
        loginFeedback.style.display = 'block';
      }
    });
  }

  // Handle direct unauthorized access redirect
  const authUrlParams = new URLSearchParams(window.location.search);
  if (authUrlParams.get('auth') === 'denied') {
    setTimeout(function () {
      openAuthModal('login', true);
      if (loginFeedback) {
        loginFeedback.className = 'auth-feedback-banner error';
        loginFeedback.textContent = 'Access Denied: Admin Privileges Required. Please log in with your administrator credentials.';
        loginFeedback.style.display = 'block';
      }
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }, 200);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      let isValid = true;
      const emailVal = loginEmail ? loginEmail.value.trim() : '';
      const passVal = loginPassword ? loginPassword.value : '';
      const passTrimmed = passVal.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailVal) {
        setFieldError(loginEmail, loginEmailError, 'Email address is required.');
        isValid = false;
      } else if (!emailRegex.test(emailVal)) {
        setFieldError(loginEmail, loginEmailError, 'Please enter a valid email format (e.g. you@example.com).');
        isValid = false;
      }

      if (!passTrimmed) {
        setFieldError(loginPassword, loginPasswordError, 'Password is required.');
        isValid = false;
      }

      if (!isValid) return;

      const emailLower = emailVal.toLowerCase();

      // Check Administrator Login First
      try {
        const adminResp = await fetch('http://localhost:5000/api/auth/admin/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailLower, password: passVal })
        });

        const adminData = await adminResp.json().catch(() => ({}));

        if (adminResp.ok && (adminData.success || adminData.user)) {
          const adminUser = adminData.user || {};
          localStorage.setItem('currentUserRole', 'admin');
          localStorage.setItem('brgy360_session', JSON.stringify({
            role: 'admin',
            id: adminUser.id || adminUser.admin_id || null,
            email: adminUser.email || emailLower,
            name: adminUser.name || 'Barangay Administrator',
            loginTime: new Date().toISOString()
          }));

          if (loginFeedback) {
            loginFeedback.className = 'auth-feedback-banner success';
            loginFeedback.textContent = 'Administrator authenticated! Loading Executive Console...';
            loginFeedback.style.display = 'block';
          }

          setTimeout(function () {
            closeAuthModal();
            loginForm.reset();
            clearAuthFeedback();
            window.location.href = 'admin.html';
          }, 600);
          return;
        }
      } catch (adminErr) {
        // Fall through to resident authentication if admin endpoint is not matched
      }

      // Resident Authentication
      try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailLower, password: passVal })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
          const message = result.message || 'Invalid email or password.';

          if (loginFeedback) {
            loginFeedback.className =
              response.status === 403
                ? 'auth-feedback-banner warning'
                : 'auth-feedback-banner error';

            loginFeedback.textContent = message;
            loginFeedback.style.display = 'block';
          }

          setFieldError(loginPassword, loginPasswordError, message);
          return;
        }

        const residentUser = result.user || {};

        localStorage.setItem('currentUserRole', 'resident');
        localStorage.setItem('brgy360_session', 'active');
        localStorage.setItem('brgy360_user', JSON.stringify(residentUser));

        if (loginFeedback) {
          loginFeedback.className = 'auth-feedback-banner success';
          loginFeedback.textContent =
            `Welcome back, ${residentUser.full_legal_name || residentUser.name || residentUser.email}!`;
          loginFeedback.style.display = 'block';
        }

        setTimeout(function () {
          closeAuthModal();
          loginForm.reset();
          clearAuthFeedback();
          window.location.href = 'user.html';
        }, 600);

      } catch (error) {
        console.error('Login request failed:', error);
        const message = 'Cannot connect to the Brgy360 server. Please ensure the backend service is running.';
        setFieldError(loginPassword, loginPasswordError, message);

        if (loginFeedback) {
          loginFeedback.className = 'auth-feedback-banner error';
          loginFeedback.textContent = message;
          loginFeedback.style.display = 'block';
        }
      }
    });
  }

  // 4. Client-Side Validation & File Management: Registration Form
  const regFullName = document.getElementById('regFullName');
  const regGender = document.getElementById('regGender');
  const regCivilStatus = document.getElementById('regCivilStatus');
  const regMobile = document.getElementById('regMobile');
  const regDob = document.getElementById('regDob');
  const regAge = document.getElementById('regAge');
  const regEmail = document.getElementById('regEmail');
  const regAddress = document.getElementById('regAddress');
  const regSitio = document.getElementById('regSitio');
  const regIdType = document.getElementById('regIdType');
  const regProofType = document.getElementById('regProofType');
  const regPassword = document.getElementById('regPassword');
  const regConfirmPassword = document.getElementById('regConfirmPassword');

  const regFullNameError = document.getElementById('regFullNameError');
  const regGenderError = document.getElementById('regGenderError');
  const regCivilStatusError = document.getElementById('regCivilStatusError');
  const regMobileError = document.getElementById('regMobileError');
  const regDobError = document.getElementById('regDobError');
  const regAgeError = document.getElementById('regAgeError');
  const regEmailError = document.getElementById('regEmailError');
  const regAddressError = document.getElementById('regAddressError');
  const regSitioError = document.getElementById('regSitioError');
  const regIdFileError = document.getElementById('regIdFileError');
  const regProofFileError = document.getElementById('regProofFileError');
  const regPasswordError = document.getElementById('regPasswordError');
  const regConfirmPasswordError = document.getElementById('regConfirmPasswordError');
  const registerFeedback = document.getElementById('registerFeedback');

  // File Upload Elements
  const regIdFile = document.getElementById('regIdFile');
  const regIdDropzone = document.getElementById('regIdDropzone');
  const regIdPreviewCard = document.getElementById('regIdPreviewCard');
  const regIdPreviewThumb = document.getElementById('regIdPreviewThumb');
  const regIdPreviewIcon = document.getElementById('regIdPreviewIcon');
  const regIdFileName = document.getElementById('regIdFileName');
  const regIdFileSize = document.getElementById('regIdFileSize');
  const btnRemoveRegIdFile = document.getElementById('btnRemoveRegIdFile');

  const regProofFile = document.getElementById('regProofFile');
  const regProofDropzone = document.getElementById('regProofDropzone');
  const regProofPreviewCard = document.getElementById('regProofPreviewCard');
  const regProofPreviewThumb = document.getElementById('regProofPreviewThumb');
  const regProofPreviewIcon = document.getElementById('regProofPreviewIcon');
  const regProofFileName = document.getElementById('regProofFileName');
  const regProofFileSize = document.getElementById('regProofFileSize');
  const btnRemoveRegProofFile = document.getElementById('btnRemoveRegProofFile');

  let currentRegIdAttachment = null;
  let currentRegProofAttachment = null;

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function computeAge(dobString) {
    if (!dobString) return '';
    const birth = new Date(dobString);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return isNaN(age) || age < 1 ? '' : age;
  }

  function processIdFile(file) {
    if (!file) return;
    clearFieldError(null, regIdFileError);

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();

    reader.onload = function (e) {
      const dataUrl = e.target.result;
      currentRegIdAttachment = {
        file: file,
        name: file.name,
        size: formatBytes(file.size),
        type: file.type,
        isImage: isImage,
        dataUrl: dataUrl
      };

      if (regIdFileName) regIdFileName.textContent = file.name;
      if (regIdFileSize) regIdFileSize.textContent = formatBytes(file.size);

      if (isImage && regIdPreviewThumb) {
        regIdPreviewThumb.src = dataUrl;
        regIdPreviewThumb.style.display = 'block';
        if (regIdPreviewIcon) regIdPreviewIcon.style.display = 'none';
      } else {
        if (regIdPreviewThumb) regIdPreviewThumb.style.display = 'none';
        if (regIdPreviewIcon) regIdPreviewIcon.style.display = 'flex';
      }

      if (regIdPreviewCard) regIdPreviewCard.style.display = 'flex';
      if (regIdDropzone) regIdDropzone.style.display = 'none';
    };

    reader.readAsDataURL(file);
  }

  if (regIdDropzone && regIdFile) {
    regIdDropzone.addEventListener('click', () => regIdFile.click());
    regIdDropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        regIdFile.click();
      }
    });

    regIdDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      regIdDropzone.classList.add('dragover');
    });

    regIdDropzone.addEventListener('dragleave', () => {
      regIdDropzone.classList.remove('dragover');
    });

    regIdDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      regIdDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processIdFile(e.dataTransfer.files[0]);
      }
    });

    regIdFile.addEventListener('change', function () {
      if (this.files && this.files.length > 0) {
        processIdFile(this.files[0]);
      }
    });
  }

  if (btnRemoveRegIdFile) {
    btnRemoveRegIdFile.addEventListener('click', function () {
      currentRegIdAttachment = null;
      if (regIdFile) regIdFile.value = '';
      if (regIdPreviewCard) regIdPreviewCard.style.display = 'none';
      if (regIdDropzone) regIdDropzone.style.display = 'flex';
    });
  }

  function processProofFile(file) {
    if (!file) return;
    clearFieldError(null, regProofFileError);

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();

    reader.onload = function (e) {
      const dataUrl = e.target.result;
      currentRegProofAttachment = {
        file: file,
        name: file.name,
        size: formatBytes(file.size),
        type: file.type,
        isImage: isImage,
        dataUrl: dataUrl
      };

      if (regProofFileName) regProofFileName.textContent = file.name;
      if (regProofFileSize) regProofFileSize.textContent = formatBytes(file.size);

      if (isImage && regProofPreviewThumb) {
        regProofPreviewThumb.src = dataUrl;
        regProofPreviewThumb.style.display = 'block';
        if (regProofPreviewIcon) regProofPreviewIcon.style.display = 'none';
      } else {
        if (regProofPreviewThumb) regProofPreviewThumb.style.display = 'none';
        if (regProofPreviewIcon) regProofPreviewIcon.style.display = 'flex';
      }

      if (regProofPreviewCard) regProofPreviewCard.style.display = 'flex';
      if (regProofDropzone) regProofDropzone.style.display = 'none';
    };

    reader.readAsDataURL(file);
  }

  if (regProofDropzone && regProofFile) {
    regProofDropzone.addEventListener('click', () => regProofFile.click());
    regProofDropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        regProofFile.click();
      }
    });

    regProofDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      regProofDropzone.classList.add('dragover');
    });

    regProofDropzone.addEventListener('dragleave', () => {
      regProofDropzone.classList.remove('dragover');
    });

    regProofDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      regProofDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processProofFile(e.dataTransfer.files[0]);
      }
    });

    regProofFile.addEventListener('change', function () {
      if (this.files && this.files.length > 0) {
        processProofFile(this.files[0]);
      }
    });
  }

  if (btnRemoveRegProofFile) {
    btnRemoveRegProofFile.addEventListener('click', function () {
      currentRegProofAttachment = null;
      if (regProofFile) regProofFile.value = '';
      if (regProofPreviewCard) regProofPreviewCard.style.display = 'none';
      if (regProofDropzone) regProofDropzone.style.display = 'flex';
    });
  }

  function validatePasswordConfirmation() {
    if (!regConfirmPassword || !regPassword) return true;
    const p1 = regPassword.value;
    const p2 = regConfirmPassword.value;
    if (p2.length > 0 && p1 !== p2) {
      setFieldError(regConfirmPassword, regConfirmPasswordError, 'Passwords do not match.');
      return false;
    } else {
      clearFieldError(regConfirmPassword, regConfirmPasswordError);
      return true;
    }
  }

  if (regConfirmPassword) {
    regConfirmPassword.addEventListener('input', validatePasswordConfirmation);
  }
  if (regPassword) {
    regPassword.addEventListener('input', function () {
      clearFieldError(regPassword, regPasswordError);
      if (regConfirmPassword && regConfirmPassword.value.length > 0) {
        validatePasswordConfirmation();
      }
    });
  }

  if (regDob) {
    const todayStr = new Date().toISOString().split('T')[0];
    regDob.setAttribute('max', todayStr);

    regDob.addEventListener('change', function () {
      if (regDob.value) {
        const calculatedAge = computeAge(regDob.value);
        if (regAge) {
          regAge.value = calculatedAge;
          clearFieldError(regAge, regAgeError);
        }
        clearFieldError(regDob, regDobError);
      }
    });
  }

  if (regFullName) {
    regFullName.addEventListener('input', function () {
      const original = this.value;
      const sanitized = original.replace(/[^a-zA-Z\s]/g, '');
      if (original !== sanitized) {
        this.value = sanitized;
        setFieldError(this, regFullNameError, 'Name must contain letters and spaces only.');
        return;
      }
      if (sanitized.trim().length >= 2) {
        clearFieldError(this, regFullNameError);
      }
    });
  }

  if (regMobile) {
    regMobile.addEventListener('input', function () {
      const original = this.value;
      const sanitized = original.replace(/\D/g, '');
      if (original !== sanitized) {
        this.value = sanitized;
        setFieldError(this, regMobileError, 'Contact number must contain numeric digits only.');
        return;
      }
      if (sanitized.length >= 7 && sanitized.length <= 11) {
        clearFieldError(this, regMobileError);
      }
    });
  }

  if (regAge) {
    regAge.addEventListener('input', function () {
      const original = this.value;
      const sanitized = original.replace(/\D/g, '');
      if (original !== sanitized) {
        this.value = sanitized;
        setFieldError(this, regAgeError, 'Age must contain numeric digits only.');
        return;
      }
      const num = parseInt(sanitized, 10);
      if (!isNaN(num) && num >= 1 && num <= 120) {
        clearFieldError(this, regAgeError);
      }
    });
  }

  if (regEmail) {
    let emailCheckTimer;
    let emailCheckRequest = 0;

    regEmail.addEventListener('input', function () {
      const val = this.value.trim();
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      clearTimeout(emailCheckTimer);
      const currentRequest = ++emailCheckRequest;

      if (!val || !emailRegex.test(val)) {
        clearFieldError(this, regEmailError);
        return;
      }

      emailCheckTimer = setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:5000/api/auth/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: val })
          });

          const result = await response.json();
          if (currentRequest !== emailCheckRequest) return;

          if (!response.ok) return;

          if (result.available === false) {
            regEmailError.textContent = 'An account with this email already exists.';
            regEmailError.style.display = 'block';
            regEmailError.style.color = '#ef4444';
            regEmail.classList.add('is-invalid');
          } else {
            regEmailError.textContent = '';
            regEmailError.style.display = 'none';
            regEmail.classList.remove('is-invalid');
          }
        } catch (error) {
          console.error('Email availability check error:', error);
        }
      }, 500);
    });
  }

  [
    [regGender, regGenderError],
    [regCivilStatus, regCivilStatusError],
    [regAddress, regAddressError],
    [regSitio, regSitioError]
  ].forEach(function (pair) {
    const el = pair[0];
    const err = pair[1];
    if (el) {
      el.addEventListener('input', function () { clearFieldError(el, err); });
      el.addEventListener('change', function () { clearFieldError(el, err); });
    }
  });

  // Post-Registration Pending Verification Modal Handlers
  const regPendingModal = document.getElementById('regPendingModal');
  const summaryPendingName = document.getElementById('summaryPendingName');
  const summaryPendingEmail = document.getElementById('summaryPendingEmail');
  const summaryPendingGenderCivil = document.getElementById('summaryPendingGenderCivil');
  const summaryPendingIdType = document.getElementById('summaryPendingIdType');
  const summaryPendingProofType = document.getElementById('summaryPendingProofType');
  const btnClosePendingModal = document.getElementById('btnClosePendingModal');
  const btnPendingToLogin = document.getElementById('btnPendingToLogin');
  const btnPendingToAdmin = document.getElementById('btnPendingToAdmin');

  function closePendingModal() {
    if (regPendingModal) regPendingModal.classList.remove('active');
  }

  if (btnClosePendingModal) btnClosePendingModal.addEventListener('click', closePendingModal);
  if (btnPendingToLogin) {
    btnPendingToLogin.addEventListener('click', function () {
      closePendingModal();
      openAuthModal('login', true);
    });
  }
  if (btnPendingToAdmin) {
    btnPendingToAdmin.addEventListener('click', function () {
      closePendingModal();
      window.location.href = 'admin.html';
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      let isValid = true;
      let firstInvalidField = null;

      function markInvalid(inputEl, errorEl, message) {
        setFieldError(inputEl, errorEl, message);
        if (!firstInvalidField && inputEl) {
          firstInvalidField = inputEl;
        }
        isValid = false;
      }

      const nameVal = regFullName ? regFullName.value.trim() : '';
      const nameRegex = /^[a-zA-Z\s]+$/;
      if (!nameVal) {
        markInvalid(regFullName, regFullNameError, 'Full legal name is required.');
      } else if (!nameRegex.test(nameVal)) {
        markInvalid(regFullName, regFullNameError, 'Name must contain letters and spaces only.');
      } else if (nameVal.length < 2) {
        markInvalid(regFullName, regFullNameError, 'Name must be at least 2 characters long.');
      } else {
        clearFieldError(regFullName, regFullNameError);
      }

      const genderVal = regGender ? regGender.value : '';
      if (!genderVal) {
        markInvalid(regGender, regGenderError, 'Please select your gender.');
      } else {
        clearFieldError(regGender, regGenderError);
      }

      const civilVal = regCivilStatus ? regCivilStatus.value : '';
      if (!civilVal) {
        markInvalid(regCivilStatus, regCivilStatusError, 'Please select your civil status.');
      } else {
        clearFieldError(regCivilStatus, regCivilStatusError);
      }

      const dobVal = regDob ? regDob.value : '';
      if (!dobVal) {
        markInvalid(regDob, regDobError, 'Date of birth is required.');
      } else {
        const d = new Date(dobVal);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (isNaN(d.getTime()) || d > today || d.getFullYear() < 1900) {
          markInvalid(regDob, regDobError, 'Please enter a valid date of birth in the past.');
        } else {
          clearFieldError(regDob, regDobError);
        }
      }

      const ageVal = regAge ? regAge.value.trim() : '';
      const digitsRegex = /^\d+$/;
      if (!ageVal) {
        markInvalid(regAge, regAgeError, 'Age is required.');
      } else if (!digitsRegex.test(ageVal)) {
        markInvalid(regAge, regAgeError, 'Age must contain numeric digits only.');
      } else {
        const ageNum = parseInt(ageVal, 10);
        if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
          markInvalid(regAge, regAgeError, 'Please enter a valid age between 1 and 120.');
        } else {
          clearFieldError(regAge, regAgeError);
        }
      }

      const mobileVal = regMobile ? regMobile.value.trim() : '';
      if (!mobileVal) {
        markInvalid(regMobile, regMobileError, 'Contact number is required.');
      } else if (!digitsRegex.test(mobileVal)) {
        markInvalid(regMobile, regMobileError, 'Contact number must contain numeric digits only.');
      } else if (mobileVal.length < 7 || mobileVal.length > 11) {
        markInvalid(regMobile, regMobileError, 'Contact number must be between 7 and 11 numeric digits.');
      } else {
        clearFieldError(regMobile, regMobileError);
      }

      const emailVal = regEmail ? regEmail.value.trim() : '';
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailVal) {
        markInvalid(regEmail, regEmailError, 'Email address is required.');
      } else if (!emailRegex.test(emailVal)) {
        markInvalid(regEmail, regEmailError, 'Please enter a valid email address.');
      } else {
        clearFieldError(regEmail, regEmailError);
      }

      const addressVal = regAddress ? regAddress.value.trim() : '';
      if (!addressVal) {
        markInvalid(regAddress, regAddressError, 'Address is required.');
      } else if (addressVal.length < 5) {
        markInvalid(regAddress, regAddressError, 'Address must be at least 5 characters long.');
      } else {
        clearFieldError(regAddress, regAddressError);
      }

      const sitioVal = regSitio ? regSitio.value : '';
      if (!sitioVal) {
        markInvalid(regSitio, regSitioError, 'Sitio / Purok is required.');
      } else {
        clearFieldError(regSitio, regSitioError);
      }

      const idTypeVal = regIdType ? regIdType.value : 'Philippine National ID (PhilID)';
      if (!currentRegIdAttachment) {
        setFieldError(null, regIdFileError, 'Please submit your government ID photo or scanned attachment.');
        if (regIdDropzone) {
          regIdDropzone.style.borderColor = '#ef4444';
          if (!firstInvalidField) firstInvalidField = regIdDropzone;
        }
        isValid = false;
      } else {
        clearFieldError(null, regIdFileError);
        if (regIdDropzone) regIdDropzone.style.borderColor = '';
      }

      const proofTypeVal = regProofType ? regProofType.value : '';

      const passVal = regPassword ? regPassword.value : '';
      if (!passVal) {
        markInvalid(regPassword, regPasswordError, 'Password is required.');
      } else if (passVal.length < 8) {
        markInvalid(regPassword, regPasswordError, 'Password must be at least 8 characters long.');
      } else {
        clearFieldError(regPassword, regPasswordError);
      }

      const confirmVal = regConfirmPassword ? regConfirmPassword.value : '';
      if (!confirmVal) {
        markInvalid(regConfirmPassword, regConfirmPasswordError, 'Please confirm your password.');
      } else if (passVal !== confirmVal) {
        markInvalid(regConfirmPassword, regConfirmPasswordError, 'Passwords do not match.');
      } else {
        clearFieldError(regConfirmPassword, regConfirmPasswordError);
      }

      if (!isValid) {
        if (firstInvalidField) {
          firstInvalidField.focus();
          firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      const formData = new FormData();
      formData.append("full_legal_name", nameVal);
      formData.append("gender", genderVal);
      formData.append("civil_status", civilVal);
      formData.append("date_of_birth", dobVal);
      formData.append("mobile_number", mobileVal);
      formData.append("email", emailVal.trim().toLowerCase());
      formData.append("address", addressVal);
      formData.append("sitio_purok", sitioVal);
      formData.append("password", passVal);
      formData.append("id_type", idTypeVal);
      formData.append("residency_proof_type", proofTypeVal || "No Proof of Residency");

      if (currentRegIdAttachment && currentRegIdAttachment.file) {
        formData.append("id_document", currentRegIdAttachment.file);
      }

      if (currentRegProofAttachment && currentRegProofAttachment.file) {
        formData.append("residency_proof_document", currentRegProofAttachment.file);
      }

      try {
        const response = await fetch("http://localhost:5000/api/auth/register", {
          method: "POST",
          body: formData
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Registration failed.");
        }

        if (summaryPendingName) summaryPendingName.textContent = nameVal;
        if (summaryPendingEmail) summaryPendingEmail.textContent = emailVal.trim().toLowerCase();
        if (summaryPendingGenderCivil) summaryPendingGenderCivil.textContent = `${genderVal} · ${civilVal}`;
        if (summaryPendingIdType) summaryPendingIdType.textContent = idTypeVal;
        if (summaryPendingProofType) summaryPendingProofType.textContent = proofTypeVal || "No Proof of Residency";

        if (regPendingModal) regPendingModal.classList.add("active");
        closeAuthModal();

        registerForm.reset();
        currentRegIdAttachment = null;
        currentRegProofAttachment = null;

        if (regIdPreviewCard) regIdPreviewCard.style.display = 'none';
        if (regIdDropzone) regIdDropzone.style.display = 'flex';
        if (regProofPreviewCard) regProofPreviewCard.style.display = 'none';
        if (regProofDropzone) regProofDropzone.style.display = 'flex';
        clearAuthFeedback();

      } catch (error) {
        console.error("Registration error:", error);
        if (registerFeedback) {
          registerFeedback.textContent = error.message;
          registerFeedback.style.color = '#ef4444';
          registerFeedback.style.display = 'block';
        }
      }
    });
  }

  function showPublicToast(title, message, type = 'success') {
    let toastContainer = document.getElementById('publicToastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'publicToastContainer';
      toastContainer.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; max-width: 400px; pointer-events: none;';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.style.cssText = 'background: #ffffff; color: #0f172a; padding: 14px 18px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border-left: 4px solid #0d47a1; font-family: "Poppins", sans-serif; pointer-events: auto; display: flex; flex-direction: column; gap: 4px; animation: slideInToast 0.3s ease;';
    if (type === 'success') toast.style.borderLeftColor = '#16a34a';
    if (type === 'warning') toast.style.borderLeftColor = '#d97706';

    toast.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <strong style="font-size: 14px; font-weight: 700; color: #0f172a;">${title}</strong>
        <button type="button" style="background: none; border: none; font-size: 18px; line-height: 1; cursor: pointer; color: #94a3b8;">&times;</button>
      </div>
      <p style="margin: 0; font-size: 12.5px; color: #475569; line-height: 1.5; white-space: pre-line;">${message}</p>
    `;

    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => toast.remove());

    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  }

  // 5. Document Request Form Handler
  if (docServiceForm) {
    docServiceForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const docType = document.getElementById('docType').value;
      const refNumber = 'BRGY-' + Math.floor(100000 + Math.random() * 900000);
      showPublicToast(
        'Request Submitted Successfully',
        'Salamat! Your request for ' + docType + ' has been submitted.\nReference Number: ' + refNumber + '\nPlease claim it at the Barangay Hall within 1-2 business days.',
        'success'
      );
      docServiceForm.reset();
    });
  }

  // 6. Reports and Complaints Form Handler
  if (complaintReportForm) {
    complaintReportForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const reportType = document.getElementById('reportCategory').value;
      const ticketId = 'TCK-' + Math.floor(1000 + Math.random() * 9000);
      showPublicToast(
        'Report Logged Securely',
        'Your report has been securely recorded.\nIncident Ticket ID: ' + ticketId + '\nCategory: ' + reportType + '\nThe Barangay Council and Tanods have been notified.',
        'success'
      );
      complaintReportForm.reset();
    });
  }

  // 7. Citizen Project Proposal Form Handler
  if (projectProposalForm) {
    projectProposalForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const title = (document.getElementById('proposalTitle')?.value || '').trim() || 'Citizen Community Proposal';
      const proposalCode = 'PROP-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900);

      try {
        const stored = JSON.parse(localStorage.getItem('brgy360_proposals') || '[]');
        stored.unshift({
          id: proposalCode,
          ref: proposalCode,
          title: title,
          category: 'Citizen Initiative',
          dateFiled: new Date().toISOString().split('T')[0],
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          status: 'Pending'
        });
        localStorage.setItem('brgy360_proposals', JSON.stringify(stored));
        window.dispatchEvent(new Event('storage'));
      } catch (err) {}

      showPublicToast(
        'Project Proposal Received',
        'Thank you! Your project proposal for "' + title + '" has been received.\nTracking ID: ' + proposalCode + '\nIt will be reviewed during the Barangay Development Council planning session.',
        'success'
      );
      projectProposalForm.reset();
    });
  }

  // 8. Hero Background Slideshow
  const heroSlides = document.querySelectorAll('.hero-slide');
  let currentSlide = 0;

  if (heroSlides.length > 1) {
    setInterval(function () {
      heroSlides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % heroSlides.length;
      heroSlides[currentSlide].classList.add('active');
    }, 3000);
  }

  // 9. Projects Dynamic Portfolio Sync
  const projectSearchInput = document.getElementById('projectSearchInput');
  const projectStatusFilter = document.getElementById('projectStatusFilter');
  const projectYearFilter = document.getElementById('projectYearFilter');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const emptyStateResetBtn = document.getElementById('emptyStateResetBtn');
  const projectsGrid = document.getElementById('projectsGrid');
  const emptyState = document.getElementById('projectsEmptyState');
  const visibleProjectsCount = document.getElementById('visibleProjectsCount');
  const totalProjectsCount = document.getElementById('totalProjectsCount');

  function escapePublicHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clampPublicProgress(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num)));
  }

  let publicTrendChartInstance = null;

  function computeYearCompletionMetric(projectsList, targetYear) {
    const yrProjects = projectsList.filter(function (p) { return String(p.year) === String(targetYear); });
    if (yrProjects.length === 0) return 0;
    return Math.round(
      yrProjects.reduce(function (sum, p) { return sum + clampPublicProgress(p.progress); }, 0) / yrProjects.length
    );
  }

  function updatePublicProjectKPIsAndTrend(projectsList) {
    const total = projectsList.length;
    const planningCount = projectsList.filter(function (p) { return p.status === 'planning'; }).length;
    const ongoingCount = projectsList.filter(function (p) { return p.status === 'ongoing'; }).length;
    const completedCount = projectsList.filter(function (p) { return p.status === 'completed'; }).length;
    const delayedCount = projectsList.filter(function (p) { return p.status === 'delayed'; }).length;
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    const elPlanning = document.getElementById('kpiPlanning');
    const elOngoing = document.getElementById('kpiOngoing');
    const elCompleted = document.getElementById('kpiCompleted');
    const elDelayed = document.getElementById('kpiDelayed');
    const elRate = document.getElementById('kpiRate');
    const elRateSub = document.getElementById('kpiRateSubtext');

    if (elPlanning) elPlanning.textContent = String(planningCount);
    if (elOngoing) elOngoing.textContent = String(ongoingCount);
    if (elCompleted) elCompleted.textContent = String(completedCount);
    if (elDelayed) elDelayed.textContent = String(delayedCount);
    if (elRate) elRate.textContent = completionRate + '%';
    if (elRateSub) {
      elRateSub.textContent = completedCount + ' of ' + total + ' project' + (total === 1 ? '' : 's') + ' delivered';
    }
    if (totalProjectsCount) {
      totalProjectsCount.textContent = String(total);
    }

    if (publicTrendChartInstance) {
      const currentYr = new Date().getFullYear();
      const ratePrev = computeYearCompletionMetric(projectsList, String(currentYr - 1));
      const rateCurr = computeYearCompletionMetric(projectsList, String(currentYr));
      publicTrendChartInstance.data.datasets[0].data = [ratePrev, rateCurr];
      publicTrendChartInstance.update();
    }
  }

  function formatStatusBadgeLabel(status) {
    if (status === 'completed') return 'Completed';
    if (status === 'ongoing') return 'Ongoing';
    if (status === 'delayed') return 'Delayed';
    return 'Planning';
  }

  function applyPublicProjectFilters() {
    if (!projectsGrid) return;
    const projectCards = Array.from(projectsGrid.querySelectorAll('.project-card'));
    const searchQuery = (projectSearchInput ? projectSearchInput.value : '').trim().toLowerCase();
    const statusFilter = projectStatusFilter ? projectStatusFilter.value.toLowerCase() : 'all';
    const yearFilter = projectYearFilter ? projectYearFilter.value.toLowerCase() : 'all';

    if (clearSearchBtn) {
      clearSearchBtn.style.display = searchQuery.length > 0 ? 'flex' : 'none';
    }

    const hasActiveFilters = searchQuery.length > 0 || statusFilter !== 'all' || yearFilter !== 'all';
    if (resetFiltersBtn) {
      resetFiltersBtn.style.display = hasActiveFilters ? 'inline-block' : 'none';
    }

    let visibleCount = 0;

    projectCards.forEach(function (card) {
      const cardStatus = (card.getAttribute('data-status') || '').toLowerCase();
      const cardYear = (card.getAttribute('data-year') || '').toLowerCase();
      const cardText = card.textContent.toLowerCase();

      const matchesStatus = statusFilter === 'all' || cardStatus === statusFilter;
      const matchesYear = yearFilter === 'all' || cardYear === yearFilter;
      const matchesSearch = searchQuery === '' || cardText.includes(searchQuery);

      if (matchesStatus && matchesYear && matchesSearch) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    if (visibleProjectsCount) {
      visibleProjectsCount.textContent = String(visibleCount);
    }

    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  async function renderPublicProjectsPortfolio() {
    if (!projectsGrid) return;
    let projectsList = [];

    try {
      const response = await fetch('http://localhost:5000/api/projects/public', { method: 'GET' });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load projects.');
      }

      projectsList = (data.projects || []).map(project => {
        const createdDate = project.created_at ? new Date(project.created_at) : null;
        const year = createdDate && !isNaN(createdDate.getTime())
          ? String(createdDate.getFullYear())
          : String(new Date().getFullYear());

        return {
          id: project.project_id,
          code: `PRJ-${year}-${String(project.project_id).padStart(2, '0')}`,
          title: project.project_title,
          description: project.project_scope,
          location: project.location_purok || 'Barangay Pallocan West',
          timeline: createdDate && !isNaN(createdDate.getTime())
            ? `Created ${createdDate.toLocaleDateString('en-PH')}`
            : 'Not specified',
          year: year,
          budget: '₱' + Number(project.allocated_budget || 0).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }),
          progress: Number(project.progress_percentage || 0),
          status: String(project.project_status || 'planning').toLowerCase()
        };
      });

    } catch (error) {
      console.warn('Projects fallback notice:', error);
      projectsGrid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 24px;">No active public infrastructure projects recorded.</p>';
      return;
    }

    if (projectYearFilter) {
      const currentYearVal = projectYearFilter.value || 'all';
      const yearsSet = new Set(['2026', '2025']);
      projectsList.forEach(function (p) {
        if (p.year) yearsSet.add(String(p.year));
      });
      const sortedYears = Array.from(yearsSet).sort(function (a, b) { return b.localeCompare(a); });
      projectYearFilter.innerHTML = '<option value="all">All Years</option>' +
        sortedYears.map(function (yr) {
          return '<option value="' + escapePublicHtml(yr) + '">' + escapePublicHtml(yr) + '</option>';
        }).join('');
      if (currentYearVal === 'all' || yearsSet.has(currentYearVal)) {
        projectYearFilter.value = currentYearVal;
      }
    }

    projectsGrid.innerHTML = projectsList.map(function (p) {
      const statusKey = p.status;
      const statusLabel = formatStatusBadgeLabel(statusKey);
      const pct = clampPublicProgress(p.progress);

      return `
        <article class="project-card card-${escapePublicHtml(statusKey)}" data-status="${escapePublicHtml(statusKey)}" data-year="${escapePublicHtml(p.year)}" data-code="${escapePublicHtml(p.code || '')}">
          <div>
            <div class="project-card-top">
              <span class="status-badge-pill">
                <span class="status-dot"></span>
                ${escapePublicHtml(statusLabel)}
              </span>
              <span class="project-year-pill">${escapePublicHtml(p.year)}</span>
            </div>

            <div class="project-card-body">
              <h3 class="project-title">${escapePublicHtml(p.title)}</h3>
              <p class="project-desc">${escapePublicHtml(p.description)}</p>
            </div>

            <ul class="project-details-list">
              <li class="detail-item">
                <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${escapePublicHtml(p.location)}</span>
              </li>
              <li class="detail-item">
                <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>${escapePublicHtml(p.timeline)}</span>
              </li>
            </ul>

            <div class="project-budget-row">
              <span class="budget-label">Budget:</span>
              <span class="budget-amount">${escapePublicHtml(p.budget)}</span>
            </div>
          </div>

          <div class="project-progress-wrap">
            <div class="progress-header">
              <span>Progress</span>
              <span class="progress-percentage">${pct}%</span>
            </div>
            <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    updatePublicProjectKPIsAndTrend(projectsList);
    applyPublicProjectFilters();
  }

  if (projectsGrid) {
    if (projectSearchInput) projectSearchInput.addEventListener('input', applyPublicProjectFilters);
    if (projectStatusFilter) projectStatusFilter.addEventListener('change', applyPublicProjectFilters);
    if (projectYearFilter) projectYearFilter.addEventListener('change', applyPublicProjectFilters);

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', function () {
        projectSearchInput.value = '';
        projectSearchInput.focus();
        applyPublicProjectFilters();
      });
    }

    function resetAllFilters() {
      if (projectSearchInput) projectSearchInput.value = '';
      if (projectStatusFilter) projectStatusFilter.value = 'all';
      if (projectYearFilter) projectYearFilter.value = 'all';
      applyPublicProjectFilters();
    }

    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetAllFilters);
    if (emptyStateResetBtn) emptyStateResetBtn.addEventListener('click', resetAllFilters);

    renderPublicProjectsPortfolio();
  }

  // 10. Propose a Project Modal Logic
  const proposeModal = document.getElementById('proposeProjectModal');
  const openProposeModalBtn = document.getElementById('openProposeModalBtn');
  const closeProposeModalBtn = document.getElementById('closeProposeModalBtn');
  const cancelProposeModalBtn = document.getElementById('cancelProposeModalBtn');
  const dismissSuccessModalBtn = document.getElementById('dismissSuccessModalBtn');
  const modalProposeForm = document.getElementById('modalProposeForm');
  const modalSuccessState = document.getElementById('modalSuccessState');
  const successTrackingId = document.getElementById('successTrackingId');

  function openProposeModal() {
    if (!proposeModal) return;
    proposeModal.style.display = 'flex';
    requestAnimationFrame(function () {
      proposeModal.classList.add('active', 'is-open');
      proposeModal.setAttribute('aria-hidden', 'false');
    });
    const firstInput = document.getElementById('modalProjectName');
    if (firstInput) {
      setTimeout(function () { firstInput.focus(); }, 100);
    }
  }

  function closeProposeModal() {
    if (!proposeModal) return;
    if (proposeModal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    proposeModal.classList.remove('active', 'is-open');
    proposeModal.setAttribute('aria-hidden', 'true');
    setTimeout(function () {
      proposeModal.style.display = 'none';
      if (modalProposeForm) modalProposeForm.style.display = 'block';
      if (modalSuccessState) modalSuccessState.style.display = 'none';
    }, 250);
  }

  if (openProposeModalBtn) openProposeModalBtn.addEventListener('click', openProposeModal);
  if (closeProposeModalBtn) closeProposeModalBtn.addEventListener('click', closeProposeModal);
  if (cancelProposeModalBtn) cancelProposeModalBtn.addEventListener('click', closeProposeModal);

  if (dismissSuccessModalBtn) {
    dismissSuccessModalBtn.addEventListener('click', function () {
      closeProposeModal();
      if (modalProposeForm) modalProposeForm.reset();
    });
  }

  if (proposeModal) {
    proposeModal.addEventListener('click', function (e) {
      if (e.target === proposeModal) closeProposeModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && proposeModal && (proposeModal.classList.contains('active') || proposeModal.classList.contains('is-open'))) {
      closeProposeModal();
    }
  });

  // Modal Form Validation & Submission
  if (modalProposeForm) {
    const propNameEl = document.getElementById('modalProponentName');
    const propPhoneEl = document.getElementById('modalProponentPhone');
    const propBudgetEl = document.getElementById('modalProjectBudget');

    if (propNameEl) {
      propNameEl.addEventListener('input', function () {
        const original = this.value;
        const sanitized = original.replace(/[^a-zA-Z\s]/g, '');
        if (original !== sanitized) this.value = sanitized;
      });
    }

    if (propPhoneEl) {
      propPhoneEl.addEventListener('input', function () {
        const original = this.value;
        const sanitized = original.replace(/\D/g, '');
        if (original !== sanitized) this.value = sanitized;
      });
    }

    if (propBudgetEl) {
      propBudgetEl.addEventListener('input', function () {
        const original = this.value;
        const sanitized = original.replace(/\D/g, '');
        if (original !== sanitized) this.value = sanitized;
      });
    }

    modalProposeForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const submitButton = document.getElementById('submitProposalBtn');
      const fileInput = document.getElementById('modalProjectFile');

      const formData = new FormData();
      formData.append('projectTitle', document.getElementById('modalProjectName')?.value.trim() || '');
      formData.append('sectorCategory', document.getElementById('modalProjectCategory')?.value || '');
      formData.append('locationSitio', document.getElementById('modalProjectLocation')?.value || '');
      formData.append('estimatedBudget', document.getElementById('modalProjectBudget')?.value || '');
      formData.append('proposedTimeline', document.getElementById('modalProjectStartDate')?.value || '');
      formData.append('rationale', document.getElementById('modalProjectDescription')?.value.trim() || '');
      formData.append('fullName', document.getElementById('modalProponentName')?.value.trim() || '');
      formData.append('email', document.getElementById('modalProponentEmail')?.value.trim() || '');
      formData.append('phone', document.getElementById('modalProponentPhone')?.value.trim() || '');
      formData.append('submissionType', 'guest');

      if (fileInput && fileInput.files.length > 0) {
        formData.append('supportingDocument', fileInput.files[0]);
      }

      try {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.querySelector('span').textContent = 'Submitting...';
        }

        const response = await fetch('http://localhost:5000/api/proposals', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to submit your proposal.');
        }

        if (successTrackingId) {
          successTrackingId.textContent = result.trackingCode;
        }

        try {
          const raw = localStorage.getItem('brgy360_proposals');
          const list = raw ? JSON.parse(raw) : [];
          const newProp = {
            id: result.trackingCode || `PROP-${Date.now()}`,
            ref: result.trackingCode || `PROP-${Date.now()}`,
            proposalId: result.proposalId,
            title: document.getElementById('modalProjectTitle')?.value.trim() || 'Community Proposal',
            category: document.getElementById('modalProjectCategory')?.value || 'Infrastructure',
            location: document.getElementById('modalProjectSitio')?.value || 'Sitio Ibaba',
            sitio: document.getElementById('modalProjectSitio')?.value || 'Sitio Ibaba',
            budget: parseFloat(document.getElementById('modalProjectBudget')?.value) || 0,
            timeline: document.getElementById('modalProjectTimeline')?.value.trim() || 'Q1 2027',
            rationale: document.getElementById('modalProjectRationale')?.value.trim() || '',
            description: document.getElementById('modalProjectRationale')?.value.trim() || '',
            proponent: document.getElementById('modalProponentName')?.value.trim() || 'Resident',
            email: document.getElementById('modalProponentEmail')?.value.trim() || '',
            status: 'Pending',
            dateFiled: new Date().toISOString().split('T')[0],
            date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
          };
          list.unshift(newProp);
          localStorage.setItem('brgy360_proposals', JSON.stringify(list));
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('brgy360_proposals_changed', { detail: list }));
        } catch (storageErr) {
          console.warn('Storage sync warning:', storageErr);
        }

        modalProposeForm.style.display = 'none';
        if (modalSuccessState) modalSuccessState.style.display = 'block';
        modalProposeForm.reset();

      } catch (error) {
        console.error('Proposal submission error:', error);
        alert(error.message || 'Unable to submit your proposal. Please try again.');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.querySelector('span').textContent = 'Submit Proposal';
        }
      }
    });
  }

  // 11. Chart.js Trend Line Chart
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Poppins', sans-serif";
  }

  const chartCanvas = document.getElementById('projectTrendChart');
  if (chartCanvas && typeof Chart !== 'undefined') {
    publicTrendChartInstance = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: ['FY 2025', 'FY 2026 (Active Cycle)'],
        datasets: [{
          label: 'Average Progress / Completion',
          data: [0, 0],
          borderColor: '#0d47a1',
          backgroundColor: 'rgba(13, 71, 161, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#0d47a1',
          pointBorderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 25,
              callback: function (val) { return val + '%'; }
            },
            grid: { color: '#e2e8f0' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // 12. SECTION 2: BARANGAY SERVICES DATA & DYNAMIC RENDERING
  const services = [
    {
      id: 'barangay-clearance',
      title: 'Barangay Clearance',
      category: 'CLEARANCE',
      description: 'Official clearance certifying residency, good moral standing, and no pending derogatory record in the barangay.',
      processingTime: '1 business day',
      fee: '₱50.00 (Free for First-Time Jobseekers)',
      requirements: [
        'Valid Government-issued ID',
        'Recent 1x1 or 2x2 ID Photo',
        'Current year Community Tax Certificate (Cedula)',
        'Purok Leader endorsement or proof of residency'
      ],
      processingInfo: [
        'Submission: Apply online via resident portal or at Barangay Hall Window 1.',
        'Record Verification: Verification against Registry of Barangay Inhabitants (RBI).',
        'Approval: Certified by Barangay Secretary and signed by Punong Barangay.',
        'Release: Affixed with official dry seal.'
      ]
    },
    {
      id: 'certificate-of-residency',
      title: 'Certificate of Residency',
      category: 'CERTIFICATION',
      description: 'Authenticates continuous, active residency of a citizen within their designated purok.',
      processingTime: 'Same day (within 4 hours)',
      fee: '₱50.00',
      requirements: [
        'Any valid ID bearing current local address',
        'Minimum of six (6) months continuous residence in the barangay',
        'Purok Leader Certification'
      ],
      processingInfo: [
        'Identity & Purok cross-referenced with census records.',
        'Preparation and signing of certified document.',
        'Release upon presentation of claiming slip.'
      ]
    },
    {
      id: 'certificate-of-indigency',
      title: 'Certificate of Indigency',
      category: 'ASSISTANCE',
      description: 'Issued to bonafide low-income and indigent residents seeking medical, financial, or educational assistance.',
      processingTime: 'Same day (Priority Desk)',
      fee: 'Free of Charge',
      requirements: [
        'Valid Government ID or Student ID',
        'Endorsement from Purok President confirming indigent family status',
        'Supporting proof of need (Medical abstract, hospital statement, or school notice)'
      ],
      processingInfo: [
        'Assessment by the Barangay Social Services Officer.',
        'Expedited verification for urgent medical or financial emergencies.',
        'Endorsed by the Punong Barangay free of charge.'
      ]
    },
    {
      id: 'barangay-business-clearance',
      title: 'Barangay Business Clearance',
      category: 'BUSINESS PERMIT',
      description: 'Prerequisite clearance for commercial enterprises and annual renewal of business operations.',
      processingTime: '2 business days',
      fee: '₱150.00 – ₱500.00',
      requirements: [
        'DTI Business Name Registration or SEC Articles',
        'Lease Agreement or Proof of Property Ownership',
        'Barangay Sanitary Clearance (food handling)'
      ],
      processingInfo: [
        'Site inspection by Barangay Committee on Commerce.',
        'Assessment based on local municipal revenue schedules.',
        'Issuance of official business clearance plaque.'
      ]
    },
    {
      id: 'first-time-jobseeker',
      title: 'First-Time Jobseeker Assistance (RA 11261)',
      category: 'YOUTH & EMPLOYMENT',
      description: 'Statutory certification exempting first-time jobseekers from paying government fees.',
      processingTime: '1 business day',
      fee: 'Free of Charge',
      requirements: [
        'Duly administered Oath of Undertaking',
        'Diploma, Certificate of Graduation, or School Certification',
        'One (1) valid ID'
      ],
      processingInfo: [
        'Validation of first-time worker status.',
        'Issuance of certification valid for one (1) year.'
      ]
    },
    {
      id: 'katarungang-pambarangay',
      title: 'Katarungang Pambarangay Conciliation',
      category: 'LEGAL & CONCILIATION',
      description: 'Barangay peace-building mediation and dispute conciliation handled by the Lupong Tagapamayapa.',
      processingTime: '1–3 sessions',
      fee: 'Free of Charge',
      requirements: [
        'Formal blotter incident statement',
        'Valid IDs of complainant and respondent',
        'Relevant supporting documents'
      ],
      processingInfo: [
        'Issuance of summons to both parties within 3 business days.',
        'Mediation conference in the Barangay Session Hall.'
      ]
    }
  ];

  const servicesGridView = document.getElementById('services-grid-view');
  const serviceDetailView = document.getElementById('service-detail-view');
  const servicesGridContainer = document.getElementById('servicesGridContainer');

  function renderServicesGrid() {
    if (!servicesGridContainer) return;
    servicesGridContainer.innerHTML = services.map(function (s) {
      return `
        <article class="service-card" data-service-id="${s.id}">
          <div>
            <div class="service-card-header">
              <div class="service-icon-box" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <div class="service-title-group">
                <span class="service-category-tag">${s.category}</span>
                <h3 class="service-card-title">${s.title}</h3>
              </div>
            </div>
            <p class="service-card-desc">${s.description}</p>
          </div>

          <div>
            <div class="service-meta-row">
              <div class="service-meta-item">
                <svg class="service-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>${s.processingTime}</span>
              </div>
              <span class="service-meta-divider">•</span>
              <div class="service-meta-item">
                <span>${s.fee}</span>
              </div>
            </div>

            <button type="button" class="service-view-btn" data-id="${s.id}" aria-label="View details for ${s.title}">
              <span>View details</span>
            </button>
          </div>
        </article>
      `;
    }).join('');

    const viewButtons = servicesGridContainer.querySelectorAll('.service-view-btn');
    viewButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        showServiceDetail(btn.getAttribute('data-id'));
      });
    });

    const cards = servicesGridContainer.querySelectorAll('.service-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        showServiceDetail(card.getAttribute('data-service-id'));
      });
    });
  }

  function showServiceDetail(serviceId) {
    const service = services.find(function (s) { return s.id === serviceId; });
    if (!service || !serviceDetailView || !servicesGridView) return;

    const requirementsListHtml = service.requirements.map(function (req) {
      return `
        <li class="detail-list-item">
          <span class="check-bullet" aria-hidden="true">✓</span>
          <span>${req}</span>
        </li>
      `;
    }).join('');

    const processingStepsHtml = service.processingInfo.map(function (step, index) {
      return `
        <li class="detail-list-item">
          <span class="step-bullet" aria-hidden="true">${index + 1}</span>
          <span>${step}</span>
        </li>
      `;
    }).join('');

    const sessionInfoForSvc = getActiveSessionInfo();
    const isSessionActive = sessionInfoForSvc.active && sessionInfoForSvc.role === 'resident';

    let currentUserName = '';
    let currentUserSitio = '';
    if (isSessionActive) {
      try {
        const u = JSON.parse(localStorage.getItem('brgy360_user')) || {};
        currentUserName = u.full_legal_name || u.name || u.email || 'Resident';
        currentUserSitio = u.sitio || u.sitio_purok || '';
      } catch (e) {}
    }

    const actionBannerHtml = isSessionActive ? `
      <div class="detail-action-banner" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
        <div class="action-banner-left">
          <p class="action-banner-text" style="color: #14532d;">
            You are signed in as <strong>${currentUserName}</strong>${currentUserSitio ? ` (${currentUserSitio})` : ''}.
          </p>
        </div>
        <div class="action-banner-buttons">
          <a href="user.html#services" class="btn-action-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            <span>Apply for ${service.title} in Portal &rarr;</span>
          </a>
        </div>
      </div>
    ` : `
      <div class="detail-action-banner">
        <div class="action-banner-left">
          <p class="action-banner-text">Please log in or create a resident account to request this service.</p>
        </div>
        <div class="action-banner-buttons">
          <button type="button" class="btn-action-primary" id="detailLoginBtn">Log In to Request</button>
          <button type="button" class="btn-action-secondary" id="detailRegisterBtn">Create Account</button>
        </div>
      </div>
    `;

    serviceDetailView.innerHTML = `
      <div class="detail-nav-bar">
        <button type="button" class="btn-back-services" id="btnBackToServices" aria-label="Return to all services">
          <span>&larr; Back to services</span>
        </button>
      </div>

      <div class="detail-dark-header">
        <span class="detail-category-tag">${service.category}</span>
        <h2 class="detail-main-title">${service.title}</h2>
        <p class="detail-main-desc">${service.description}</p>
      </div>

      <div class="detail-metrics-row">
        <div class="metric-card">
          <span class="metric-label">Processing Time</span>
          <span class="metric-value">${service.processingTime}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Fee</span>
          <span class="metric-value">${service.fee}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Category</span>
          <span class="metric-value">${service.category}</span>
        </div>
      </div>

      <div class="detail-content-grid">
        <div class="detail-card">
          <h3 class="detail-card-title">Requirements</h3>
          <ul class="detail-items-list">${requirementsListHtml}</ul>
        </div>
        <div class="detail-card">
          <h3 class="detail-card-title">Processing Information</h3>
          <ul class="detail-items-list">${processingStepsHtml}</ul>
        </div>
      </div>

      ${actionBannerHtml}
    `;

    servicesGridView.style.display = 'none';
    serviceDetailView.style.display = 'block';

    const backBtn = document.getElementById('btnBackToServices');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        serviceDetailView.style.display = 'none';
        servicesGridView.style.display = 'block';
      });
    }

    const detailLoginBtn = document.getElementById('detailLoginBtn');
    if (detailLoginBtn) detailLoginBtn.addEventListener('click', () => openAuthModal('login'));

    const detailRegisterBtn = document.getElementById('detailRegisterBtn');
    if (detailRegisterBtn) detailRegisterBtn.addEventListener('click', () => openAuthModal('register'));
  }

  renderServicesGrid();

  // ==========================================================
  // 12. BUDGET & SPENDING TRANSPARENCY DASHBOARD
  // ==========================================================
  let allStoredBudgetRecords = [];
  let budgetRecordsData = [];
  let publicPieChartMode = 'actual';

  async function loadPublicBudgetFromDatabase() {
    try {
      allStoredBudgetRecords = await fetchBudgetRecords();
      budgetRecordsData = getPublicApplicableBudgetRecords(allStoredBudgetRecords);
      syncPublicBudgetFilterOptions();
      updateBudgetDashboard();
    } catch (error) {
      console.warn('Budget records notice:', error);
      allStoredBudgetRecords = [];
      budgetRecordsData = [];
      syncPublicBudgetFilterOptions();
      updateBudgetDashboard();
    }
  }

  const budgetYearFilter = document.getElementById('budgetYearFilter');
  const budgetQuarterFilter = document.getElementById('budgetQuarterFilter');
  const budgetCategoryFilter = document.getElementById('budgetCategoryFilter');
  const budgetResetFiltersBtn = document.getElementById('budgetResetFiltersBtn');

  const kpiTotalBudget = document.getElementById('kpiTotalBudget');
  const kpiTotalSpending = document.getElementById('kpiTotalSpending');
  const kpiRemainingBudget = document.getElementById('kpiRemainingBudget');
  const kpiUtilizationRate = document.getElementById('kpiUtilizationRate');

  const utilizationBadge = document.getElementById('utilizationBadge');
  const utilSpentBar = document.getElementById('utilSpentBar');
  const utilRemainingBar = document.getElementById('utilRemainingBar');
  const utilSubtextLabel = document.getElementById('utilSubtextLabel');

  const publicPieChartTitle = document.getElementById('publicPieChartTitle');
  const publicPieChartModeToggle = document.getElementById('publicPieChartModeToggle');

  const btnToggleBudgetRecords = document.getElementById('btnToggleBudgetRecords');
  const budgetRecordsTableContainer = document.getElementById('budgetRecordsTableContainer');
  const budgetRecordsTbody = document.getElementById('budgetRecordsTbody');
  const budgetTableItemCount = document.getElementById('budgetTableItemCount');

  function syncPublicBudgetFilterOptions() {
    if (budgetYearFilter) {
      const prevYear = budgetYearFilter.value || '2026';
      const availableYears = getAvailableFiscalYears(allStoredBudgetRecords);
      budgetYearFilter.innerHTML = availableYears
        .map(function (yr) {
          return '<option value="' + escapeBudgetHtml(yr) + '">' + escapeBudgetHtml(yr) + '</option>';
        })
        .join('');
      budgetYearFilter.value = availableYears.includes(prevYear) ? prevYear : (availableYears[0] || '2026');
    }

    if (budgetCategoryFilter) {
      const prevCat = budgetCategoryFilter.value || 'all';
      const baseCats = [...BUDGET_CATEGORIES];
      budgetRecordsData.forEach(function (rec) {
        if (rec.category && !baseCats.includes(rec.category)) baseCats.push(rec.category);
      });
      budgetCategoryFilter.innerHTML =
        '<option value="all">All Categories</option>' +
        baseCats.map(cat => '<option value="' + escapeBudgetHtml(cat) + '">' + escapeBudgetHtml(cat) + '</option>').join('');
      budgetCategoryFilter.value = (prevCat === 'all' || baseCats.includes(prevCat)) ? prevCat : 'all';
    }
  }

  let quarterBarChart = null;
  let categoryPieChart = null;

  function initBudgetCharts() {
    if (typeof Chart === 'undefined') return;

    const quarterCanvas = document.getElementById('budgetQuarterBarChart');
    if (quarterCanvas) {
      quarterBarChart = new Chart(quarterCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: [...BUDGET_QUARTERS],
          datasets: [
            { label: 'Budget', data: [0, 0, 0, 0], backgroundColor: '#0d47a1', borderRadius: 6 },
            { label: 'Actual', data: [0, 0, 0, 0], backgroundColor: '#f59e0b', borderRadius: 6 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', align: 'end' } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true }
          }
        }
      });
    }

    const categoryCanvas = document.getElementById('budgetCategoryPieChart');
    if (categoryCanvas) {
      categoryPieChart = new Chart(categoryCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Infrastructure', 'Health', 'Administration', 'Social Services'],
          datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: ['#0d47a1', '#16a34a', '#f59e0b', '#7c3aed']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }
  }

  function updateBudgetDashboard() {
    const selectedYear = budgetYearFilter ? budgetYearFilter.value : '2026';
    const selectedQuarter = budgetQuarterFilter ? budgetQuarterFilter.value : 'all';
    const selectedCategory = budgetCategoryFilter ? budgetCategoryFilter.value : 'all';

    if (budgetResetFiltersBtn) {
      const isFiltered = selectedYear !== '2026' || selectedQuarter !== 'all' || selectedCategory !== 'all';
      budgetResetFiltersBtn.style.display = isFiltered ? 'inline-flex' : 'none';
    }

    const filteredRecords = budgetRecordsData.filter(function (item) {
      const matchesYear = String(item.year) === String(selectedYear);
      const matchesQuarter = selectedQuarter === 'all' || item.quarter === selectedQuarter;
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesYear && matchesQuarter && matchesCategory;
    });

    const metrics = computeBudgetMetrics(filteredRecords);

    if (kpiTotalBudget) kpiTotalBudget.textContent = formatCurrencyPHP(metrics.totalBudget);
    if (kpiTotalSpending) kpiTotalSpending.textContent = formatCurrencyPHP(metrics.totalSpending);
    if (kpiRemainingBudget) kpiRemainingBudget.textContent = formatCurrencyPHP(metrics.remainingBudget);
    if (kpiUtilizationRate) kpiUtilizationRate.textContent = metrics.utilizationText;

    if (utilizationBadge) utilizationBadge.textContent = metrics.utilizationText + ' spent';
    if (utilSpentBar) utilSpentBar.style.width = metrics.spentBarPct + '%';
    if (utilRemainingBar) utilRemainingBar.style.width = metrics.remainingBarPct + '%';

    if (utilSubtextLabel) {
      utilSubtextLabel.innerHTML =
        '<strong>' + formatCurrencyPHP(metrics.totalSpending) + '</strong> of <strong>' +
        formatCurrencyPHP(metrics.totalBudget) + '</strong> used · <strong>' +
        formatCurrencyPHP(metrics.remainingBudget) + '</strong> remaining';
    }

    renderBudgetRecordsTable(filteredRecords);

    if (quarterBarChart) {
      const activeQuarters = selectedQuarter === 'all' ? [...BUDGET_QUARTERS] : [selectedQuarter];
      const budgetPerQ = activeQuarters.map(q =>
        budgetRecordsData.filter(it => (selectedCategory === 'all' || it.category === selectedCategory) && String(it.year) === String(selectedYear) && it.quarter === q)
          .reduce((sum, it) => sum + (Number(it.budget) || 0), 0)
      );
      const actualPerQ = activeQuarters.map(q =>
        budgetRecordsData.filter(it => (selectedCategory === 'all' || it.category === selectedCategory) && String(it.year) === String(selectedYear) && it.quarter === q)
          .reduce((sum, it) => sum + (Number(it.actual) || 0), 0)
      );
      quarterBarChart.data.labels = activeQuarters;
      quarterBarChart.data.datasets[0].data = budgetPerQ;
      quarterBarChart.data.datasets[1].data = actualPerQ;
      quarterBarChart.update();
    }

    if (categoryPieChart) {
      const yearCategories = getActiveCategoriesForYear(budgetRecordsData, selectedYear);
      const activeCategories = selectedCategory === 'all' ? yearCategories : [selectedCategory];
      const actualPerCat = activeCategories.map(cat =>
        budgetRecordsData.filter(it => (selectedQuarter === 'all' || it.quarter === selectedQuarter) && String(it.year) === String(selectedYear) && it.category === cat)
          .reduce((sum, it) => sum + (Number(it.actual) || 0), 0)
      );
      const budgetPerCat = activeCategories.map(cat =>
        budgetRecordsData.filter(it => (selectedQuarter === 'all' || it.quarter === selectedQuarter) && String(it.year) === String(selectedYear) && it.category === cat)
          .reduce((sum, it) => sum + (Number(it.budget) || 0), 0)
      );

      const sumActual = actualPerCat.reduce((a, b) => a + b, 0);
      const sumBudget = budgetPerCat.reduce((a, b) => a + b, 0);
      const effectiveMode = (publicPieChartMode === 'actual' && sumActual === 0 && sumBudget > 0) ? 'budget' : publicPieChartMode;

      if (publicPieChartTitle) {
        publicPieChartTitle.textContent = effectiveMode === 'budget' ? 'Allocated Budget by Category' : 'Spending by Category';
      }

      if (sumActual === 0 && sumBudget === 0) {
        categoryPieChart.data.labels = ['No Active Budget Data'];
        categoryPieChart.data.datasets[0].data = [1];
        categoryPieChart.data.datasets[0].backgroundColor = ['#e2e8f0'];
      } else {
        categoryPieChart.data.labels = activeCategories;
        categoryPieChart.data.datasets[0].data = effectiveMode === 'budget' ? budgetPerCat : actualPerCat;
        categoryPieChart.data.datasets[0].backgroundColor = activeCategories.map(c => BUDGET_CATEGORY_COLORS[c] || '#64748b');
      }
      categoryPieChart.update();
    }
  }

  function renderBudgetRecordsTable(records) {
    if (!budgetRecordsTbody) return;

    if (budgetTableItemCount) {
      budgetTableItemCount.textContent = 'Showing ' + records.length + (records.length === 1 ? ' line item' : ' line items');
    }

    if (records.length === 0) {
      budgetRecordsTbody.innerHTML = '<tr><td colspan="6" class="records-empty-state">No budget records found matching the selected filters.</td></tr>';
      return;
    }

    const quarterOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
    const sortedRecords = [...records].sort(function (a, b) {
      if (a.year !== b.year) return Number(b.year) - Number(a.year);
      return (quarterOrder[a.quarter] || 9) - (quarterOrder[b.quarter] || 9);
    });

    budgetRecordsTbody.innerHTML = sortedRecords.map(function (item) {
      const budgetVal = Number(item.budget) || 0;
      const actualVal = Number(item.actual) || 0;
      const itemUtilRaw = budgetVal > 0 ? (actualVal / budgetVal) * 100 : 0;

      return `
        <tr>
          <td class="col-quarter">${escapeBudgetHtml(item.quarter)} ${escapeBudgetHtml(item.year)}</td>
          <td class="col-category">${escapeBudgetHtml(item.category)}</td>
          <td class="col-desc">${escapeBudgetHtml(item.description)}</td>
          <td class="col-budget">${formatCurrencyPHP(budgetVal)}</td>
          <td class="col-actual">${formatCurrencyPHP(actualVal)}</td>
          <td class="col-utilization">${formatPercentValue(itemUtilRaw)}</td>
        </tr>
      `;
    }).join('');
  }

  if (btnToggleBudgetRecords && budgetRecordsTableContainer) {
    btnToggleBudgetRecords.addEventListener('click', function () {
      const isHidden = budgetRecordsTableContainer.style.display === 'none' || budgetRecordsTableContainer.style.display === '';
      budgetRecordsTableContainer.style.display = isHidden ? 'block' : 'none';
      btnToggleBudgetRecords.classList.toggle('is-open', isHidden);
    });
  }

  if (publicPieChartModeToggle) {
    publicPieChartModeToggle.querySelectorAll('.chart-mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        publicPieChartMode = btn.getAttribute('data-pie-mode') || 'actual';
        publicPieChartModeToggle.querySelectorAll('.chart-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
        updateBudgetDashboard();
      });
    });
  }

  if (budgetYearFilter) budgetYearFilter.addEventListener('change', updateBudgetDashboard);
  if (budgetQuarterFilter) budgetQuarterFilter.addEventListener('change', updateBudgetDashboard);
  if (budgetCategoryFilter) budgetCategoryFilter.addEventListener('change', updateBudgetDashboard);

  if (budgetResetFiltersBtn) {
    budgetResetFiltersBtn.addEventListener('click', function () {
      if (budgetYearFilter) budgetYearFilter.value = '2026';
      if (budgetQuarterFilter) budgetQuarterFilter.value = 'all';
      if (budgetCategoryFilter) budgetCategoryFilter.value = 'all';
      updateBudgetDashboard();
    });
  }

  initBudgetCharts();
  loadPublicBudgetFromDatabase();
  subscribeBudgetRecords(loadPublicBudgetFromDatabase);

  // ==========================================================
  // 13. ANNOUNCEMENTS: FEED & MODAL
  // ==========================================================
  let announcements = [];
  let currentOpenAnnouncementId = null;

  function normalizePublicAnnouncement(row) {
    const publishedDate = row.published_at || row.created_at;
    const dateObject = publishedDate ? new Date(publishedDate) : null;
    const formattedDate = dateObject && !isNaN(dateObject.getTime())
      ? dateObject.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const plainContent = String(row.announcement_content || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      id: row.announcement_id,
      title: row.headline || '',
      category: row.category || 'General',
      audience: row.target_audience || 'All Residents',
      department: 'Barangay Pallocan West',
      urgency: row.urgency || 'Standard',
      isEmergency: String(row.urgency || '').toLowerCase() === 'critical',
      summary: row.feed_summary || '',
      content: row.announcement_content || '',
      plainContent: plainContent,
      status: 'Active',
      date: formattedDate,
      publishedAt: dateObject ? dateObject.getTime() : 0,
      attachment: null
    };
  }

  const announcementsCardsFeed = document.getElementById('announcementsCardsFeed');
  const announcementsSearchInput = document.getElementById('announcementsSearchInput');
  const announcementsSearchClear = document.getElementById('announcementsSearchClear');
  const announcementsCategoryFilter = document.getElementById('announcementsCategoryFilter');
  const announcementsFeedCount = document.getElementById('announcementsFeedCount');
  const announcementDetailModal = document.getElementById('announcementDetailModal');
  const announcementModalContent = document.getElementById('announcementModalContent');
  const closeAnnouncementModalBtn = document.getElementById('closeAnnouncementModalBtn');

  async function loadPublicAnnouncements() {
    if (!announcementsCardsFeed) return;

    try {
      const response = await fetch('http://localhost:5000/api/announcements', {
        method: 'GET',
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load announcements.');
      }

      announcements = Array.isArray(data.announcements)
        ? data.announcements.map(normalizePublicAnnouncement)
        : [];

      renderAnnouncementsFeed();

    } catch (error) {
      console.warn('Announcements notice:', error);
      announcements = [];
      announcementsCardsFeed.innerHTML = `
        <div class="announcements-empty-state">
          <p class="announcements-empty-subtitle">No published announcements found.</p>
        </div>
      `;
    }
  }

  function getFilteredAndSortedAnnouncements() {
    const q = (announcementsSearchInput ? announcementsSearchInput.value : '').trim().toLowerCase();
    const cat = (announcementsCategoryFilter ? announcementsCategoryFilter.value : 'All');

    const filtered = announcements.filter(function (item) {
      if (!item || item.status !== 'Active') return false;
      const itemCategory = String(item.category || 'General');
      const matchesCategory = (cat === 'All' || itemCategory.toLowerCase() === cat.toLowerCase());
      const matchesSearch = (
        q === '' ||
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.summary || '').toLowerCase().includes(q)
      );
      return matchesCategory && matchesSearch;
    });

    filtered.sort(function (a, b) {
      if (a.isEmergency && !b.isEmergency) return -1;
      if (!a.isEmergency && b.isEmergency) return 1;
      return (Number(b.publishedAt) || 0) - (Number(a.publishedAt) || 0);
    });

    return filtered;
  }

  function renderAnnouncementsFeed() {
    if (!announcementsCardsFeed) return;
    const list = getFilteredAndSortedAnnouncements();

    if (announcementsFeedCount) {
      announcementsFeedCount.textContent = list.length + (list.length === 1 ? ' Announcement' : ' Announcements');
    }

    if (list.length === 0) {
      announcementsCardsFeed.innerHTML = `
        <div class="announcements-empty-state">
          <h4 class="empty-state-title">No announcements found</h4>
          <p class="empty-state-subtitle">No notices match your current filters.</p>
        </div>
      `;
      return;
    }

    announcementsCardsFeed.innerHTML = list.map(function (item) {
      const safeId = escapeAnnouncementHtml(item.id);
      const safeTitle = escapeAnnouncementHtml(item.title);
      const safeSummary = escapeAnnouncementHtml(item.summary);
      const safeCategory = escapeAnnouncementHtml(item.category);
      const safeDate = escapeAnnouncementHtml(item.date);

      return `
        <article class="announcement-card ${item.isEmergency ? 'emergency-card' : 'standard-card'}" data-id="${safeId}">
          <div class="announcement-card-inner">
            <div class="announcement-meta-row">
              <span class="meta-category-pill">${safeCategory}</span>
              <span class="meta-date-item">${safeDate}</span>
            </div>
            <h3 class="announcement-card-title">${safeTitle}</h3>
            <p class="announcement-card-summary">${safeSummary}</p>
          </div>
        </article>
      `;
    }).join('');

    announcementsCardsFeed.querySelectorAll('.announcement-card').forEach(function (card) {
      card.addEventListener('click', function () {
        const id = card.getAttribute('data-id');
        if (id) openAnnouncementModal(id);
      });
    });
  }

  function openAnnouncementModal(id) {
    const item = announcements.find(function (a) { return String(a.id) === String(id); });
    if (!item || !announcementDetailModal || !announcementModalContent) return;

    announcementModalContent.innerHTML = `
      <div class="announcement-modal-scrollable">
        <div class="modal-meta-bar">
          <span class="meta-category-pill">${escapeAnnouncementHtml(item.category)}</span>
          <span>Published: ${escapeAnnouncementHtml(item.date)}</span>
        </div>
        <h2 class="modal-announcement-title">${escapeAnnouncementHtml(item.title)}</h2>
        <div class="modal-announcement-body">
          ${item.content || 'No additional announcement details provided.'}
        </div>
      </div>
    `;

    announcementDetailModal.style.display = 'flex';
    announcementDetailModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeAnnouncementModal() {
    if (!announcementDetailModal) return;
    announcementDetailModal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(function () {
      announcementDetailModal.style.display = 'none';
    }, 250);
  }

  if (closeAnnouncementModalBtn) closeAnnouncementModalBtn.addEventListener('click', closeAnnouncementModal);
  if (announcementDetailModal) {
    announcementDetailModal.addEventListener('click', function (e) {
      if (e.target === announcementDetailModal) closeAnnouncementModal();
    });
  }

  if (announcementsSearchInput) announcementsSearchInput.addEventListener('input', renderAnnouncementsFeed);
  if (announcementsCategoryFilter) announcementsCategoryFilter.addEventListener('change', renderAnnouncementsFeed);

  loadPublicAnnouncements();

  // ==============================================================
  // BARANGAY OFFICIALS SYNCHRONIZATION & PUBLIC ROSTER
  // ==============================================================
  const aboutOfficialsGrid = document.getElementById('aboutOfficialsGrid');
  const officialsLedByName = document.getElementById('officialsLedByName');

  function renderPublicOfficials(officialsList) {
    const list = officialsList || loadOfficials();
    if (!aboutOfficialsGrid) return;

    // Sort by ID (1 to 10)
    const sorted = [...list].sort((a, b) => Number(a.id) - Number(b.id));

    // Update the leadership footer with the current Punong Barangay's name
    const leader = sorted.find(o => o.isLeader || o.position === 'Punong Barangay') || sorted[0];
    if (officialsLedByName && leader) {
      officialsLedByName.textContent = leader.name;
    }

    // Build the 10 cards HTML exactly matching about.css
    aboutOfficialsGrid.innerHTML = sorted.map((official) => {
      const isLeader = Boolean(official.isLeader || official.position === 'Punong Barangay');
      const cleanPhone = (official.contact || '').replace(/\s+/g, '');
      const gridClass = escapeOfficialHtml(official.gridClass || `official-r${Math.ceil(official.id / 5)}c${((official.id - 1) % 5) + 1}`);
      const leaderClass = isLeader ? 'is-punong-barangay' : '';

      const avatarSvg = isLeader
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-5-6.5 5 2-7.5-5.5-4.5h7z"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
             <circle cx="12" cy="7" r="4"/>
           </svg>`;

      return `
        <article class="about-card official-card ${gridClass} ${leaderClass}">
          <div class="official-avatar" aria-hidden="true">
            ${avatarSvg}
          </div>
          <h3>${escapeOfficialHtml(official.name)}</h3>
          <p class="official-position">${escapeOfficialHtml(official.position)}</p>
          <div class="official-meta">
            <div class="official-contact">
              <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <a href="tel:${escapeOfficialHtml(cleanPhone)}">${escapeOfficialHtml(official.contact || 'No Contact')}</a>
            </div>
            <div class="official-schedule">
              <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>${escapeOfficialHtml(official.schedule || 'Office Hours On-Call')}</span>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // Subscribe to updates from the shared PostgreSQL roster.
  subscribeOfficials((updatedList) => {
    renderPublicOfficials(updatedList);
  });

  // Load the latest roster from PostgreSQL when the public page opens.
  loadOfficialsFromAPI().catch((error) => {
    console.error('Failed to load public Barangay Officials:', error);
  });

  // Refresh periodically so changes made on another device appear here.
  setInterval(() => {
    loadOfficialsFromAPI().catch((error) => {
      console.warn('Could not refresh public Barangay Officials:', error);
    });
  }, 30000);
});