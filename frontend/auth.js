/**
 * Brgy360 - Universal Dual-Role Authentication & Route Guard (auth.js)
 * Barangay Pallocan West, Batangas City
 */

(function () {
  'use strict';

  // Hardcoded Pre-Configured Credentials
  const PRECONFIGURED_ACCOUNTS = {
    admin: {
      email: 'admin@brgy360.gov.ph',
      password: 'AdminPassword360!',
      role: 'admin',
      name: 'Ma. Victoria M. Marasigan',
      title: 'Barangay Secretary (Admin)',
      targetUrl: 'admin.html'
    },
    resident: {
      email: 'juan@gmail.com',
      password: 'UserPassword360!',
      role: 'resident',
      name: 'Juan Dela Cruz',
      title: 'Verified Resident (Sitio Ibaba)',
      targetUrl: 'user.html'
    }
  };

  /**
   * Check route protection on page load
   */
  function guardRoute() {
    const path = window.location.pathname;
    const isLocalAdmin = path.endsWith('admin.html') || path.includes('/admin.html');
    const isLocalUser = path.endsWith('user.html') || path.includes('/user.html');
    const currentRole = localStorage.getItem('currentUserRole');

    if (isLocalAdmin) {
      if (currentRole === 'resident') {
        // Resident attempting to enter Admin Console directly
        window.location.href = 'index.html?auth=denied&role=resident';
        return;
      }
      // If not logged in at all, allow admin preview or redirect if strict
    }

    if (isLocalUser) {
      // Resident portal is open to resident or admin inspecting resident view
    }
  }

  /**
   * Unified Authentication login verification
   */
  function authenticate(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    const adminPwd = localStorage.getItem('brgy360_pwd_admin@brgy360.gov.ph') || PRECONFIGURED_ACCOUNTS.admin.password;
    if (cleanEmail === PRECONFIGURED_ACCOUNTS.admin.email.toLowerCase() && cleanPass === adminPwd) {
      localStorage.setItem('currentUserRole', 'admin');
      localStorage.setItem('brgy360_session', JSON.stringify({
        role: 'admin',
        email: PRECONFIGURED_ACCOUNTS.admin.email,
        name: PRECONFIGURED_ACCOUNTS.admin.name,
        loginTime: new Date().toISOString()
      }));
      return { success: true, role: 'admin', redirect: 'admin.html', user: PRECONFIGURED_ACCOUNTS.admin };
    }

    // Resident authentication (supporting changed passwords and registered users)
    try {
      const storedUsers = JSON.parse(localStorage.getItem('brgy360_residents_db') || '[]');
      let found = storedUsers.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
      const isJuan = (cleanEmail === 'juan@gmail.com' || cleanEmail === 'juan.delacruz@example.com');
      if (!found && isJuan) {
        found = storedUsers.find(u => u.email && (u.email.trim().toLowerCase() === 'juan@gmail.com' || u.email.trim().toLowerCase() === 'juan.delacruz@example.com'));
      }

      // Determine expected password for this resident
      let expectedPass = localStorage.getItem('brgy360_pwd_' + cleanEmail);
      if (!expectedPass && isJuan) {
        expectedPass = localStorage.getItem('brgy360_pwd_juan@gmail.com') || localStorage.getItem('brgy360_pwd_juan.delacruz@example.com');
      }
      if (!expectedPass && found && found.password) {
        expectedPass = found.password;
      }
      if (!expectedPass) {
        try {
          const storedU = JSON.parse(localStorage.getItem('brgy360_user') || '{}');
          if (storedU && storedU.password && (storedU.email?.toLowerCase() === cleanEmail || (isJuan && (storedU.email?.toLowerCase() === 'juan@gmail.com' || storedU.email?.toLowerCase() === 'juan.delacruz@example.com')))) {
            expectedPass = storedU.password;
          }
        } catch (e) {}
      }
      if (!expectedPass && isJuan) {
        expectedPass = PRECONFIGURED_ACCOUNTS.resident.password;
      }

      if (expectedPass && cleanPass === expectedPass) {
        if (!found) {
          found = {
            ...PRECONFIGURED_ACCOUNTS.resident,
            email: cleanEmail,
            password: cleanPass,
            status: 'Verified',
            verified: true
          };
        }

        // Enforce admin verification prerequisite
        if (found.status === 'Pending' || found.verified === false) {
          return {
            success: false,
            status: 'Pending',
            message: 'Your registration is currently pending admin verification. An administrator must verify your submitted ID and documents before your account is activated.'
          };
        }
        if (found.status === 'Rejected') {
          return {
            success: false,
            status: 'Rejected',
            message: 'Your account registration was declined by the administrator: ' + (found.rejectionReason || 'Document verification could not be completed.')
          };
        }

        localStorage.setItem('currentUserRole', 'resident');
        localStorage.setItem('brgy360_session', JSON.stringify({
          role: 'resident',
          email: found.email || cleanEmail,
          name: found.fullName || found.name || 'Resident User',
          loginTime: new Date().toISOString()
        }));
        localStorage.setItem('brgy360_user', JSON.stringify({
          ...found,
          password: cleanPass
        }));
        return { success: true, role: 'resident', redirect: 'user.html', user: found };
      }
    } catch (e) {
      console.warn('Error reading stored users:', e);
    }

    return { success: false, message: 'Invalid credentials. Please verify your email and password.' };
  }

  /**
   * Unified Logout function
   */
  function logout(redirectUrl = 'index.html') {
    localStorage.removeItem('currentUserRole');
    localStorage.removeItem('brgy360_session');
    window.location.href = redirectUrl;
  }

  /**
   * Universal Password Visibility Toggle Handler
   */
  function handlePasswordToggle(e) {
    const btn = e.target.closest('.password-toggle-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const targetId = btn.getAttribute('data-target');
    let input = targetId ? document.getElementById(targetId) : null;
    if (!input) {
      const wrapper = btn.closest('.auth-input-wrapper, .portal-password-wrapper, .password-field-wrapper') || btn.parentElement;
      input = wrapper ? wrapper.querySelector('input') : null;
    }
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    const showIcon = btn.querySelector('.eye-show');
    const hideIcon = btn.querySelector('.eye-hide');

    if (showIcon) showIcon.style.display = isPassword ? 'none' : 'block';
    if (hideIcon) hideIcon.style.display = isPassword ? 'block' : 'none';

    btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    btn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
    btn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', handlePasswordToggle);
  }

  // Run Route Guard immediately
  guardRoute();

  // Export to window
  window.Brgy360Auth = {
    accounts: PRECONFIGURED_ACCOUNTS,
    authenticate: authenticate,
    logout: logout,
    guardRoute: guardRoute,
    handlePasswordToggle: handlePasswordToggle
  };
})();
