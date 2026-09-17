import { SlackStatus } from '../types';
import { CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { SlackIcon } from './SlackIcon';
import { api } from '../services/api';

interface SettingsViewProps {
  slackStatus: SlackStatus;
  onRefreshSlack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  slackStatus,
  onRefreshSlack,
}) => {
  const handleDisconnectSlack = async () => {
    try {
      await api.disconnectSlack();
      onRefreshSlack();
    } catch (err) {
      console.error('Failed to disconnect Slack:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Integrations Card */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Integrations & Alerting</h3>
        <p className="text-xs text-slate-400 mb-4">
          Connect your communication channels for real-time rate limit alerts.
        </p>

        <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-700 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <SlackIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-white">Slack Notifications</span>
                {slackStatus.connected && (
                  <span className="text-[10px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded-full flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active ({slackStatus.teamId || 'Connected'})</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically receives an alert message when an hourly sender rate limit is hit.
              </p>
            </div>
          </div>

          <div>
            {slackStatus.connected ? (
              <button
                onClick={handleDisconnectSlack}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium px-3 py-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-950/30 transition"
              >
                Disconnect
              </button>
            ) : (
              <a
                href="http://localhost:5000/api/auth/slack"
                className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition inline-flex items-center space-x-1.5"
              >
                <SlackIcon className="w-3.5 h-3.5" />
                <span>Connect Slack</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Engine Architecture & Rate Limit Specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Distributed Rate Limiter
            </h4>
          </div>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
            <li>Atomic Redis Lua check-and-increment window.</li>
            <li>Per-sender minimum spacing (default: 2,000ms).</li>
            <li>Configurable hourly cap (default: 100/hr).</li>
            <li>Zero dropped emails: automatic rescheduling to next window.</li>
          </ul>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5">
          <div className="flex items-center space-x-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Idempotency & Concurrency
            </h4>
          </div>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
            <li>Worker concurrency configurable (default: 5).</li>
            <li>Atomic DB transition: <code className="text-brand-300">scheduled &rarr; processing</code>.</li>
            <li>Deterministic BullMQ job IDs: <code className="text-brand-300">email-&#123;id&#125;</code>.</li>
            <li>Crash recovery sweeper resets stale processing jobs.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
