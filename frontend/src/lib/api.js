// ---------------------------------------------------------------------------
// API client — the frontend's single gateway to the Express backend.
//
// Every request to the backend goes through `request()` so that:
//   1. The JWT session token is attached automatically.
//   2. Errors come back as one predictable shape ({ code, message }).
//
// In development, Vite proxies /api to http://localhost:4000 (see
// vite.config.js). In production, the Express server serves the built
// frontend from the same origin.
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'learnovators_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response — fall through to the generic error below.
  }

  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Something went wrong. Please try again.');
    err.code = data?.error?.code || 'REQUEST_FAILED';
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  google: (credential) => request('/auth/google', { method: 'POST', body: { credential } }),
  googleDemo: () => request('/auth/google-demo', { method: 'POST' }),
  me: () => request('/auth/me'),
  updateProfile: (fields) => request('/users/me', { method: 'PATCH', body: fields }),

  // Onboarding
  saveInterest: (answers) => request('/onboarding/interest', { method: 'POST', body: { answers } }),
  saveAcademic: (profile) => request('/onboarding/academic', { method: 'POST', body: profile }),
  saveMindset: (answers) => request('/onboarding/mindset', { method: 'POST', body: { answers } }),
  setOnboardingStep: (step) => request('/onboarding/step', { method: 'POST', body: { step } }),
  resetOnboarding: () => request('/onboarding/reset', { method: 'POST' }),
  enroll: () => request('/onboarding/enroll', { method: 'POST' }),

  // Results
  recommendations: () => request('/recommendations'),

  // Student portal
  getQuiz: () => request('/portal/quiz'),
  completeQuiz: (answers) => request('/portal/quiz', { method: 'POST', body: { answers } }),
  completeTask: (taskId) => request(`/portal/tasks/${taskId}/complete`, { method: 'POST' }),
  saveJournal: (text) => request('/portal/journal', { method: 'POST', body: { text } }),
  redeem: (itemId) => request('/portal/redeem', { method: 'POST', body: { itemId } }),

  // AI advisor
  advisorChat: (message) => request('/advisor/chat', { method: 'POST', body: { message } }),
};

export default api;
