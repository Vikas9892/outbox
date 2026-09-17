import { User, SlackStatus } from '../types';
import { Send, Activity, ExternalLink, LogOut, CheckCircle2 } from 'lucide-react';
import { SlackIcon } from './SlackIcon';

interface NavbarProps {
  user: User | null;
  slackStatus: SlackStatus;
  onLogout: () => void;
  onOpenCompose: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  slackStatus,
  onLogout,
  onOpenCompose,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Send className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-100 text-lg tracking-tight">ReachInbox</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-medium border border-brand-500/20">
                Scheduler
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Cold Email Job Engine</p>
          </div>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Bull Board Queue Link */}
          <a
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center space-x-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 px-3 py-1.5 rounded-lg border border-slate-700 transition"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Bull Board</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {/* Slack Connection Status */}
          {slackStatus.connected ? (
            <div className="flex items-center space-x-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Slack</span> Connected
            </div>
          ) : (
            <a
              href="http://localhost:5000/api/auth/slack"
              className="flex items-center space-x-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <SlackIcon className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Connect</span> Slack
            </a>
          )}

          {/* Compose CTA */}
          <button
            onClick={onOpenCompose}
            className="bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-lg shadow-sm shadow-brand-500/30 transition flex items-center space-x-1.5"
          >
            <span>+</span>
            <span>Compose Campaign</span>
          </button>

          {/* User Profile */}
          {user ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <img
                src={user.avatarUrl || 'https://avatars.githubusercontent.com/u/9892?v=4'}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-slate-700 object-cover"
              />
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-slate-200 leading-none">{user.name}</div>
                <div className="text-[10px] text-slate-400 leading-none mt-1">{user.email}</div>
              </div>
              <button
                onClick={onLogout}
                title="Logout"
                className="text-slate-400 hover:text-rose-400 p-1 rounded-md transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <a
              href="http://localhost:5000/api/auth/google"
              className="text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              Sign In
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
