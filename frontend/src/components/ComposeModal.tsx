import React, { useState } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, FileText, Clock, Gauge, Send } from 'lucide-react';
import { api } from '../services/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CsvStats {
  fileName: string;
  totalRows: number;
  validEmails: string[];
  invalidCount: number;
  duplicateCount: number;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delaySec, setDelaySec] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  const [csvStats, setCsvStats] = useState<CsvStats | null>(null);
  const [manualEmails, setManualEmails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCsvContent(file.name, content);
    };
    reader.readAsText(file);
  };

  const parseCsvContent = (fileName: string, text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const validList: string[] = [];
    const seen = new Set<string>();
    let invalidCount = 0;
    let duplicateCount = 0;

    for (const line of lines) {
      // Split by comma or semicolon
      const tokens = line.split(/[,;\t]/).map((t) => t.trim().replace(/^["']|["']$/g, ''));

      for (const token of tokens) {
        if (!token || token.toLowerCase() === 'email' || token.toLowerCase() === 'recipient') {
          continue; // skip header or empty
        }

        if (EMAIL_REGEX.test(token)) {
          const lower = token.toLowerCase();
          if (seen.has(lower)) {
            duplicateCount++;
          } else {
            seen.add(lower);
            validList.push(lower);
          }
        } else if (token.includes('@')) {
          invalidCount++;
        }
      }
    }

    setCsvStats({
      fileName,
      totalRows: lines.length,
      validEmails: validList,
      invalidCount,
      duplicateCount,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Combine CSV emails and any manual input
    let allRecipients: string[] = csvStats ? [...csvStats.validEmails] : [];

    if (manualEmails.trim()) {
      const parsedManual = manualEmails
        .split(/[,\n]/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_REGEX.test(e));
      allRecipients = Array.from(new Set([...allRecipients, ...parsedManual]));
    }

    if (allRecipients.length === 0) {
      setError('Please upload a CSV with leads or enter at least one valid email address.');
      return;
    }

    if (!subject.trim()) {
      setError('Subject line is required.');
      return;
    }

    if (!body.trim()) {
      setError('Email body is required.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createCampaign({
        subject,
        body,
        recipients: allRecipients,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        delayMs: delaySec * 1000,
        hourlyLimit,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const totalRecipientsCount =
    (csvStats?.validEmails.length || 0) +
    (manualEmails.trim()
      ? manualEmails.split(/[,\n]/).filter((e) => EMAIL_REGEX.test(e.trim())).length
      : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Compose New Campaign</h2>
            <p className="text-xs text-slate-400 mt-0.5">Schedule cold outreach with rate limiting and BullMQ persistence</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              placeholder="e.g. Quick question regarding Outbox Labs..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Body</label>
            <textarea
              rows={4}
              placeholder="Write your email pitch here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          {/* CSV File Upload Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Upload Lead CSV</label>
            <div className="border-2 border-dashed border-slate-700/80 hover:border-brand-500/60 rounded-xl p-4 text-center cursor-pointer transition bg-slate-800/30 relative">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-brand-400 mx-auto mb-1.5" />
              <p className="text-xs text-slate-300 font-medium">
                Click or drag & drop CSV with email leads
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Supports CSV with headers or plain email lists</p>
            </div>

            {/* CSV Lead Statistics */}
            {csvStats && (
              <div className="mt-3 p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
                <div className="flex items-center space-x-2 text-xs text-slate-300 mb-2">
                  <FileText className="w-4 h-4 text-brand-400" />
                  <span className="font-semibold truncate">{csvStats.fileName}</span>
                  <span className="text-slate-500">({csvStats.totalRows} rows)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-lg p-2">
                    <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Valid Leads</span>
                    <strong className="text-emerald-300 text-sm">{csvStats.validEmails.length}</strong>
                  </div>
                  <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-2">
                    <span className="text-[10px] text-amber-400 uppercase font-semibold block">Duplicates Removed</span>
                    <strong className="text-amber-300 text-sm">{csvStats.duplicateCount}</strong>
                  </div>
                  <div className="bg-rose-950/30 border border-rose-800/30 rounded-lg p-2">
                    <span className="text-[10px] text-rose-400 uppercase font-semibold block">Invalid Emails</span>
                    <strong className="text-rose-300 text-sm">{csvStats.invalidCount}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Timing & Rate Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
              <span className="text-[10px] text-slate-500">Defaults to immediate</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Delay Between Sends</label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={delaySec}
                  onChange={(e) => setDelaySec(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
                <span className="text-xs text-slate-400">sec</span>
              </div>
              <span className="text-[10px] text-slate-500">Provider pacing</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Hourly Rate Limit</label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 100)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
                <span className="text-xs text-slate-400">/hr</span>
              </div>
              <span className="text-[10px] text-slate-500">Sender hourly quota</span>
            </div>
          </div>

          {/* Schedule Summary Banner */}
          {totalRecipientsCount > 0 && (
            <div className="p-3 bg-brand-950/40 border border-brand-800/40 rounded-xl text-xs text-brand-300 flex items-center justify-between">
              <div>
                <strong>{totalRecipientsCount.toLocaleString()} emails</strong> scheduled
                {startTime ? ` starting at ${new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' immediately'},{' '}
                {delaySec}s between sends, {hourlyLimit}/hr cap.
              </div>
            </div>
          )}

          {/* Footer CTA */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Schedule Emails</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
