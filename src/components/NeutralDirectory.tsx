'use client';

import React, { useState } from 'react';
import { NEUTRAL_RATE_DIRECTORY } from '@/lib/neutral-directory';
import { ExternalLink, ArrowUpDown, ShieldCheck } from 'lucide-react';

export const NeutralDirectory: React.FC = () => {
  const [sortKey, setSortKey] = useState<'name' | '1yr' | 'penalty'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: 'name' | '1yr' | 'penalty') => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedData = [...NEUTRAL_RATE_DIRECTORY].sort((a, b) => {
    if (sortKey === 'name') {
      return sortOrder === 'asc'
        ? a.institutionName.localeCompare(b.institutionName)
        : b.institutionName.localeCompare(a.institutionName);
    }
    if (sortKey === '1yr') {
      return sortOrder === 'asc'
        ? a.oneYearFdRate - b.oneYearFdRate
        : b.oneYearFdRate - a.oneYearFdRate;
    }
    if (sortKey === 'penalty') {
      return sortOrder === 'asc'
        ? a.prematurePenaltyPercent - b.prematurePenaltyPercent
        : b.prematurePenaltyPercent - a.prematurePenaltyPercent;
    }
    return 0;
  });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Prominent Trust Banner */}
      <div className="glass-obsidian-sunset border border-amber-500/30 rounded-3xl p-6 text-white shadow-glow flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
        
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2.5 font-black text-base text-white tracking-tight">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Neutral Public Rate Reference Standard</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-amber-300">Zero sponsored placements • Zero affiliate kickbacks • Alphabetical default ordering</strong>
          </p>
        </div>
        <div className="text-[11px] font-mono px-3.5 py-1.5 bg-obsidian-850/90 rounded-full border border-white/10 text-amber-300 self-start sm:self-auto shrink-0 shadow-sm z-10">
          Verified Public Data • August 2026
        </div>
      </div>

      {/* Directory Table Card */}
      <div className="glass-obsidian border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-obsidian-850/90 text-slate-300 border-b border-white/10 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Institution
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-4">Category</th>
                <th
                  onClick={() => handleSort('1yr')}
                  className="px-4 py-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    1-Year Rate
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('penalty')}
                  className="px-4 py-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Early Exit Penalty
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-4">Sr. Citizen (+%)</th>
                <th className="px-6 py-4 text-right">Direct Official Portal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-6 py-4.5 font-bold text-white">
                    {item.institutionName}
                  </td>
                  <td className="px-4 py-4.5">
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-obsidian-800 border border-white/10 text-slate-300">
                      {item.institutionType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4.5 font-black text-emerald-400 text-sm font-mono">
                    {item.oneYearFdRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-4.5 font-semibold text-red-400 font-mono">
                    {item.prematurePenaltyPercent.toFixed(2)}%
                  </td>
                  <td className="px-4 py-4.5 text-slate-400 font-mono">
                    +{item.seniorCitizenBonusPercent.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4.5 text-right">
                    <a
                      href={item.officialDirectPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline"
                    >
                      <span>Direct Official Portal</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
