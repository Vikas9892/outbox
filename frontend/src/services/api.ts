import { Email, Campaign, EmailStats, User, SlackStatus } from '../types';

const API_BASE = 'http://localhost:5000';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Network response error');
  }
  return data;
}

export const api = {
  // Stats
  getStats: async (): Promise<EmailStats> => {
    const res = await fetchJson<{ success: boolean; data: EmailStats }>('/api/emails/stats');
    return res.data;
  },

  // Campaigns
  getCampaigns: async (): Promise<Campaign[]> => {
    const res = await fetchJson<{ success: boolean; data: Campaign[] }>('/api/campaigns');
    return res.data;
  },

  createCampaign: async (payload: {
    subject: string;
    body: string;
    recipients: string[];
    startTime?: string;
    delayMs?: number;
    hourlyLimit?: number;
  }) => {
    return fetchJson<{ success: boolean; message: string; data: any }>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Scheduled & Sent
  getScheduledEmails: async (): Promise<Email[]> => {
    const res = await fetchJson<{ success: boolean; data: Email[] }>('/api/emails/scheduled');
    return res.data;
  },

  getSentEmails: async (): Promise<Email[]> => {
    const res = await fetchJson<{ success: boolean; data: Email[] }>('/api/emails/sent');
    return res.data;
  },

  // Search
  searchEmails: async (q: string): Promise<any[]> => {
    const res = await fetchJson<{ success: boolean; data: any[] }>(`/api/emails/search?q=${encodeURIComponent(q)}`);
    return res.data;
  },

  // Auth
  getMe: async (): Promise<User | null> => {
    try {
      const res = await fetchJson<{ success: boolean; user: User | null }>('/api/auth/me');
      return res.user;
    } catch {
      return null;
    }
  },

  logout: async (): Promise<void> => {
    await fetchJson('/api/auth/logout', { method: 'POST' });
  },

  // Slack
  getSlackStatus: async (): Promise<SlackStatus> => {
    try {
      const res = await fetchJson<{ success: boolean; connected: boolean; teamId?: string }>('/api/auth/slack/status');
      return { connected: res.connected, teamId: res.teamId };
    } catch {
      return { connected: false };
    }
  },

  disconnectSlack: async (): Promise<void> => {
    await fetchJson('/api/auth/slack/disconnect', { method: 'POST' });
  },
};

export default api;
