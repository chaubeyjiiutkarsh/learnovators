import { createContext, useContext, useEffect, useState } from 'react';
import api, { setToken, clearToken, getToken } from '../lib/api';

// ---------------------------------------------------------------------------
// AuthContext — session + user profile state for the whole app.
//
// It talks to the Express backend through lib/api.js:
//   • The JWT token is kept in localStorage and sent with every request.
//   • On startup we restore the session by calling GET /api/auth/me.
//   • Every mutation (onboarding answers, quiz, tasks, redemption…) returns
//     the fresh user object from the server, which we store in `userDoc` —
//     so the UI always shows server-truth data.
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // { uid, email, displayName }
  const [userDoc, setUserDoc] = useState(null); // full profile from the API
  const [loading, setLoading] = useState(true);

  function applySession({ token, user }) {
    setToken(token);
    setCurrentUser({ uid: user.id, email: user.email, displayName: user.name });
    setUserDoc(user);
  }

  function applyUser(user) {
    setUserDoc(user);
  }

  // Restore the session on first load (persistence across visits)
  useEffect(() => {
    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await api.me();
        setCurrentUser({ uid: user.id, email: user.email, displayName: user.name });
        setUserDoc(user);
      } catch {
        // Invalid/expired token — clear it and stay logged out
        clearToken();
      } finally {
        setLoading(false);
      }
    }
    restore();
  }, []);

  // ------------------------------------------------------------------
  // Auth methods
  // ------------------------------------------------------------------

  async function signup(email, password, name, educationLevel, college) {
    const session = await api.signup({
      email,
      password,
      name,
      educationLevel,
      college,
    });
    applySession(session);
    return session;
  }

  async function login(email, password) {
    const session = await api.login(email, password);
    applySession(session);
    return session;
  }

  // With a credential: real Google Identity Services sign-in.
  // Without one: the backend's demo account (used when no OAuth client ID
  // is configured) — still a full, real login through the API.
  async function loginWithGoogle(credential) {
    const session = credential
      ? await api.google(credential)
      : await api.googleDemo();
    applySession(session);
    return session;
  }

  async function logout() {
    clearToken();
    setCurrentUser(null);
    setUserDoc(null);
  }

  // ------------------------------------------------------------------
  // Onboarding methods — each returns/updates the fresh userDoc
  // ------------------------------------------------------------------

  async function saveInterestStep(answers) {
    const { user } = await api.saveInterest(answers);
    applyUser(user);
    return user;
  }

  async function saveAcademicStep(profile) {
    const { user } = await api.saveAcademic(profile);
    applyUser(user);
    return user;
  }

  async function saveMindsetStep(answers) {
    const { user } = await api.saveMindset(answers);
    applyUser(user);
    return user;
  }

  async function setOnboardingStep(step) {
    const { user } = await api.setOnboardingStep(step);
    applyUser(user);
    return user;
  }

  async function resetOnboarding() {
    const { user } = await api.resetOnboarding();
    applyUser(user);
    return user;
  }

  async function enroll() {
    const { user } = await api.enroll();
    applyUser(user);
    return user;
  }

  // ------------------------------------------------------------------
  // Portal methods
  // ------------------------------------------------------------------

  async function completeQuiz(answers) {
    const res = await api.completeQuiz(answers);
    applyUser(res.user);
    return res; // { score, total, awarded, user }
  }

  async function completeTask(taskId) {
    const res = await api.completeTask(taskId);
    applyUser(res.user);
    return res; // { awarded, user }
  }

  async function saveJournalEntry(text) {
    const res = await api.saveJournal(text);
    applyUser(res.user);
    return res; // { awarded, entry, user }
  }

  async function redeem(itemId) {
    const res = await api.redeem(itemId);
    applyUser(res.user);
    return res; // { voucherCode, user }
  }

  async function refreshUser() {
    const { user } = await api.me();
    applyUser(user);
    return user;
  }

  async function updateProfile(fields) {
    const { user } = await api.updateProfile(fields);
    applyUser(user);
    return user;
  }

  const value = {
    currentUser,
    userDoc,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    saveInterestStep,
    saveAcademicStep,
    saveMindsetStep,
    setOnboardingStep,
    resetOnboarding,
    enroll,
    completeQuiz,
    completeTask,
    saveJournalEntry,
    redeem,
    refreshUser,
    updateProfile,
    // Direct passthroughs used by the Results page and AI advisor chat
    getRecommendations: api.recommendations,
    sendAdvisorMessage: api.advisorChat,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
