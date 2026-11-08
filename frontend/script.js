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

      // Close mobile drawer if open
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

      // Check bottom of page edge case: if at the bottom, highlight announcements
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

        // Fallback for top of page
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
  // Initial check on page load
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
        currentUser = JSON.parse(localStorage.getItem('brgy360_user'));
      } catch (e) {
        currentUser = null;
      }

      if (!currentUser) {
        currentUser = {};
      }
    }

    const userName = currentUser
      ? (currentUser.full_legal_name || currentUser.name || currentUser.email || '')
      : '';

    const VALID_PUBLIC_SITIOS = [
      'Sitio Ibaba',
      'Sitio Santolan',
      'Sitio Ilaya',
      'Sitio Gitna',
      'Tierra Verde',
      'Potenciana Village',
      'G.C Berberabe'
    ];

    const rawSitio = currentUser
      ? (currentUser.sitio || 'Sitio Ibaba')
      : 'Sitio Ibaba';

    const userSitio = VALID_PUBLIC_SITIOS.includes(rawSitio)
      ? rawSitio
      : (rawSitio === 'G.C. Berberabe' ? 'G.C Berberabe' : 'Sitio Ibaba');

    // 1. Update Navbar Auth Slot (no user name, no sign out button)
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
        servicesBannerSubtext.innerHTML = `Welcome back, <strong>${userName}</strong> (Verified Resident • ${userSitio}). Select any document below to view official requirements and submit an application directly via your resident portal.`;
      } else {
        servicesBannerSubtext.textContent = 'Browse the services available at the barangay. Log in or create a verified resident account to submit a request.';
      }
    }

    // 3. Update Report a Concern Section (Step 1 & CTA Banner)
    const workflowStep1Text = document.getElementById('workflowStep1Text');
    if (workflowStep1Text) {
      if (isSessionActive) {
        workflowStep1Text.innerHTML = `<strong>Already signed in:</strong> Logged in as ${userName} (${userSitio} • Verified).`;
      } else {
        workflowStep1Text.textContent = 'Create a resident account or sign in to the portal.';
      }
    }

    const concernCtaTitle = document.getElementById('concernCtaTitle');
    const concernCtaDescription = document.getElementById('concernCtaDescription');
    const concernCtaActions = document.getElementById('concernCtaActions');

    if (concernCtaTitle && concernCtaDescription && concernCtaActions) {
      if (isSessionActive) {
        concernCtaTitle.innerHTML = `Ready to report a concern, ${userName}?`;
        concernCtaDescription.textContent = `You are logged in with your verified resident account (${userSitio}). You do not need to sign in again — submit your concern directly with an automated tracking number and monitor site inspection status in real-time.`;
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

  // Initial call to sync public view with login status
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
        return; // Allow direct navigation to admin.html
      }
      // Open Login modal so user can authenticate with Admin credentials even if currently signed in as resident
      e.preventDefault();
      openAuthModal('login', true);
      if (loginFeedback) {
        loginFeedback.className = 'auth-feedback-banner warning';
        loginFeedback.textContent = 'Administrator Sign-In Required: Please enter your administrator email and password to access the Admin Console.';
        loginFeedback.style.display = 'block';
      }
    });
  }

  if (loginFeedback) {
    loginFeedback.addEventListener('click', function (e) {
      const adminDeskLink = e.target.closest('a[href^="admin.html"]');
      if (adminDeskLink) {
        localStorage.setItem('currentUserRole', 'admin');
        localStorage.setItem('brgy360_session', JSON.stringify({
          role: 'admin',
          email: 'admin@brgy360.gov.ph',
          name: 'Ma. Victoria M. Marasigan',
          loginTime: new Date().toISOString()
        }));
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


    // Dual-Role Account 1: Administrator
    if (
      emailLower === 'admin@brgy360.gov.ph' ||
      emailLower === 'pallocanwest360@gmail.com'
    ) {
      try {
        const response = await fetch('http://localhost:5000/api/auth/admin/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: emailLower,
            password: passVal
          })
        });

        const data = await response.json().catch(function () {
          return {};
        });

        if (!response.ok) {
          const message =
            data.message ||
            data.error ||
            'Invalid administrator email or password.';

          console.error('Admin login response:', response.status, data);

          setFieldError(loginPassword, loginPasswordError, message);

          if (loginFeedback) {
            loginFeedback.className = 'auth-feedback-banner error';
            loginFeedback.textContent = message;
            loginFeedback.style.display = 'block';
          }

          return;
        }

        const adminUser = data.user || {};

        localStorage.setItem('currentUserRole', 'admin');

        localStorage.setItem('brgy360_session', JSON.stringify({
          role: 'admin',
          id: adminUser.id || adminUser.admin_id || null,
          email: adminUser.email || emailLower,
          loginTime: new Date().toISOString()
        }));

        if (loginFeedback) {
          loginFeedback.className = 'auth-feedback-banner success';
          loginFeedback.textContent =
            'Administrator authenticated! Loading Executive Console...';
          loginFeedback.style.display = 'block';
        }

        setTimeout(function () {
          closeAuthModal();
          loginForm.reset();
          clearAuthFeedback();
          window.location.href = 'admin.html';
        }, 600);

      } catch (error) {
        console.error('Administrator login failed:', error);

        const message =
          'Cannot connect to the Brgy360 server. Please make sure the backend is running.';

        setFieldError(loginPassword, loginPasswordError, message);

        if (loginFeedback) {
          loginFeedback.className = 'auth-feedback-banner error';
          loginFeedback.textContent = message;
          loginFeedback.style.display = 'block';
        }
      }

      return;
    }

      // Resident Login: authenticate using the backend and MySQL
      console.log("Resident login code reached");
      try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: emailLower,
            password: passVal
          })
        });

        const result = await response.json();

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

        const residentUser = result.user;

        // Keep the existing frontend role/session flags.
        // The actual authenticated session is maintained by the backend cookie.
        localStorage.setItem('currentUserRole', 'resident');
        localStorage.setItem('brgy360_session', 'active');
        localStorage.setItem('brgy360_user', JSON.stringify(residentUser));

        if (loginFeedback) {
          loginFeedback.className = 'auth-feedback-banner success';
          loginFeedback.textContent =
            `Welcome back, ${residentUser.full_legal_name || residentUser.email}!`;
          loginFeedback.style.display = 'block';
        }

        setTimeout(function () {
          closeAuthModal();
          loginForm.reset();
          clearAuthFeedback();
          window.location.href = 'user.html';
        }, 600);

      } catch (error) {
        console.error('Resident login failed:', error);

        const message =
          'Cannot connect to the Brgy360 server. Please make sure the backend is running.';

        setFieldError(loginPassword, loginPasswordError, message);

        if (loginFeedback) {
          loginFeedback.className = 'auth-feedback-banner error';
          loginFeedback.textContent = message;
          loginFeedback.style.display = 'block';
        }
      }

      return;
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

  // In-memory attachment records
  let currentRegIdAttachment = null;
  let currentRegProofAttachment = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function computeAge(dobString) {
    if (!dobString) return 28;
    const birth = new Date(dobString);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return isNaN(age) || age < 1 ? 28 : age;
  }

  // Handle ID File Selection
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

  // Handle Proof of Residency File Selection (Optional)
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

  // Immediate inline feedback for confirm password matching
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

  // Date of Birth & Age synchronization
  if (regDob) {
    // Set max date for birthdate to today
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

  // Real-time restriction: Name (Letters and spaces only)
  if (regFullName) {
    regFullName.addEventListener('input', function () {
      const original = this.value;
      const sanitized = original.replace(/[^a-zA-Z\s]/g, '');
      if (original !== sanitized) {
        this.value = sanitized;
        setFieldError(this, regFullNameError, 'Name must contain letters and spaces only. Numbers and special characters are not allowed.');
        return;
      }
      if (sanitized.trim().length >= 2) {
        clearFieldError(this, regFullNameError);
      }
    });
  }

  // Real-time restriction: Contact Number (Numeric digits only)
  if (regMobile) {
    regMobile.addEventListener('input', function () {
      const original = this.value;
      const sanitized = original.replace(/\D/g, '');
      if (original !== sanitized) {
        this.value = sanitized;
        setFieldError(this, regMobileError, 'Contact number must contain numeric digits only. Letters and special characters are not allowed.');
        return;
      }
      if (sanitized.length >= 7 && sanitized.length <= 11) {
        clearFieldError(this, regMobileError);
      }
    });
  }

  // Real-time restriction: Age (Numeric digits only)
  if (regAge) {
    regAge.addEventListener('input', function () {
      const original = this.value;
      const sanitized = original.replace(/\D/g, '');
      if (original !== sanitized) {
        this.value = sanitized;
        setFieldError(this, regAgeError, 'Age must contain numeric digits only. Letters and special characters are not allowed.');
        return;
      }
      const num = parseInt(sanitized, 10);
      if (!isNaN(num) && num >= 1 && num <= 120) {
        clearFieldError(this, regAgeError);
      }
    });
  }

  // Real-time validation: Email Address
  if (regEmail) {
    let emailCheckTimer;
    let emailCheckRequest = 0;

    regEmail.addEventListener('input', function () {
      const val = this.value.trim();
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      // Cancel the previous pending check
      clearTimeout(emailCheckTimer);

      // Invalidate any response from an older request
      const currentRequest = ++emailCheckRequest;

      if (!val || !emailRegex.test(val)) {
        clearFieldError(this, regEmailError);
        return;
      }

      // Wait briefly before checking the email
      emailCheckTimer = setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:5000/api/auth/check-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: val })
          });

          const result = await response.json();

          // Ignore outdated responses
          if (currentRequest !== emailCheckRequest) return;

          if (!response.ok) {
            console.error('Email check failed:', result.message);
            return;
          }

          if (result.available === false) {
            regEmailError.textContent = 'An account with this email already exists.';
            regEmailError.style.display = 'block';
            regEmailError.style.color = 'red';
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

  // Clear errors on input for all other registration fields
  [
    [regGender, regGenderError],
    [regCivilStatus, regCivilStatusError],
    [regAddress, regAddressError],
    [regSitio, regSitioError]
  ].forEach(function (pair) {
    const el = pair[0];
    const err = pair[1];
    if (el) {
      el.addEventListener('input', function () {
        clearFieldError(el, err);
      });
      el.addEventListener('change', function () {
        clearFieldError(el, err);
      });
    }
  });

  // Post-Registration Pending Verification Modal Handlers
  const regPendingModal = document.getElementById('regPendingModal');
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
      localStorage.setItem('currentUserRole', 'admin');
      localStorage.setItem('brgy360_session', JSON.stringify({
        role: 'admin',
        email: 'admin@brgy360.gov.ph',
        name: 'Ma. Victoria M. Marasigan',
        loginTime: new Date().toISOString()
      }));
      window.location.href = 'admin.html#demographics';
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

      // Full Name: Letters and spaces only. No numbers or special characters.
      const nameVal = regFullName ? regFullName.value.trim() : '';
      const nameRegex = /^[a-zA-Z\s]+$/;
      if (!nameVal) {
        markInvalid(regFullName, regFullNameError, 'Full legal name is required.');
      } else if (!nameRegex.test(nameVal)) {
        markInvalid(regFullName, regFullNameError, 'Name must contain letters and spaces only. Numbers and special characters are not allowed.');
      } else if (nameVal.length < 2) {
        markInvalid(regFullName, regFullNameError, 'Name must be at least 2 characters long.');
      } else {
        clearFieldError(regFullName, regFullNameError);
      }

      // Gender (Kasarian)
      const genderVal = regGender ? regGender.value : '';
      if (!genderVal) {
        markInvalid(regGender, regGenderError, 'Please select your gender.');
      } else {
        clearFieldError(regGender, regGenderError);
      }

      // Civil Status
      const civilVal = regCivilStatus ? regCivilStatus.value : '';
      if (!civilVal) {
        markInvalid(regCivilStatus, regCivilStatusError, 'Please select your civil status.');
      } else {
        clearFieldError(regCivilStatus, regCivilStatusError);
      }

      // Date of Birth
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

      // Age: Numeric digits only. No letters or special characters.
      const ageVal = regAge ? regAge.value.trim() : '';
      const digitsRegex = /^\d+$/;
      if (!ageVal) {
        markInvalid(regAge, regAgeError, 'Age is required.');
      } else if (!digitsRegex.test(ageVal)) {
        markInvalid(regAge, regAgeError, 'Age must contain numeric digits only. Letters and special characters are not allowed.');
      } else {
        const ageNum = parseInt(ageVal, 10);
        if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
          markInvalid(regAge, regAgeError, 'Please enter a valid age between 1 and 120.');
        } else {
          clearFieldError(regAge, regAgeError);
        }
      }

      // Mobile Number: Numeric digits only. No letters or special characters.
      const mobileVal = regMobile ? regMobile.value.trim() : '';
      if (!mobileVal) {
        markInvalid(regMobile, regMobileError, 'Contact number is required.');
      } else if (!digitsRegex.test(mobileVal)) {
        markInvalid(regMobile, regMobileError, 'Contact number must contain numeric digits only. Letters and special characters are not allowed.');
      } else if (mobileVal.length < 7 || mobileVal.length > 11) {
        markInvalid(regMobile, regMobileError, 'Contact number must be between 7 and 11 numeric digits (e.g. 09171234567).');
      } else {
        clearFieldError(regMobile, regMobileError);
      }

      // Email Address: Validate format
      const emailVal = regEmail ? regEmail.value.trim() : '';
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailVal) {
        markInvalid(regEmail, regEmailError, 'Email address is required.');
      } else if (!emailRegex.test(emailVal)) {
        markInvalid(regEmail, regEmailError, 'Please enter a valid email address (e.g. resident@example.com).');
      } else {
        clearFieldError(regEmail, regEmailError);
      }

      // Address
      const addressVal = regAddress ? regAddress.value.trim() : '';
      if (!addressVal) {
        markInvalid(regAddress, regAddressError, 'Address is required.');
      } else if (addressVal.length < 5) {
        markInvalid(regAddress, regAddressError, 'Address must be at least 5 characters long.');
      } else {
        clearFieldError(regAddress, regAddressError);
      }

      // Sitio / Purok
      const sitioVal = regSitio ? regSitio.value : '';
      if (!sitioVal) {
        markInvalid(regSitio, regSitioError, 'Sitio / Purok is required.');
      } else {
        clearFieldError(regSitio, regSitioError);
      }

      // ID Type & Submit ID (picture / attachment)
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

      // Proof of Residency (Optional)
      const proofTypeVal = regProofType ? regProofType.value : '';

      // Password
      const passVal = regPassword ? regPassword.value : '';
      if (!passVal) {
        markInvalid(regPassword, regPasswordError, 'Password is required.');
      } else if (passVal.length < 8) {
        markInvalid(regPassword, regPasswordError, 'Password must be at least 8 characters long.');
      } else {
        clearFieldError(regPassword, regPasswordError);
      }

      // Confirm Password
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

      // Get the applicant's age
      const applicantAge = parseInt(ageVal, 10) || computeAge(dobVal);

      // Prepare registration data
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
      formData.append(
          "residency_proof_type",
          proofTypeVal || "No Proof of Residency"
      );

      // Attach required valid ID
      if (!currentRegIdAttachment || !currentRegIdAttachment.file) {
          alert("Please upload your valid ID.");
          return;
      }

      formData.append(
          "id_document",
          currentRegIdAttachment.file
      );

      // Attach optional proof of residency
      if (currentRegProofAttachment && currentRegProofAttachment.file) {
          formData.append(
              "residency_proof_document",
              currentRegProofAttachment.file
          );
      }

      try {
          const response = await fetch(
              "http://localhost:5000/api/auth/register",
              {
                  method: "POST",
                  body: formData
              }
          );

          const result = await response.json();

          if (!response.ok) {
              throw new Error(result.message || "Registration failed.");
          }

          // Show registration pending modal
          if (regPendingModal) {
              regPendingModal.classList.add("active");
          }

          // Close registration form
          if (typeof closeAuthModal === "function") {
              closeAuthModal();
          }

          // Reset registration form
          registerForm.reset();

          // Clear uploaded file references
          currentRegIdAttachment = null;
          currentRegProofAttachment = null;

          // Hide file previews and show upload areas again
          if (regIdPreview) regIdPreview.classList.remove("active");
          if (regProofPreview) regProofPreview.classList.remove("active");

          if (regIdDropzone) regIdDropzone.classList.remove("hidden");
          if (regProofDropzone) regProofDropzone.classList.remove("hidden");

          // Clear feedback message
          if (registerFeedback) {
              registerFeedback.textContent = "";
          }

      } catch (error) {
          console.error("Registration error:", error);

          if (registerFeedback) {
              registerFeedback.textContent = error.message;
              registerFeedback.style.color = "red";
              registerFeedback.style.display = "block";
          } else {
              alert(error.message);
          }

          return;
      }

      // Reset registration form & attachments
      registerForm.reset();
      currentRegIdAttachment = null;
      currentRegProofAttachment = null;
      if (regIdPreviewCard) regIdPreviewCard.style.display = 'none';
      if (regIdDropzone) {
        regIdDropzone.style.display = 'flex';
        regIdDropzone.style.borderColor = '#cbd5e1';
      }
      if (regProofPreviewCard) regProofPreviewCard.style.display = 'none';
      if (regProofDropzone) regProofDropzone.style.display = 'flex';
      clearAuthFeedback();

      // Pre-fill login email for quick check
      if (loginEmail) loginEmail.value = emailVal;
    });
  }

  // In-app Toast Notification Engine (Avoids window.alert)
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
      const proposalCode = 'PROP-2026-' + Math.floor(100 + Math.random() * 900);

      try {
        const stored = JSON.parse(localStorage.getItem('brgy360_proposals') || '[]');
        stored.unshift({
          id: proposalCode,
          ref: proposalCode,
          title: title,
          category: 'Infrastructure',
          location: 'Barangay Pallocan West',
          sitio: 'Sitio Ibaba',
          budget: '₱100,000.00',
          rawBudget: 100000,
          timeline: 'Q1 2027 (3 months implementation)',
          dateFiled: new Date().toISOString().split('T')[0],
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          year: '2026',
          status: 'Pending',
          proponent: 'Citizen Submitter',
          email: '',
          description: 'Grassroots community proposal submitted through the public portal.',
          rationale: 'Grassroots community proposal submitted through the public portal.',
          councilNote: 'Received by Barangay Development Council Secretariat. Queued for technical review.',
          councilNotes: 'Received by Barangay Development Council Secretariat. Queued for technical review.'
        });
        localStorage.setItem('brgy360_proposals', JSON.stringify(stored));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('brgy360_proposals_changed', { detail: stored }));
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
// Hero Background Slideshow
const heroSlides = document.querySelectorAll('.hero-slide');
let currentSlide = 0;

if (heroSlides.length > 1) {
  setInterval(function () {
    heroSlides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % heroSlides.length;
    heroSlides[currentSlide].classList.add('active');
  }, 3000); // 3 seconds per photo
}

  // 9. Projects Dynamic Portfolio Sync, Filter, Search, KPIs, and Live Counter
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

  const DEFAULT_PUBLIC_PROJECTS = [];

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

  function getStatusFromPublicProgress(progress) {
    const pct = clampPublicProgress(progress);
    if (pct === 100) return 'completed';
    if (pct >= 25) return 'ongoing';
    return 'planning';
  }

  let publicTrendChartInstance = null;

  function computeYearCompletionMetric(projectsList, targetYear) {
    const yrProjects = projectsList.filter(function (p) { return String(p.year) === String(targetYear); });
    if (yrProjects.length === 0) return 0;
    const avgProgress = Math.round(
      yrProjects.reduce(function (sum, p) { return sum + clampPublicProgress(p.progress); }, 0) / yrProjects.length
    );
    return avgProgress;
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
      const rate2025 = computeYearCompletionMetric(projectsList, '2025');
      const rate2026 = computeYearCompletionMetric(projectsList, '2026');
      publicTrendChartInstance.data.datasets[0].data = [rate2025, rate2026];
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
      const response = await fetch('http://localhost:5000/api/projects/public', {
        method: 'GET'
      });


      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load projects.');
      }

      projectsList = data.projects.map(project => {
        const createdDate = project.created_at
          ? new Date(project.created_at)
          : null;

        const year = createdDate && !isNaN(createdDate)
          ? String(createdDate.getFullYear())
          : String(new Date().getFullYear());

        return {
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
        };
      });

    } catch (error) {
      console.error('Load public projects error:', error);
      projectsGrid.innerHTML = '<p class="text-muted">Unable to load projects. Please try again later.</p>';
      return;
    }

    // Keep year dropdown options synced if new years are added
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
    if (publicTrendChartInstance) {
  const rate2025 = computeYearCompletionMetric(projectsList, '2025');
  const rate2026 = computeYearCompletionMetric(projectsList, '2026');

  publicTrendChartInstance.data.datasets[0].data = [
    rate2025,
    rate2026
  ];

  publicTrendChartInstance.update();
}
    applyPublicProjectFilters();
  }

  if (projectsGrid) {
    if (projectSearchInput) {
      projectSearchInput.addEventListener('input', applyPublicProjectFilters);
    }

    if (projectStatusFilter) {
      projectStatusFilter.addEventListener('change', applyPublicProjectFilters);
    }

    if (projectYearFilter) {
      projectYearFilter.addEventListener('change', applyPublicProjectFilters);
    }

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

    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', resetAllFilters);
    }

    if (emptyStateResetBtn) {
      emptyStateResetBtn.addEventListener('click', resetAllFilters);
    }

    renderPublicProjectsPortfolio();

    window.addEventListener('pageshow', function () {
      renderPublicProjectsPortfolio();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        renderPublicProjectsPortfolio();
      }
    });
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
    // Allow display:flex to register before transition class
    requestAnimationFrame(function () {
      proposeModal.classList.add('active', 'is-open');
      proposeModal.setAttribute('aria-hidden', 'false');
    });
    // Focus first input
    const firstInput = document.getElementById('modalProjectName');
    if (firstInput) {
      setTimeout(function () { firstInput.focus(); }, 100);
    }
  }

  function closeProposeModal() {
    if (!proposeModal) return;

    // Remove keyboard focus before hiding the modal.
    if (proposeModal.contains(document.activeElement)) {
        document.activeElement.blur();
    }

    proposeModal.classList.remove('active', 'is-open');
    proposeModal.setAttribute('aria-hidden', 'true');
    setTimeout(function () {
      proposeModal.style.display = 'none';
      // Reset view to form if it was in success state
      if (modalProposeForm) modalProposeForm.style.display = 'block';
      if (modalSuccessState) modalSuccessState.style.display = 'none';
    }, 250);
  }

  if (openProposeModalBtn) {
    openProposeModalBtn.addEventListener('click', openProposeModal);
  }

  if (closeProposeModalBtn) {
    closeProposeModalBtn.addEventListener('click', closeProposeModal);
  }

  if (cancelProposeModalBtn) {
    cancelProposeModalBtn.addEventListener('click', closeProposeModal);
  }

  if (dismissSuccessModalBtn) {
    dismissSuccessModalBtn.addEventListener('click', function () {
      closeProposeModal();
      if (modalProposeForm) modalProposeForm.reset();
    });
  }

  // Close on backdrop click
  if (proposeModal) {
    proposeModal.addEventListener('click', function (e) {
      if (e.target === proposeModal) {
        closeProposeModal();
      }
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && proposeModal && (proposeModal.classList.contains('active') || proposeModal.classList.contains('is-open'))) {
      closeProposeModal();
    }
  });

  // Modal Form Validation & Submission
  if (modalProposeForm) {
    const propNameEl = document.getElementById('modalProponentName');
    const propPhoneEl = document.getElementById('modalProponentPhone');
    const propEmailEl = document.getElementById('modalProponentEmail');
    const propBudgetEl = document.getElementById('modalProjectBudget');

    // Real-time restriction: Name (Letters and spaces only)
    if (propNameEl) {
      propNameEl.addEventListener('input', function () {
        const original = this.value;
        const sanitized = original.replace(/[^a-zA-Z\s]/g, '');
        if (original !== sanitized) {
          this.value = sanitized;
          const errEl = document.getElementById('errorProponentName');
          if (errEl) {
            errEl.textContent = 'Name must contain letters and spaces only. Numbers and special characters are not allowed.';
            errEl.classList.add('is-visible');
          }
          this.classList.add('has-error');
          return;
        }
        if (sanitized.trim().length >= 2) {
          this.classList.remove('has-error');
          const errEl = document.getElementById('errorProponentName');
          if (errEl) errEl.classList.remove('is-visible');
        }
      });
    }

    // Real-time restriction: Phone / Mobile (Numeric digits only)
    if (propPhoneEl) {
      propPhoneEl.addEventListener('input', function () {
        const original = this.value;
        const sanitized = original.replace(/\D/g, '');
        if (original !== sanitized) {
          this.value = sanitized;
          const errEl = document.getElementById('errorProponentPhone');
          if (errEl) {
            errEl.textContent = 'Contact number must contain numeric digits only. Letters and special characters are not allowed.';
            errEl.classList.add('is-visible');
          }
          this.classList.add('has-error');
          return;
        }
        if (sanitized.length >= 7 && sanitized.length <= 11) {
          this.classList.remove('has-error');
          const errEl = document.getElementById('errorProponentPhone');
          if (errEl) errEl.classList.remove('is-visible');
        }
      });
    }

    // Real-time restriction: Budget (Numeric digits only)
    if (propBudgetEl) {
      propBudgetEl.addEventListener('input', function () {
        const original = this.value;
        const sanitized = original.replace(/\D/g, '');
        if (original !== sanitized) {
          this.value = sanitized;
        }
        if (Number(sanitized) > 0) {
          this.classList.remove('has-error');
          const errEl = document.getElementById('errorProjectBudget');
          if (errEl) errEl.classList.remove('is-visible');
        }
      });
    }

    const fieldValidators = [
      {
        inputId: 'modalProjectName',
        errorId: 'errorProjectName',
        validate: (val) => val.trim().length >= 3,
        message: 'Please provide a descriptive project name (at least 3 characters).'
      },
      {
        inputId: 'modalProjectCategory',
        errorId: 'errorProjectCategory',
        validate: (val) => Boolean(val && val.trim() !== ''),
        message: 'Please select a project category from the list.'
      },
      {
        inputId: 'modalProjectLocation',
        errorId: 'errorProjectLocation',
        validate: (val) => Boolean(val && val.trim() !== ''),
        message: 'Please specify the project location or sitio.'
      },
      {
        inputId: 'modalProjectBudget',
        errorId: 'errorProjectBudget',
        validate: (val) => /^\d+$/.test(val.trim()) && Number(val) > 0,
        message: 'Budget must contain numeric digits only and be greater than ₱0.'
      },
      {
        inputId: 'modalProjectStartDate',
        errorId: 'errorProjectStartDate',
        validate: (val) => Boolean(val && val.trim() !== ''),
        message: 'Please choose a target start date.'
      },
      {
        inputId: 'modalProjectDescription',
        errorId: 'errorProjectDescription',
        validate: (val) => val.trim().length >= 10,
        message: 'Please provide a brief justification and community benefit (at least 10 characters).'
      },
      {
        inputId: 'modalProponentName',
        errorId: 'errorProponentName',
        validate: (val) => {
          const trimmed = val.trim();
          return trimmed.length >= 2 && /^[a-zA-Z\s]+$/.test(trimmed);
        },
        message: 'Name must contain letters and spaces only. Numbers and special characters are not allowed.'
      },
      {
        inputId: 'modalProponentEmail',
        errorId: 'errorProponentEmail',
        validate: (val) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim()),
        message: 'Please enter a valid email address (e.g., juan@example.com).'
      },
      {
        inputId: 'modalProponentPhone',
        errorId: 'errorProponentPhone',
        validate: (val) => {
          const trimmed = val.trim();
          return /^\d+$/.test(trimmed) && trimmed.length >= 7 && trimmed.length <= 11;
        },
        message: 'Contact number must contain numeric digits only (7-11 digits).'
      }
    ];

    // Clear individual errors on input/change
    fieldValidators.forEach(function (field) {
      const el = document.getElementById(field.inputId);
      const errEl = document.getElementById(field.errorId);
      if (el) {
        el.addEventListener('input', function () {
          el.classList.remove('has-error');
          if (errEl) errEl.classList.remove('is-visible');
        });
        el.addEventListener('change', function () {
          el.classList.remove('has-error');
          if (errEl) errEl.classList.remove('is-visible');
        });
      }
    });

    modalProposeForm.addEventListener('submit', async function (e) {
      console.log("PUBLIC PROPOSAL FORM SUBMITTED");
      e.preventDefault();
      let isValid = true;
      let firstInvalidEl = null;

      fieldValidators.forEach(function (field) {
        const el = document.getElementById(field.inputId);
        const errEl = document.getElementById(field.errorId);
        if (el) {
          const valid = field.validate(el.value);
          if (!valid) {
            isValid = false;
            el.classList.add('has-error');
            if (errEl) {
              errEl.textContent = field.message;
              errEl.classList.add('is-visible');
            }
            if (!firstInvalidEl) firstInvalidEl = el;
          } else {
            el.classList.remove('has-error');
            if (errEl) errEl.classList.remove('is-visible');
          }
        }
      });

      if (!isValid) {
        if (firstInvalidEl) {
          firstInvalidEl.focus();
          firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      
      // Submit proposal to the backend
      const submitButton = document.getElementById('submitProposalBtn');
      const fileInput = document.getElementById('modalProjectFile');

      const formData = new FormData();

      formData.append('projectTitle', document.getElementById('modalProjectName').value.trim());
      formData.append('sectorCategory', document.getElementById('modalProjectCategory').value);
      formData.append('locationSitio', document.getElementById('modalProjectLocation').value);
      formData.append('estimatedBudget', document.getElementById('modalProjectBudget').value);
      formData.append('proposedTimeline', document.getElementById('modalProjectStartDate').value);
      formData.append('rationale', document.getElementById('modalProjectDescription').value.trim());
      formData.append('fullName', document.getElementById('modalProponentName').value.trim());
      formData.append('email', document.getElementById('modalProponentEmail').value.trim());
      formData.append('phone', document.getElementById('modalProponentPhone').value.trim());
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

        // Show success only after the backend confirms saving.
        if (successTrackingId) {
          successTrackingId.textContent = result.trackingCode;
        }

        modalProposeForm.style.display = 'none';

        if (modalSuccessState) {
          modalSuccessState.style.display = 'block';
        }

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

  // 11. Chart.js Trend Line Chart (Section 1)
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
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ' ' + context.dataset.label + ': ' + context.parsed.y + '%';
            }
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 25,
            callback: function (val) { return val + '%'; }
          },
          grid: {
            color: '#e2e8f0'
          }
        },
        x: {
          grid: { display: false }
        }
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
      description: 'Official clearance certifying residency, good moral standing, and no pending derogatory record in the barangay. Essential for employment, business licensing, and official transactions.',
      processingTime: '1 business day',
      fee: '₱50.00 (Free for First-Time Jobseekers)',
      requirements: [
        'Valid Government-issued ID (National ID, UMID, Postal ID, Driver’s License)',
        'Recent 1x1 or 2x2 ID Photo with white background',
        'Current year Community Tax Certificate (Cedula)',
        'Purok Leader endorsement or proof of billing under applicant’s name',
        'Duly signed Oath of Undertaking (if applying under RA 11261 First-Time Jobseekers Act)'
      ],
      processingInfo: [
        'Submission: Apply online or present required documents at the Barangay Hall Window 1.',
        'Record Verification: Records officer verifies residency against the Registry of Barangay Inhabitants (RBI) and Lupon blotter archives.',
        'Endorsement & Approval: Barangay Secretary certifies the document and forwards it to the Punong Barangay for executive signature.',
        'Release: Affixed with the official dry seal and tamper-evident QR verification code. Available for claiming during official hours.'
      ]
    },
    {
      id: 'certificate-of-residency',
      title: 'Certificate of Residency',
      category: 'CERTIFICATION',
      description: 'Authenticates continuous, active residency of a citizen within their designated purok. Frequently required for bank account opening, utility line connection, and court affidavits.',
      processingTime: 'Same day (within 4 hours)',
      fee: '₱50.00',
      requirements: [
        'Any valid ID bearing current local address',
        'Minimum of six (6) months continuous residence in the barangay',
        'Purok Leader Certification or recommendation note',
        'Community Tax Certificate (Cedula)'
      ],
      processingInfo: [
        'Identity & Purok check cross-referenced with Purok census databases.',
        'Preparation of certified document signed by authorized Barangay Officer.',
        'Immediate release upon presentation of claiming slip and valid ID.'
      ]
    },
    {
      id: 'certificate-of-indigency',
      title: 'Certificate of Indigency',
      category: 'ASSISTANCE',
      description: 'Issued to bonafide low-income and indigent residents seeking medical, financial, hospitalization, educational scholarship, or PAO legal assistance.',
      processingTime: 'Same day (Priority Desk)',
      fee: 'Free of Charge (Exempted by Law)',
      requirements: [
        'Valid Government ID, Student ID, or Senior Citizen / PWD Card',
        'Endorsement from Purok President confirming indigent family status',
        'Supporting proof of need (Medical abstract, hospital statement of account, tuition notice, or PAO referral)'
      ],
      processingInfo: [
        'Interview and assessment by the Barangay Social Services Officer.',
        'Expedited verification to accommodate urgent medical or financial emergencies.',
        'Dry sealed and endorsed by the Punong Barangay free of any charge.'
      ]
    },
    {
      id: 'barangay-business-clearance',
      title: 'Barangay Business Clearance',
      category: 'BUSINESS PERMIT',
      description: 'Prerequisite clearance for new commercial enterprises, sari-sari stores, or annual renewal of business operations within the jurisdiction of the barangay.',
      processingTime: '2 business days',
      fee: '₱150.00 – ₱500.00 (Graduated scale per Revenue Code)',
      requirements: [
        'DTI Business Name Registration or SEC Articles of Incorporation',
        'Lease Agreement or Proof of Real Property Ownership of business location',
        'Barangay Sanitary and Health Clearance for food handling establishments',
        'Previous year Barangay Business Clearance (if applying for renewal)',
        'Barangay Zoning Locational Endorsement'
      ],
      processingInfo: [
        'Ocular site inspection by the Barangay Committee on Commerce & Public Order.',
        'Tax assessment based on capitalization and local municipal revenue schedules.',
        'Issuance of official business clearance plaque and inspection sticker.'
      ]
    },
    {
      id: 'first-time-jobseeker',
      title: 'First-Time Jobseeker Assistance (RA 11261)',
      category: 'YOUTH & EMPLOYMENT',
      description: 'Statutory certification exempting first-time jobseekers from paying government fees for barangay clearances, police clearances, medical certificates, and NBI clearances.',
      processingTime: '1 business day',
      fee: 'Free of Charge (RA 11261)',
      requirements: [
        'Duly notarized or administered Oath of Undertaking',
        'Barangay First-Time Jobseeker Application Form',
        'Diploma, Certificate of Graduation, or School Certification of completion',
        'One (1) valid ID or validated Student ID'
      ],
      processingInfo: [
        'Validation of first-time worker status in DOLE / NYC youth registry.',
        'Issuance of official multi-agency certification valid for one (1) year from date of issue.',
        'Endorsement copy provided for filing with the municipal Public Employment Service Office (PESO).'
      ]
    },
    {
      id: 'katarungang-pambarangay',
      title: 'Katarungang Pambarangay Conciliation',
      category: 'LEGAL & CONCILIATION',
      description: 'Barangay peace-building mediation and dispute conciliation handled by the Lupong Tagapamayapa prior to judicial court litigation.',
      processingTime: '1–3 sessions (within 15 calendar days)',
      fee: 'Free of Charge',
      requirements: [
        'Formal written complaint or blotter incident statement',
        'Valid IDs of complainant and respondent',
        'Relevant supporting evidence (contracts, photographs, or witness sworn statements)'
      ],
      processingInfo: [
        'Issuance of summons by Punong Barangay to both parties within 3 business days.',
        'Mediation conference presided over by Lupon members in the Barangay Session Hall.',
        'Issuance of Amicable Settlement Agreement or Certificate to File Action (KP Form 7).'
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
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
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
                <svg class="service-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
                <span>${s.fee}</span>
              </div>
            </div>

            <button type="button" class="service-view-btn" data-id="${s.id}" aria-label="View details for ${s.title}">
              <span>View details</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Attach click listeners to view detail buttons & cards
    const viewButtons = servicesGridContainer.querySelectorAll('.service-view-btn');
    viewButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const serviceId = btn.getAttribute('data-id');
        showServiceDetail(serviceId);
      });
    });

    const cards = servicesGridContainer.querySelectorAll('.service-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        const id = card.getAttribute('data-id');
        
          console.log('Announcement card clicked. ID:', id);
          console.log('Modal element:', announcementDetailModal);
          console.log('Modal content element:', announcementModalContent);

          if (id) {
            openAnnouncementModal(id);
          }
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
    let currentUserName = 'Juan Dela Cruz';
    let currentUserSitio = 'Sitio Ibaba';
    if (isSessionActive) {
      try {
        const u = JSON.parse(localStorage.getItem('brgy360_user'));
        if (u) {
          if (u.name) currentUserName = u.name;
          if (u.sitio) currentUserSitio = u.sitio;
        }
      } catch (e) {}
    }

    const actionBannerHtml = isSessionActive ? `
      <!-- Action Callout Banner (Logged In) -->
      <div class="detail-action-banner" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
        <div class="action-banner-left">
          <svg class="action-alert-icon" style="color: #16a34a;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <polyline points="9 12 11 14 15 10"></polyline>
          </svg>
          <p class="action-banner-text" style="color: #14532d;">
            You are signed in as <strong>${currentUserName}</strong> (${currentUserSitio} • Verified Resident). Apply online with 1 click.
          </p>
        </div>
        <div class="action-banner-buttons">
          <a href="user.html#services" class="btn-action-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            <span>Apply for ${service.title} in Portal &rarr;</span>
          </a>
        </div>
      </div>
    ` : `
      <!-- Action Callout Banner (Guest) -->
      <div class="detail-action-banner">
        <div class="action-banner-left">
          <svg class="action-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p class="action-banner-text">Please log in or create a resident account to request this service.</p>
        </div>
        <div class="action-banner-buttons">
          <button type="button" class="btn-action-primary" id="detailLoginBtn">Log In to Request</button>
          <button type="button" class="btn-action-secondary" id="detailRegisterBtn">Create Account</button>
        </div>
      </div>
    `;

    serviceDetailView.innerHTML = `
      <!-- Back Navigation -->
      <div class="detail-nav-bar">
        <button type="button" class="btn-back-services" id="btnBackToServices" aria-label="Return to all services">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Back to services</span>
        </button>
      </div>

      <!-- Dark Header Block -->
      <div class="detail-dark-header">
        <span class="detail-category-tag">${service.category}</span>
        <h2 class="detail-main-title">${service.title}</h2>
        <p class="detail-main-desc">${service.description}</p>
      </div>

      <!-- 3-Column Metric Badges Row -->
      <div class="detail-metrics-row">
        <div class="metric-card">
          <div class="metric-icon-box" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="metric-content">
            <span class="metric-label">Processing Time</span>
            <span class="metric-value">${service.processingTime}</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
          </div>
          <div class="metric-content">
            <span class="metric-label">Fee</span>
            <span class="metric-value">${service.fee}</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div class="metric-content">
            <span class="metric-label">Category</span>
            <span class="metric-value">${service.category}</span>
          </div>
        </div>
      </div>

      <!-- Requirements & Processing Info Cards -->
      <div class="detail-content-grid">
        <div class="detail-card">
          <h3 class="detail-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span>Requirements</span>
          </h3>
          <ul class="detail-items-list">
            ${requirementsListHtml}
          </ul>
        </div>

        <div class="detail-card">
          <h3 class="detail-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>Processing Information</span>
          </h3>
          <ul class="detail-items-list">
            ${processingStepsHtml}
          </ul>
        </div>
      </div>

      ${actionBannerHtml}
    `;

    // Toggle views
    servicesGridView.style.display = 'none';
    serviceDetailView.style.display = 'block';

    // Hook back button
    const backBtn = document.getElementById('btnBackToServices');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        serviceDetailView.style.display = 'none';
        servicesGridView.style.display = 'block';
      });
    }

    // Hook Auth buttons to auth modal
    const detailLoginBtn = document.getElementById('detailLoginBtn');
    if (detailLoginBtn) {
      detailLoginBtn.addEventListener('click', function () {
        openAuthModal('login');
      });
    }

    const detailRegisterBtn = document.getElementById('detailRegisterBtn');
    if (detailRegisterBtn) {
      detailRegisterBtn.addEventListener('click', function () {
        openAuthModal('register');
      });
    }

    // Scroll into view smoothly
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Initial render of services
  renderServicesGrid();

  // ==========================================================
  // 12. BUDGET & SPENDING TRANSPARENCY DASHBOARD (LIVE SYNCED)
  // ==========================================================
    let allStoredBudgetRecords = [];
    let budgetRecordsData = [];
    let publicPieChartMode = 'actual'; // 'actual' | 'budget'

    async function loadPublicBudgetFromDatabase() {
    try {
      allStoredBudgetRecords = await fetchBudgetRecords();
      budgetRecordsData = getPublicApplicableBudgetRecords(allStoredBudgetRecords);

      syncPublicBudgetFilterOptions();
      updateBudgetDashboard();
    } catch (error) {
      console.error('Public budget database loading error:', error);
      allStoredBudgetRecords = [];
      budgetRecordsData = [];

      syncPublicBudgetFilterOptions();
      updateBudgetDashboard();
    }
  }

  // DOM Elements for Budget Dashboard
  const budgetYearFilter = document.getElementById('budgetYearFilter');
  const budgetQuarterFilter = document.getElementById('budgetQuarterFilter');
  const budgetCategoryFilter = document.getElementById('budgetCategoryFilter');
  const budgetResetFiltersBtn = document.getElementById('budgetResetFiltersBtn');

  // KPI elements
  const kpiTotalBudget = document.getElementById('kpiTotalBudget');
  const kpiTotalBudgetSub = document.getElementById('kpiTotalBudgetSub');
  const kpiTotalSpending = document.getElementById('kpiTotalSpending');
  const kpiTotalSpendingSub = document.getElementById('kpiTotalSpendingSub');
  const kpiRemainingBudget = document.getElementById('kpiRemainingBudget');
  const kpiRemainingBudgetSub = document.getElementById('kpiRemainingBudgetSub');
  const kpiUtilizationRate = document.getElementById('kpiUtilizationRate');
  const kpiUtilizationRateSub = document.getElementById('kpiUtilizationRateSub');

  // Progress Bar elements
  const utilizationBadge = document.getElementById('utilizationBadge');
  const utilSpentBar = document.getElementById('utilSpentBar');
  const utilRemainingBar = document.getElementById('utilRemainingBar');
  const utilSubtextLabel = document.getElementById('utilSubtextLabel');
  const utilProgressBar = document.getElementById('utilProgressBar');

  // Chart Header & Mode Toggle elements
  const publicPieChartTitle = document.getElementById('publicPieChartTitle');
  const publicPieChartSubtitle = document.getElementById('publicPieChartSubtitle');
  const publicPieChartModeToggle = document.getElementById('publicPieChartModeToggle');

  // Table elements
  const btnToggleBudgetRecords = document.getElementById('btnToggleBudgetRecords');
  const budgetRecordsTableContainer = document.getElementById('budgetRecordsTableContainer');
  const budgetRecordsTbody = document.getElementById('budgetRecordsTbody');
  const budgetTableItemCount = document.getElementById('budgetTableItemCount');
  const toggleRecordsText = document.getElementById('toggleRecordsText');

  function syncPublicBudgetFilterOptions() {
    if (budgetYearFilter) {
      const prevYear = budgetYearFilter.value || '2026';
      const availableYears = getAvailableFiscalYears(allStoredBudgetRecords);
      budgetYearFilter.innerHTML = availableYears
        .map(function (yr) {
          return '<option value="' + escapeBudgetHtml(yr) + '">' + escapeBudgetHtml(yr) + '</option>';
        })
        .join('');
      if (availableYears.includes(prevYear)) {
        budgetYearFilter.value = prevYear;
      } else {
        budgetYearFilter.value = availableYears[0] || '2026';
      }
    }

    if (budgetCategoryFilter) {
      const prevCat = budgetCategoryFilter.value || 'all';
      const baseCats = [...BUDGET_CATEGORIES];
      budgetRecordsData.forEach(function (rec) {
        if (rec.category && !baseCats.includes(rec.category)) {
          baseCats.push(rec.category);
        }
      });
      budgetCategoryFilter.innerHTML =
        '<option value="all">All Categories</option>' +
        baseCats
          .map(function (cat) {
            return '<option value="' + escapeBudgetHtml(cat) + '">' + escapeBudgetHtml(cat) + '</option>';
          })
          .join('');
      if (prevCat === 'all' || baseCats.includes(prevCat)) {
        budgetCategoryFilter.value = prevCat;
      } else {
        budgetCategoryFilter.value = 'all';
      }
    }
  }

  // Chart instances
  let quarterBarChart = null;
  let categoryPieChart = null;

  function initBudgetCharts() {
    if (typeof Chart === 'undefined') return;

    // 1. Dual Bar Chart (Budget vs Actual per Quarter)
    const quarterCanvas = document.getElementById('budgetQuarterBarChart');
    if (quarterCanvas) {
      const ctx1 = quarterCanvas.getContext('2d');
      quarterBarChart = new Chart(ctx1, {
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
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                useBorderRadius: true,
                borderRadius: 3,
                font: { family: 'Poppins', size: 12, weight: 600 },
                color: '#334155',
                padding: 12
              }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleFont: { family: 'Poppins', size: 13, weight: 700 },
              bodyFont: { family: 'Poppins', size: 12 },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: function (context) {
                  return context.dataset.label + ': ' + formatCurrencyPHP(context.raw);
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { family: 'Poppins', size: 12, weight: 600 },
                color: '#475569'
              }
            },
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: {
                font: { family: 'Poppins', size: 11 },
                color: '#64748b',
                callback: function (value) {
                  const num = Number(value) || 0;
                  if (num === 0) return '₱0';
                  if (Math.abs(num) >= 1000000) {
                    const millions = Math.round((num / 1000000) * 100) / 100;
                    return '₱' + millions.toLocaleString('en-PH') + 'M';
                  }
                  return '₱' + Math.round(num / 1000).toLocaleString('en-PH') + 'k';
                }
              }
            }
          }
        }
      });
    }

    // 2. Doughnut / Pie Chart (Spending / Allocation by Category)
    const categoryCanvas = document.getElementById('budgetCategoryPieChart');
    if (categoryCanvas) {
      const ctx2 = categoryCanvas.getContext('2d');
      categoryPieChart = new Chart(ctx2, {
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
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                useBorderRadius: true,
                borderRadius: 5,
                font: { family: 'Poppins', size: 11.5, weight: 500 },
                color: '#334155',
                padding: 14
              }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleFont: { family: 'Poppins', size: 13, weight: 700 },
              bodyFont: { family: 'Poppins', size: 12 },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: function (context) {
                  if (context.label === 'No Active Budget Data') {
                    return ' ₱0 (0%)';
                  }
                  const datasetValues = context.dataset.data || [];
                  const total = datasetValues.reduce(function (a, b) {
                    return a + (Number(b) || 0);
                  }, 0);
                  const rawVal = Number(context.raw) || 0;
                  const pct = total > 0 ? formatPercentValue((rawVal / total) * 100) : '0%';
                  return ' ' + context.label + ': ' + formatCurrencyPHP(rawVal) + ' (' + pct + ')';
                }
              }
            }
          }
        }
      });
    }
  }

  // Update Dashboard, Progress Bar, Charts, and Table from latest saved records
  function updateBudgetDashboard() {
    const selectedYear = budgetYearFilter ? budgetYearFilter.value : '2026';
    const selectedQuarter = budgetQuarterFilter ? budgetQuarterFilter.value : 'all';
    const selectedCategory = budgetCategoryFilter ? budgetCategoryFilter.value : 'all';

    // Show or hide Reset Filters button
    if (budgetResetFiltersBtn) {
      const isFiltered =
        selectedYear !== '2026' || selectedQuarter !== 'all' || selectedCategory !== 'all';
      budgetResetFiltersBtn.style.display = isFiltered ? 'inline-flex' : 'none';
    }

    // Filter applicable public budget line items
    const filteredRecords = budgetRecordsData.filter(function (item) {
      const matchesYear = String(item.year) === String(selectedYear);
      const matchesQuarter = selectedQuarter === 'all' || item.quarter === selectedQuarter;
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesYear && matchesQuarter && matchesCategory;
    });

    // Calculate metrics using canonical formulas:
    // Remaining Budget = Total Annual Budget - Total Spending
    // Utilization Rate = (Total Spending / Total Annual Budget) * 100
    const metrics = computeBudgetMetrics(filteredRecords);

    // Update KPI Metric Values
    if (kpiTotalBudget) kpiTotalBudget.textContent = formatCurrencyPHP(metrics.totalBudget);
    if (kpiTotalSpending) kpiTotalSpending.textContent = formatCurrencyPHP(metrics.totalSpending);
    if (kpiRemainingBudget) kpiRemainingBudget.textContent = formatCurrencyPHP(metrics.remainingBudget);
    if (kpiUtilizationRate) kpiUtilizationRate.textContent = metrics.utilizationText;

    // Update contextual KPI captions
    if (kpiTotalBudgetSub) {
      if (selectedQuarter === 'all' && selectedCategory === 'all') {
        kpiTotalBudgetSub.textContent = 'Appropriated across FY ' + selectedYear + ' quarters';
      } else {
        const parts = ['FY ' + selectedYear];
        if (selectedQuarter !== 'all') parts.push(selectedQuarter);
        if (selectedCategory !== 'all') parts.push(selectedCategory);
        kpiTotalBudgetSub.textContent = 'Allocated for ' + parts.join(' · ');
      }
    }
    if (kpiTotalSpendingSub) {
      kpiTotalSpendingSub.textContent = 'Actual disbursed expenditures';
    }
    if (kpiRemainingBudgetSub) {
      kpiRemainingBudgetSub.textContent =
        metrics.remainingBudget < 0
          ? 'Spending exceeds current allocation'
          : 'Available uncommitted balance';
    }
    if (kpiUtilizationRateSub) {
      kpiUtilizationRateSub.textContent =
        metrics.totalBudget === 0
          ? 'No allocated budget for selection'
          : 'Fiscal disbursement velocity';
    }

    // Update Overall Budget Utilization Progress Bar (matches summary cards 100%)
    if (utilizationBadge) {
      utilizationBadge.textContent = metrics.utilizationText + ' spent';
    }
    if (utilSpentBar) {
      utilSpentBar.style.width = metrics.spentBarPct + '%';
    }
    if (utilRemainingBar) {
      utilRemainingBar.style.width = metrics.remainingBarPct + '%';
    }
    if (utilProgressBar) {
      utilProgressBar.setAttribute('aria-valuenow', String(Math.round(metrics.utilizationRate)));
    }
    if (utilSubtextLabel) {
      utilSubtextLabel.innerHTML =
        '<strong>' +
        formatCurrencyPHP(metrics.totalSpending) +
        '</strong> of <strong>' +
        formatCurrencyPHP(metrics.totalBudget) +
        '</strong> used · <strong>' +
        formatCurrencyPHP(metrics.remainingBudget) +
        '</strong> remaining';
    }

    // Update Records Table
    renderBudgetRecordsTable(filteredRecords);

    // Update Chart 1: Bar Chart (Budget vs Actual per Quarter)
    if (quarterBarChart) {
      const activeQuarters =
        selectedQuarter === 'all' ? [...BUDGET_QUARTERS] : [selectedQuarter];

      const budgetPerQ = activeQuarters.map(function (q) {
        return budgetRecordsData
          .filter(function (it) {
            const matchCat = selectedCategory === 'all' || it.category === selectedCategory;
            return String(it.year) === String(selectedYear) && it.quarter === q && matchCat;
          })
          .reduce(function (sum, it) {
            return sum + (Number(it.budget) || 0);
          }, 0);
      });

      const actualPerQ = activeQuarters.map(function (q) {
        return budgetRecordsData
          .filter(function (it) {
            const matchCat = selectedCategory === 'all' || it.category === selectedCategory;
            return String(it.year) === String(selectedYear) && it.quarter === q && matchCat;
          })
          .reduce(function (sum, it) {
            return sum + (Number(it.actual) || 0);
          }, 0);
      });

      quarterBarChart.data.labels = activeQuarters;
      quarterBarChart.data.datasets[0].data = budgetPerQ;
      quarterBarChart.data.datasets[1].data = actualPerQ;
      quarterBarChart.update();
    }

    // Update Chart 2: Doughnut / Pie Chart (Category Breakdown)
    if (categoryPieChart) {
      const yearCategories = getActiveCategoriesForYear(budgetRecordsData, selectedYear);
      const activeCategories =
        selectedCategory === 'all' ? yearCategories : [selectedCategory];

      const actualPerCat = activeCategories.map(function (cat) {
        return budgetRecordsData
          .filter(function (it) {
            const matchQ = selectedQuarter === 'all' || it.quarter === selectedQuarter;
            return String(it.year) === String(selectedYear) && it.category === cat && matchQ;
          })
          .reduce(function (sum, it) {
            return sum + (Number(it.actual) || 0);
          }, 0);
      });

      const budgetPerCat = activeCategories.map(function (cat) {
        return budgetRecordsData
          .filter(function (it) {
            const matchQ = selectedQuarter === 'all' || it.quarter === selectedQuarter;
            return String(it.year) === String(selectedYear) && it.category === cat && matchQ;
          })
          .reduce(function (sum, it) {
            return sum + (Number(it.budget) || 0);
          }, 0);
      });

      const sumActual = actualPerCat.reduce(function (a, b) { return a + b; }, 0);
      const sumBudget = budgetPerCat.reduce(function (a, b) { return a + b; }, 0);

      let effectiveMode = publicPieChartMode;
      let fallbackToAllocated = false;
      if (effectiveMode === 'actual' && sumActual === 0 && sumBudget > 0) {
        effectiveMode = 'budget';
        fallbackToAllocated = true;
      }

      if (publicPieChartTitle) {
        publicPieChartTitle.textContent =
          effectiveMode === 'budget' ? 'Allocated Budget by Category' : 'Spending by Category';
      }
      if (publicPieChartSubtitle) {
        if (sumActual === 0 && sumBudget === 0) {
          publicPieChartSubtitle.textContent = 'No budget allocations recorded for current filter';
        } else if (fallbackToAllocated) {
          publicPieChartSubtitle.textContent =
            'No disbursements recorded yet — showing allocated budget shares';
        } else if (effectiveMode === 'budget') {
          publicPieChartSubtitle.textContent =
            'Approved budget allocation shares across operational sectors';
        } else {
          publicPieChartSubtitle.textContent =
            'Disbursement breakdown across operational sectors';
        }
      }

      if (sumActual === 0 && sumBudget === 0) {
        categoryPieChart.data.labels = ['No Active Budget Data'];
        categoryPieChart.data.datasets[0].data = [1];
        categoryPieChart.data.datasets[0].backgroundColor = ['#e2e8f0'];
      } else {
        const series = effectiveMode === 'budget' ? budgetPerCat : actualPerCat;
        categoryPieChart.data.labels = activeCategories;
        categoryPieChart.data.datasets[0].data = series;
        categoryPieChart.data.datasets[0].backgroundColor = activeCategories.map(function (c) {
          return BUDGET_CATEGORY_COLORS[c] || '#64748b';
        });
      }
      categoryPieChart.update();
    }
  }

  // Render Table Rows
  function renderBudgetRecordsTable(records) {
    if (!budgetRecordsTbody) return;

    if (budgetTableItemCount) {
      budgetTableItemCount.textContent =
        'Showing ' +
        records.length +
        (records.length === 1 ? ' line item' : ' allocation line items');
    }

    if (records.length === 0) {
      budgetRecordsTbody.innerHTML =
        '<tr><td colspan="6" class="records-empty-state">No budget records found matching the selected filters.</td></tr>';
      return;
    }

    const quarterOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
    const sortedRecords = [...records].sort(function (a, b) {
      if (a.year !== b.year) return Number(b.year) - Number(a.year);
      return (quarterOrder[a.quarter] || 9) - (quarterOrder[b.quarter] || 9);
    });

    const rowsHtml = sortedRecords
      .map(function (item) {
        const budgetVal = Number(item.budget) || 0;
        const actualVal = Number(item.actual) || 0;
        const itemUtilRaw = budgetVal > 0 ? (actualVal / budgetVal) * 100 : 0;
        const itemUtilText = formatPercentValue(itemUtilRaw);

        let utilClass = 'util-text-unspent';
        if (itemUtilRaw >= 90) {
          utilClass = 'util-text-high';
        } else if (itemUtilRaw >= 50) {
          utilClass = 'util-text-moderate';
        } else if (itemUtilRaw > 0) {
          utilClass = 'util-text-low';
        }

        let catDotClass = 'cat-dot-infrastructure';
        if (item.category === 'Health') catDotClass = 'cat-dot-health';
        else if (item.category === 'Administration') catDotClass = 'cat-dot-administration';
        else if (item.category === 'Social Services') catDotClass = 'cat-dot-social';
        else if (item.category === 'Emergency Preparedness') catDotClass = 'cat-dot-emergency';
        else if (item.category === 'Education, Sports & Recreation') catDotClass = 'cat-dot-education';
        else if (item.category === 'Agriculture & Livelihood') catDotClass = 'cat-dot-agriculture';
        else if (item.category === 'Environment & Waste Management') catDotClass = 'cat-dot-environment';

        const statusRaw = String(item.status || 'Active');
        const statusSlug = statusRaw.toLowerCase();
        const statusBadgeHtml =
          statusRaw && statusSlug !== 'active'
            ? '<span class="record-status-inline status-' +
              escapeBudgetHtml(statusSlug) +
              '">' +
              escapeBudgetHtml(statusRaw) +
              '</span>'
            : '';

        const remarksHtml = item.remarks
          ? '<span class="record-remarks-sub">' + escapeBudgetHtml(item.remarks) + '</span>'
          : '';

        return (
          '<tr>' +
          '<td class="col-quarter">' +
          escapeBudgetHtml(item.quarter) +
          ' ' +
          escapeBudgetHtml(item.year) +
          '</td>' +
          '<td class="col-category">' +
          '<span class="category-tag">' +
          '<span class="category-dot ' +
          catDotClass +
          '"></span>' +
          escapeBudgetHtml(item.category) +
          '</span>' +
          '</td>' +
          '<td class="col-desc"><span class="record-desc-main">' +
          escapeBudgetHtml(item.description) +
          '</span>' +
          statusBadgeHtml +
          remarksHtml +
          '</td>' +
          '<td class="col-budget">' +
          formatCurrencyPHP(budgetVal) +
          '</td>' +
          '<td class="col-actual">' +
          formatCurrencyPHP(actualVal) +
          '</td>' +
          '<td class="col-utilization"><span class="' +
          utilClass +
          '">' +
          itemUtilText +
          '</span></td>' +
          '</tr>'
        );
      })
      .join('');

    budgetRecordsTbody.innerHTML = rowsHtml;
  }

  // Toggle Table Visibility
  if (btnToggleBudgetRecords && budgetRecordsTableContainer) {
    btnToggleBudgetRecords.addEventListener('click', function () {
      const isHidden =
        budgetRecordsTableContainer.style.display === 'none' ||
        budgetRecordsTableContainer.style.display === '';
      if (isHidden) {
        budgetRecordsTableContainer.style.display = 'block';
        btnToggleBudgetRecords.classList.add('is-open');
        btnToggleBudgetRecords.setAttribute('aria-expanded', 'true');
        if (toggleRecordsText) toggleRecordsText.textContent = 'Hide Budget Allocation Records';
        budgetRecordsTableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        budgetRecordsTableContainer.style.display = 'none';
        btnToggleBudgetRecords.classList.remove('is-open');
        btnToggleBudgetRecords.setAttribute('aria-expanded', 'false');
        if (toggleRecordsText) toggleRecordsText.textContent = 'View Budget Allocation Records';
      }
    });
  }

  // Pie Chart Mode Toggle (Actual Spending vs Allocated Budget)
  if (publicPieChartModeToggle) {
    publicPieChartModeToggle.querySelectorAll('.chart-mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const mode = btn.getAttribute('data-pie-mode') || 'actual';
        publicPieChartMode = mode;
        publicPieChartModeToggle.querySelectorAll('.chart-mode-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        updateBudgetDashboard();
      });
    });
  }

  // Filter Listeners
  if (budgetYearFilter) {
    budgetYearFilter.addEventListener('change', updateBudgetDashboard);
  }
  if (budgetQuarterFilter) {
    budgetQuarterFilter.addEventListener('change', updateBudgetDashboard);
  }
  if (budgetCategoryFilter) {
    budgetCategoryFilter.addEventListener('change', updateBudgetDashboard);
  }

  // Reset Filters Listener
  if (budgetResetFiltersBtn) {
    budgetResetFiltersBtn.addEventListener('click', function () {
      if (budgetYearFilter) {
        const years = getAvailableFiscalYears(allStoredBudgetRecords);
        budgetYearFilter.value = years.includes('2026') ? '2026' : (years[0] || '2026');
      }
      if (budgetQuarterFilter) budgetQuarterFilter.value = 'all';
      if (budgetCategoryFilter) budgetCategoryFilter.value = 'all';
      updateBudgetDashboard();
    });
  }

// Initialize Public Budget Module & Subscribe to Live Admin Updates
  initBudgetCharts();
  loadPublicBudgetFromDatabase();

  // Refresh public budget data from MySQL when another tab broadcasts an update.
  subscribeBudgetRecords(function () {
    loadPublicBudgetFromDatabase();
  });

  // ==========================================================
  // 13. ANNOUNCEMENTS: CLEAN VERTICAL STACKED CARDS & LIVE SYNC
  // ==========================================================
let announcements = [];
let currentOpenAnnouncementId = null;

// Convert a MySQL announcement record into the format used by the public cards.
function normalizePublicAnnouncement(row) {
  const publishedDate = row.published_at || row.created_at;
  const dateObject = publishedDate ? new Date(publishedDate) : null;

  const formattedDate =
    dateObject && !isNaN(dateObject.getTime())
      ? dateObject.toLocaleDateString('en-PH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
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

// Load published announcements directly from the MySQL API.
async function loadPublicAnnouncements() {
  if (!announcementsCardsFeed) return;

  try {
    announcementsCardsFeed.innerHTML = `
      <div class="announcements-empty-state">
        <p class="announcements-empty-subtitle">Loading announcements...</p>
      </div>
    `;

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
    
    console.log('Loaded announcement records:', announcements);
    console.log('Announcement content:', announcements.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content
    })));

    renderAnnouncementsFeed();

    // Refresh an open announcement modal if its record still exists.
    if (
      currentOpenAnnouncementId &&
      announcementDetailModal &&
      announcementDetailModal.style.display === 'flex'
    ) {
      const updatedItem = announcements.find(function (item) {
        return String(item.id) === String(currentOpenAnnouncementId);
      });

      if (updatedItem) {
        openAnnouncementModal(updatedItem.id);
      } else {
        closeAnnouncementModal();
      }
    }

  } catch (error) {
    console.error('Error loading public announcements:', error);

    announcements = [];

    announcementsCardsFeed.innerHTML = `
      <div class="announcements-empty-state">
        <h4 class="empty-state-title">Unable to load announcements</h4>
        <p class="announcements-empty-subtitle">
          Please check your connection and try again later.
        </p>
        <button type="button" class="btn-reset-filters" id="btnRetryAnnouncements">
          Try Again
        </button>
      </div>
    `;

    const retryButton = document.getElementById('btnRetryAnnouncements');

    if (retryButton) {
      retryButton.addEventListener('click', loadPublicAnnouncements);
    }

    if (announcementsFeedCount) {
      announcementsFeedCount.textContent = '0 Announcements';
    }
  }
}

  // DOM Elements for Announcements
  const announcementsCardsFeed = document.getElementById('announcementsCardsFeed');
  const announcementsSearchInput = document.getElementById('announcementsSearchInput');
  const announcementsSearchClear = document.getElementById('announcementsSearchClear');
  const announcementsCategoryFilter = document.getElementById('announcementsCategoryFilter');
  const announcementsFeedCount = document.getElementById('announcementsFeedCount');
  const announcementDetailModal = document.getElementById('announcementDetailModal');
  const announcementModalContent = document.getElementById('announcementModalContent');
  const closeAnnouncementModalBtn = document.getElementById('closeAnnouncementModalBtn');

  // Filter & Pinned Sorting Logic
  function getFilteredAndSortedAnnouncements() {
    const q = (announcementsSearchInput ? announcementsSearchInput.value : '').trim().toLowerCase();
    const cat = (announcementsCategoryFilter ? announcementsCategoryFilter.value : 'All');

    // 1. Filter active public dataset dynamically
    const filtered = announcements.filter(function (item) {
      if (!item || item.status !== 'Active') return false;
      const itemCategory = String(item.category || 'General');
      const matchesCategory = (cat === 'All' || itemCategory.toLowerCase() === cat.toLowerCase());
      const matchesSearch = (
        q === '' ||
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.summary || '').toLowerCase().includes(q) ||
        String(item.plainContent || '').toLowerCase().includes(q) ||
        itemCategory.toLowerCase().includes(q) ||
        String(item.department || '').toLowerCase().includes(q) ||
        String(item.audience || '').toLowerCase().includes(q)
      );
      return matchesCategory && matchesSearch;
    });

    // 2. Pinned Priority: Active Emergency / Critical Advisories pinned at top, then latest date & broadcast timestamp
    filtered.sort(function (a, b) {
      if (a.isEmergency && !b.isEmergency) return -1;
      if (!a.isEmergency && b.isEmergency) return 1;
      const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCmp !== 0) return dateCmp;
      return (Number(b.publishedAt) || 0) - (Number(a.publishedAt) || 0);
    });

    return filtered;
  }

  // Render Announcement Cards in Single-Column Full-Width Stack
  function renderAnnouncementsFeed() {
    if (!announcementsCardsFeed) return;

    const list = getFilteredAndSortedAnnouncements();

    // Update count display
    if (announcementsFeedCount) {
      announcementsFeedCount.textContent = list.length + (list.length === 1 ? ' Announcement' : ' Announcements');
    }

    // Toggle clear search button
    if (announcementsSearchClear && announcementsSearchInput) {
      announcementsSearchClear.style.display = (announcementsSearchInput.value.trim() !== '') ? 'block' : 'none';
    }

    if (list.length === 0) {
      announcementsCardsFeed.innerHTML = `
        <div class="announcements-empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h4 class="empty-state-title">No announcements found</h4>
          <p class="empty-state-subtitle">No notices match your current search query or category filter.</p>
          <button type="button" class="btn-reset-filters" id="btnResetAnnouncementFilters">Reset All Filters</button>
        </div>
      `;

      const resetBtn = document.getElementById('btnResetAnnouncementFilters');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          if (announcementsSearchInput) announcementsSearchInput.value = '';
          if (announcementsCategoryFilter) announcementsCategoryFilter.value = 'All';
          renderAnnouncementsFeed();
        });
      }
      return;
    }

    const html = list.map(function (item) {
      const safeId = escapeAnnouncementHtml(item.id);
      const safeTitle = escapeAnnouncementHtml(item.title);
      const safeSummary = escapeAnnouncementHtml(item.summary);
      const safeCategory = escapeAnnouncementHtml(item.category);
      const safeDate = escapeAnnouncementHtml(item.date);
      const audienceSuffix =
        item.audience && item.audience !== 'All Residents'
          ? ' · Target: ' + escapeAnnouncementHtml(item.audience)
          : '';
      const safeMetaDept = escapeAnnouncementHtml(item.department) + audienceSuffix;

      if (item.isEmergency) {
        // A. EMERGENCY ANNOUNCEMENT CARD (CRITICAL STYLING)
        return `
          <article class="announcement-card emergency-card" data-id="${safeId}" tabindex="0" role="article" aria-label="${safeTitle}">
            <!-- Red Top Banner Bar -->
            <div class="emergency-top-banner">
              <div class="emergency-banner-left">
                <span class="emergency-banner-icon" aria-hidden="true">⚠️</span>
                <span class="emergency-banner-text">EMERGENCY ADVISORY</span>
              </div>
              <span class="emergency-banner-tag">CRITICAL PRIORITY</span>
            </div>

            <div class="announcement-card-inner">
              <!-- Meta Information Row -->
              <div class="announcement-meta-row">
                <div class="meta-left-group">
                  <span class="meta-category-pill pill-emergency">${safeCategory}</span>
                  <span class="meta-date-item">
                    <time datetime="${safeDate}">${safeDate}</time>
                  </span>
                  <span class="meta-department-text">${safeMetaDept}</span>
                </div>
              </div>

              <!-- Content: Bold title + Descriptive summary -->
              <h3 class="announcement-card-title">${safeTitle}</h3>
              <p class="announcement-card-summary">${safeSummary}</p>
            </div>
          </article>
        `;
      } else {
        // B. STANDARD ANNOUNCEMENT CARDS
        const pillClass = 'pill-' + String(item.category || 'general').toLowerCase().replace(/\s+/g, '-');
        return `
          <article class="announcement-card standard-card" data-id="${safeId}" tabindex="0" role="article" aria-label="${safeTitle}">
            <div class="announcement-card-inner">
              <!-- Meta Information Row -->
              <div class="announcement-meta-row">
                <div class="meta-left-group">
                  <span class="meta-category-pill ${pillClass}">${safeCategory}</span>
                  <span class="meta-date-item">
                    <time datetime="${safeDate}">${safeDate}</time>
                  </span>
                  <span class="meta-department-text">${safeMetaDept}</span>
                </div>
              </div>

              <!-- Content: Bold headline title + Summary text paragraph -->
              <h3 class="announcement-card-title">${safeTitle}</h3>
              <p class="announcement-card-summary">${safeSummary}</p>
            </div>
          </article>
        `;
      }
    }).join('');

    announcementsCardsFeed.innerHTML = html;

    // Attach click listeners to cards
    const cards = announcementsCardsFeed.querySelectorAll('.announcement-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        const id = card.getAttribute('data-id');
        if (id) openAnnouncementModal(id);
      });

      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = card.getAttribute('data-id');
          if (id) openAnnouncementModal(id);
        }
      });
    });
  }

  // Open Detail Modal
  function openAnnouncementModal(id) {
    const item = announcements.find(function (a) { return String(a.id) === String(id); });
    if (!item || !announcementDetailModal || !announcementModalContent) return;

    currentOpenAnnouncementId = String(item.id);

    let headerBannerHtml = '';
    if (item.isEmergency) {
      headerBannerHtml = `
        <div class="announcement-modal-header-banner">
          <span>⚠️ EMERGENCY ADVISORY — MANDATORY ACTION PROTOCOL</span>
        </div>
      `;
    }

    let attachmentHtml = '';
    if (item.attachment && item.attachment.name) {
      const safeAttName = escapeAnnouncementHtml(item.attachment.name);
      const safeAttSize = escapeAnnouncementHtml(item.attachment.size || 'PDF Document');
      attachmentHtml = `
        <div class="modal-attachment-card">
          <div class="modal-attachment-left">
            <div class="modal-attachment-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <div>
              <div class="modal-attachment-name">${safeAttName}</div>
              <div class="modal-attachment-meta">Certified Official Memorandum · ${safeAttSize}</div>
            </div>
          </div>
          <a href="#announcements" class="modal-download-btn js-btn-download-notice" download="${safeAttName}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Download PDF</span>
          </a>
        </div>
      `;
    }

    const pillClass = item.isEmergency
      ? 'pill-emergency'
      : ('pill-' + String(item.category || 'general').toLowerCase().replace(/\s+/g, '-'));
    const safeCategory = escapeAnnouncementHtml(item.category);
    const safeDate = escapeAnnouncementHtml(item.date);
    const safeId = escapeAnnouncementHtml(item.id);
    const safeTitle = escapeAnnouncementHtml(item.title);
    const safeDepartment = escapeAnnouncementHtml(item.department);
    const safeAudience = escapeAnnouncementHtml(item.audience || 'All Residents');

    announcementModalContent.innerHTML = `
      ${headerBannerHtml}
      <div class="announcement-modal-scrollable">
        <div class="modal-meta-bar">
          <div class="meta-left-group">
            <span class="meta-category-pill ${pillClass}">${safeCategory}</span>
            <span class="meta-date-item">
              <span>Published: ${safeDate}</span>
            </span>
          </div>

          <div class="modal-meta-right">
            <span class="modal-reference-number">
              Ref No. ${safeId}
            </span>
          </div>
        </div>

        <h2 class="modal-announcement-title">${safeTitle}</h2>

        <div class="modal-department-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line></svg>
          <span>Issued by: <strong>${safeDepartment}</strong> · Audience: <strong>${safeAudience}</strong></span>
        </div>

        <div class="modal-announcement-body">
          ${item.content || 'No additional announcement details provided.'}
        </div>

        ${attachmentHtml}

      </div>
    `;

      announcementDetailModal.style.display = 'flex';

      requestAnimationFrame(() => {
        announcementDetailModal.classList.add('active');
      });

      announcementDetailModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
  }

  function closeAnnouncementModal() {
      currentOpenAnnouncementId = null;

      if (!announcementDetailModal) return;

      announcementDetailModal.classList.remove('active');
      announcementDetailModal.setAttribute('aria-hidden', 'true');

      document.body.style.overflow = '';
      document.documentElement.style.overflow = 'auto';

      setTimeout(() => {
          if (!announcementDetailModal.classList.contains('active')) {
              announcementDetailModal.style.display = 'none';
          }
      }, 250);
  }

  if (closeAnnouncementModalBtn) {
    closeAnnouncementModalBtn.addEventListener('click', closeAnnouncementModal);
  }

  if (announcementDetailModal) {
    announcementDetailModal.addEventListener('click', function (e) {
      if (e.target === announcementDetailModal) {
        closeAnnouncementModal();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && announcementDetailModal && announcementDetailModal.style.display === 'flex') {
      closeAnnouncementModal();
    }
  });

  // Event Listeners for Search and Category Filter
  if (announcementsSearchInput) {
    announcementsSearchInput.addEventListener('input', function () {
      renderAnnouncementsFeed();
    });
  }

  if (announcementsSearchClear) {
    announcementsSearchClear.addEventListener('click', function () {
      if (announcementsSearchInput) {
        announcementsSearchInput.value = '';
        announcementsSearchInput.focus();
        renderAnnouncementsFeed();
      }
    });
  }

  if (announcementsCategoryFilter) {
    announcementsCategoryFilter.addEventListener('change', function () {
      renderAnnouncementsFeed();
    });
  }

    // Load published announcements from the MySQL database.
    loadPublicAnnouncements();

  // Initial render of announcements feed
  renderAnnouncementsFeed();

  // ==========================================================
  // ANNOUNCEMENT EVENT LISTENERS & INITIALIZATION
  // ==========================================================

  // Close modal using the top-right close button
  if (closeAnnouncementModalBtn) {
    closeAnnouncementModalBtn.addEventListener(
      'click',
      closeAnnouncementModal
    );
  }

  // Close modal when clicking outside the modal card
  if (announcementDetailModal) {
    announcementDetailModal.addEventListener('click', function (e) {
      if (e.target === announcementDetailModal) {
        closeAnnouncementModal();
      }
    });
  }

  // Close modal using Escape key
  document.addEventListener('keydown', function (e) {
    if (
      e.key === 'Escape' &&
      announcementDetailModal &&
      announcementDetailModal.classList.contains('active')
    ) {
      closeAnnouncementModal();
    }
  });

  // Search announcements
  if (announcementsSearchInput) {
    announcementsSearchInput.addEventListener('input', function () {
      renderAnnouncementsFeed();
    });
  }

  // Clear announcement search
  if (announcementsSearchClear) {
    announcementsSearchClear.addEventListener('click', function () {
      if (announcementsSearchInput) {
        announcementsSearchInput.value = '';
      }

      renderAnnouncementsFeed();
    });
  }

  // Filter announcements by category
  if (announcementsCategoryFilter) {
    announcementsCategoryFilter.addEventListener('change', function () {
      renderAnnouncementsFeed();
    });
  }

  // Load announcements from the backend when the homepage opens
  loadPublicAnnouncements();

});


