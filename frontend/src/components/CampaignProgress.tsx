import React from 'react';
import { Campaign } from '../types';
import { Layers, Calendar, Clock, Gauge } from 'lucide-react';

interface CampaignProgressProps {
  campaigns: Campaign[];
}

export const CampaignProgress: React.FC<CampaignProgressProps> = ({ campaigns }) => {
  if (campaigns.length === 0) {
    return null;
  }

  const activeCampaign = campaigns[0]; // Most recent campaign

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400 font-semibold border border-brand-500/20">
              Active Campaign
            </span>
            <h3 className="text-base font-semibold text-white truncate">{activeCampaign.subject}</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 line-clamp-1">{activeCampaign.body}</p>
        </div>

        {/* Campaign Timing Metrics */}
        <div className="flex items-center space-x-4 text-xs text-slate-400">
          <div className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Delay: {activeCampaign.delayMs / 1000}s</span>
          </div>
          <div className="flex items-center space-x-1">
            <Gauge className="w-3.5 h-3.5 text-slate-500" />
            <span>Limit: {activeCampaign.hourlyLimit}/hr</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{new Date(activeCampaign.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>
            Progress: <strong className="text-slate-200">{activeCampaign.progressPercent}%</strong> ({activeCampaign.counts.sent + activeCampaign.counts.failed} of {activeCampaign.counts.total} processed)
          </span>
          <span className="text-slate-400">
            Remaining: <strong className="text-amber-400">{activeCampaign.counts.scheduled + activeCampaign.counts.processing}</strong>
          </span>
        </div>
        <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-700/60 flex">
          <div
            className="bg-gradient-to-r from-brand-600 to-indigo-500 h-full transition-all duration-500"
            style={{ width: `${activeCampaign.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Status Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-700/60">
        <div className="flex items-center space-x-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span className="text-slate-400">Scheduled:</span>
          <strong className="text-slate-200">{activeCampaign.counts.scheduled}</strong>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <span className="text-slate-400">Processing:</span>
          <strong className="text-slate-200">{activeCampaign.counts.processing}</strong>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-slate-400">Sent:</span>
          <strong className="text-slate-200">{activeCampaign.counts.sent}</strong>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-rose-400"></span>
          <span className="text-slate-400">Failed:</span>
          <strong className="text-slate-200">{activeCampaign.counts.failed}</strong>
        </div>
      </div>
    </div>
  );
};
