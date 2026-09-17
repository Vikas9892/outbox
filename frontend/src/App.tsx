import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { StatCard } from './components/StatCard';
import { CampaignProgress } from './components/CampaignProgress';
import { ScheduledTable } from './components/ScheduledTable';
import { SentTable } from './components/SentTable';
import { SearchView } from './components/SearchView';
import { SettingsView } from './components/SettingsView';
import { ComposeModal } from './components/ComposeModal';
import { api } from './services/api';
import { User, EmailStats, Campaign, Email, SlackStatus } from './types';
import { Clock, Send, CheckCircle2, AlertCircle, RefreshCw, LayoutDashboard, Search, Settings } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus>({ connected: false });
  const [stats, setStats] = useState<EmailStats>({
    scheduled: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    total: 0,
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);

  const [activeTab, setActiveTab] = useState<'overview' | 'scheduled' | 'sent' | 'search' | 'settings'>('overview');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initial load
  const loadData = async () => {
    try {
      const [u, slack, s, camps, sched, sent] = await Promise.all([
        api.getMe(),
        api.getSlackStatus(),
        api.getStats(),
        api.getCampaigns(),
        api.getScheduledEmails(),
        api.getSentEmails(),
      ]);

      setUser(u);
      setSlackStatus(slack);
      setStats(s);
      setCampaigns(camps);
      setScheduledEmails(sched);
      setSentEmails(sent);
    } catch (err) {
      console.error('Data loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Check for query params (e.g. ?slack=connected)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('slack') === 'connected') {
      setToastMessage('Slack workspace successfully connected!');
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Auto-refresh stats every 4 seconds to observe real-time job processing
    const interval = setInterval(() => {
      api.getStats().then(setStats).catch(() => {});
      api.getCampaigns().then(setCampaigns).catch(() => {});
      api.getScheduledEmails().then(setScheduledEmails).catch(() => {});
      api.getSentEmails().then(setSentEmails).catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  const handleCampaignCreated = () => {
    setToastMessage('Campaign successfully scheduled and queued into BullMQ!');
    loadData();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Navbar */}
      <Navbar
        user={user}
        slackStatus={slackStatus}
        onLogout={handleLogout}
        onOpenCompose={() => setIsComposeOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Toast alert */}
        {toastMessage && (
          <div className="bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 px-4 py-3 rounded-xl text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-400 hover:text-emerald-200 font-bold ml-4"
            >
              &times;
            </button>
          </div>
        )}

        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Email Operations Dashboard</h1>
            <p className="text-xs text-slate-400 mt-1">
              Persistent BullMQ delayed job scheduler &middot; Redis rate limiting &middot; Multi-worker concurrency
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              title="Refresh Dashboard"
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsComposeOpen(true)}
              className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-md shadow-brand-600/30 transition flex items-center space-x-2"
            >
              <span>+ Compose Campaign</span>
            </button>
          </div>
        </div>

        {/* Top 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Scheduled"
            value={stats.scheduled}
            icon={Clock}
            color="amber"
            subtext="Awaiting delivery window"
          />
          <StatCard
            title="Processing"
            value={stats.processing}
            icon={Send}
            color="blue"
            subtext="Claimed by worker"
          />
          <StatCard
            title="Sent"
            value={stats.sent}
            icon={CheckCircle2}
            color="emerald"
            subtext="Delivered via Ethereal SMTP"
          />
          <StatCard
            title="Failed"
            value={stats.failed}
            icon={AlertCircle}
            color="rose"
            subtext="Permanent delivery errors"
          />
        </div>

        {/* Active Campaign Timeline / Progress Card */}
        {campaigns.length > 0 && <CampaignProgress campaigns={campaigns} />}

        {/* Tab Navigation */}
        <div className="border-b border-slate-800 flex items-center space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('scheduled')}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'scheduled'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Scheduled Queue ({scheduledEmails.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'sent'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Sent History ({sentEmails.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'search'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'settings'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings & Integrations</span>
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScheduledTable
                emails={scheduledEmails.slice(0, 8)}
                loading={loading}
                onOpenCompose={() => setIsComposeOpen(true)}
              />
              <SentTable
                emails={sentEmails.slice(0, 8)}
                loading={loading}
              />
            </div>
          )}

          {activeTab === 'scheduled' && (
            <ScheduledTable
              emails={scheduledEmails}
              loading={loading}
              onOpenCompose={() => setIsComposeOpen(true)}
            />
          )}

          {activeTab === 'sent' && (
            <SentTable
              emails={sentEmails}
              loading={loading}
            />
          )}

          {activeTab === 'search' && <SearchView />}

          {activeTab === 'settings' && (
            <SettingsView
              slackStatus={slackStatus}
              onRefreshSlack={() => api.getSlackStatus().then(setSlackStatus)}
            />
          )}
        </div>
      </main>

      {/* Compose Campaign Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleCampaignCreated}
      />
    </div>
  );
}

export default App;
