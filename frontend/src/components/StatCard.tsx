import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: 'amber' | 'blue' | 'emerald' | 'rose' | 'purple';
  subtext?: string;
}

const colorMap = {
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'text-amber-400',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-400',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
  },
  rose: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    icon: 'text-rose-400',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    icon: 'text-purple-400',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  subtext,
}) => {
  const styles = colorMap[color];

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/80 rounded-xl p-5 shadow-sm hover:border-slate-600 transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">{title}</p>
          <p className="text-2xl font-bold text-white mt-1.5">{value.toLocaleString()}</p>
          {subtext && <p className="text-[11px] text-slate-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl ${styles.bg} border ${styles.border}`}>
          <Icon className={`w-5 h-5 ${styles.icon}`} />
        </div>
      </div>
    </div>
  );
};
