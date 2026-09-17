import React from 'react';
import { Email } from '../types';
import { CheckCircle2, AlertCircle, Mail, ExternalLink, Send } from 'lucide-react';

interface SentTableProps {
  emails: Email[];
  loading: boolean;
}

export const SentTable: React.FC<SentTableProps> = ({ emails, loading }) => {
  if (loading) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-12 text-center">
        <div className="inline-block animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full mb-3" />
        <p className="text-sm text-slate-400">Loading sent history...</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center mb-3">
          <Send className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">No sent emails yet</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          Once your scheduled jobs execute, sent logs and Ethereal preview links will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-700/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Sent & Delivery History</h3>
        </div>
        <span className="text-xs font-medium text-slate-400">{emails.length} processed</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-700/60">
            <tr>
              <th className="py-3 px-4 font-semibold">Recipient</th>
              <th className="py-3 px-4 font-semibold">Subject</th>
              <th className="py-3 px-4 font-semibold">Sent Timestamp</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Ethereal Preview</th>
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
                  {email.sentAt
                    ? new Date(email.sentAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : new Date(email.updatedAt).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  {email.status === 'sent' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Sent
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Failed
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <a
                    href="https://ethereal.email/messages"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-brand-400 hover:text-brand-300 text-xs font-medium hover:underline"
                  >
                    <span>View Inbox</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
