export interface EmailJobData {
  emailId: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
}

export interface CreateCampaignDTO {
  userId?: string;
  senderEmail?: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string | Date;
  delayMs?: number;
  hourlyLimit?: number;
}
