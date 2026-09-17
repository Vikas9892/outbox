import React, { useState } from 'react';
import { Search, Mail, ExternalLink, Database, Cpu } from 'lucide-react';
import { api } from '../services/api';

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const data = await api.searchEmails(query);
      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search emails by recipient, subject, or status (e.g. sent, scheduled)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition flex items-center space-x-1.5"
        >
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          <span>Search</span>
        </button>
      </form>

      {/* Results Header */}
      {searched && (
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>Found {results.length} result(s) for &ldquo;{query}&rdquo;</span>
          <span className="flex items-center space-x-1 text-[11px] text-slate-500">
            <Cpu className="w-3 h-3 text-brand-400" />
            <span>Indexed via Elasticsearch with DB Fallback</span>
          </span>
        </div>
      )}

      {/* Results Table / List */}
      {searched && results.length === 0 && !loading && (
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-12 text-center">
          <p className="text-sm font-semibold text-slate-200">No emails matched your query</p>
          <p className="text-xs text-slate-400 mt-1">Try searching by recipient domain or subject keyword.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-700/60">
              <tr>
                <th className="py-3 px-4 font-semibold">Recipient</th>
                <th className="py-3 px-4 font-semibold">Subject</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Source Engine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {results.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-700/30 transition">
                  <td className="py-3 px-4 font-medium text-slate-200 flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate max-w-xs">{item.recipient}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 truncate max-w-xs">{item.subject}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        item.status === 'sent'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center space-x-1 text-[11px] text-slate-400">
                      {item.source === 'elasticsearch' ? (
                        <>
                          <Cpu className="w-3 h-3 text-brand-400" />
                          <span>Elasticsearch</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-3 h-3 text-blue-400" />
                          <span>PostgreSQL Fallback</span>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
