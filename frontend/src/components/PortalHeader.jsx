import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProfileModal from './ProfileModal';

function GradCapIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

export default function PortalHeader() {
  const { currentUser, userDoc, logout, updateProfile, resetOnboarding } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  async function handleRetake() {
    // Clears the assessment answers + enrollment on the server and restarts
    // the onboarding flow (the modal navigates to /onboarding).
    await resetOnboarding();
  }

  const coins = userDoc?.coins ?? 0;
  const name = userDoc?.name || currentUser?.displayName || 'Student';
  const firstName = name.split(' ')[0];

  const isPortal = location.pathname === '/portal';
  const isBlueprint = location.pathname === '/results';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Brand & Navigation */}
          <div className="flex items-center gap-6">
            <Link to="/portal" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm">
                <GradCapIcon className="w-5 h-5 text-white" />
              </div>
              <span className="font-serif font-bold text-xl text-slate-900 group-hover:text-teal-700 transition-colors">
                Learnovators
              </span>
            </Link>

            {/* Nav tabs for enrolled students */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <Link
                to="/portal"
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  isPortal
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Student Portal
              </Link>
              <Link
                to="/results"
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  isBlueprint
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Career Blueprint
              </Link>
            </nav>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Live Coin badge */}
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs sm:text-sm px-3 py-1.5 rounded-full shadow-sm">
              <svg className="w-4 h-4 text-emerald-600 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v1M12 17v1M8.5 9.5l.7.7M14.8 14.8l.7.7M7 12h1M16 12h1M8.5 14.5l.7-.7M14.8 9.2l.7-.7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>{coins} coins</span>
            </div>

            {/* Profile Settings button */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="btn-ghost text-xs py-1.5 px-2.5 sm:px-3 text-slate-700 font-semibold border border-slate-200"
              title="Profile & Settings"
            >
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">⚙️</span>
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="btn-ghost text-xs py-1.5 px-2.5 sm:px-3 text-slate-500 hover:text-slate-800"
            >
              Log out
            </button>
          </div>
        </div>

        {/* Mobile secondary tab bar */}
        <div className="md:hidden flex border-t border-slate-200 bg-slate-50 px-4 py-2 justify-around text-xs font-semibold">
          <Link
            to="/portal"
            className={`py-1 px-3 rounded-lg ${isPortal ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}
          >
            Portal
          </Link>
          <Link
            to="/results"
            className={`py-1 px-3 rounded-lg ${isBlueprint ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}
          >
            Career Blueprint
          </Link>
        </div>
      </header>

      {/* Settings Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userDoc={userDoc}
        onUpdateProfile={updateProfile}
        onRetakeAssessment={handleRetake}
      />
    </>
  );
}
