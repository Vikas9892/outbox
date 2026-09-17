export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Email {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'scheduled' | 'processing' | 'sent' | 'failed';
  attempts: number;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    email: string;
  };
}

export interface CampaignCounts {
  total: number;
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
}

export interface Campaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  createdAt: string;
  counts: CampaignCounts;
  progressPercent: number;
}

export interface EmailStats {
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

export interface SlackStatus {
  connected: boolean;
  teamId?: string;
}
