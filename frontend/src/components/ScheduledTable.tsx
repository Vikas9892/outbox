import React from 'react';
import { Email } from '../types';
import { Calendar, Mail, Clock } from 'lucide-react';

interface ScheduledTableProps {
  emails: Email[];
  loading: boolean;
  onOpenCompose: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onOpenCompose,
}) => {
  if (loading) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-12 text-center">
        <div className="inline-block animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full mb-3" />
        <p className="text-sm text-slate-400">Loading scheduled queue...</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center mb-3">
          <Calendar className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">No scheduled emails yet</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
          All pending emails have either been sent or none have been scheduled yet.
        </p>
        <button
          onClick={onOpenCompose}
          className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition"
        >
          Compose your first campaign
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-700/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Scheduled Queue</h3>
        </div>
        <span className="text-xs font-medium text-slate-400">{emails.length} queued</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-700/60">
            <tr>
              <th className="py-3 px-4 font-semibold">Recipient</th>
              <th className="py-3 px-4 font-semibold">Subject</th>
              <th className="py-3 px-4 font-semibold">Scheduled For</th>
              <th className="py-3 px-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {emails.map((email) => (
              <tr key={email.id} className="hover:bg-slate-700/30 transition">
                <td className="py-3 px-4 font-medium text-slate-200 flex items-center space-x-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate max-w-xs">{email.recipient}</span>
                </td>
                <td className="py-3 px-4 text-slate-300 truncate max-w-xs">{email.subject}</td>
                <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                  {new Date(email.scheduledAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Scheduled
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
