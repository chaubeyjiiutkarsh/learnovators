import { Link } from 'react-router-dom';

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

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm">
            <GradCapIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-serif font-semibold text-xl text-slate-900 group-hover:text-teal-700 transition-colors">
            Learnovators
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-3">
          <Link to="/auth" className="btn-ghost text-sm">
            Log in
          </Link>
          <Link to="/auth?tab=signup" className="btn-primary text-sm py-2 px-5">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
