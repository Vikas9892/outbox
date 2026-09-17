import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { prisma } from '../db/prisma';

export const esClient = new Client({
  node: env.ELASTICSEARCH_NODE,
});

export const EMAIL_INDEX = 'outbox-emails';

/**
 * Initializes the Elasticsearch index with appropriate mappings if it does not already exist.
 */
export const initElasticsearchIndex = async (): Promise<void> => {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        body: {
          mappings: {
            properties: {
              emailId: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Created index '${EMAIL_INDEX}'`);
    }
  } catch (err: any) {
    console.warn(`[Elasticsearch] Index initialization skipped / unreachable: ${err.message}`);
  }
};

/**
 * Asynchronously indexes or updates an email in Elasticsearch.
 * Non-blocking: failures are logged and NEVER interrupt primary database flow.
 */
export const indexEmailRecord = async (email: {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  createdAt: Date;
}): Promise<void> => {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: email.id,
      document: {
        emailId: email.id,
        campaignId: email.campaignId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt || null,
        createdAt: email.createdAt,
      },
    });
  } catch (err: any) {
    // Graceful degradation: Elasticsearch is secondary to PostgreSQL
    console.warn(`[Elasticsearch] Failed to index email ${email.id}: ${err.message}`);
  }
};

/**
 * Searches emails across recipient, subject, and status.
 * Gracefully falls back to PostgreSQL if Elasticsearch is unavailable.
 */
export const searchEmails = async (query: string) => {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return [];
  }

  // 1. Attempt Elasticsearch search
  try {
    const isHealthy = await checkElasticsearchHealth();
    if (isHealthy) {
      const response = await esClient.search({
        index: EMAIL_INDEX,
        body: {
          query: {
            bool: {
              should: [
                { match: { recipient: { query: cleanQuery, boost: 3 } } },
                { match: { subject: { query: cleanQuery, boost: 2 } } },
                { term: { status: cleanQuery.toLowerCase() } },
                { wildcard: { recipient: `*${cleanQuery.toLowerCase()}*` } },
                { wildcard: { subject: `*${cleanQuery.toLowerCase()}*` } },
              ],
            },
          },
        },
      });

      const hits = response.hits?.hits || [];
      if (hits.length > 0) {
        return hits.map((hit: any) => ({
          id: hit._source.emailId || hit._id,
          ...hit._source,
          source: 'elasticsearch',
        }));
      }
    }
  } catch (err: any) {
    console.warn(`[Elasticsearch] Query error, falling back to PostgreSQL: ${err.message}`);
  }

  // 2. Graceful fallback to PostgreSQL
  const validStatuses = ['scheduled', 'processing', 'sent', 'failed'];
  const isStatusQuery = validStatuses.includes(cleanQuery.toLowerCase());

  const orConditions: any[] = [
    { recipient: { contains: cleanQuery, mode: 'insensitive' } },
    { subject: { contains: cleanQuery, mode: 'insensitive' } },
  ];

  if (isStatusQuery) {
    orConditions.push({ status: cleanQuery.toLowerCase() as any });
  }

  const dbEmails = await prisma.email.findMany({
    where: {
      OR: orConditions,
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });

  return dbEmails.map((e) => ({
    emailId: e.id,
    id: e.id,
    campaignId: e.campaignId,
    senderId: e.senderId,
    recipient: e.recipient,
    subject: e.subject,
    body: e.body,
    status: e.status,
    scheduledAt: e.scheduledAt,
    sentAt: e.sentAt,
    createdAt: e.createdAt,
    source: 'database_fallback',
  }));
};

export const checkElasticsearchHealth = async (): Promise<boolean> => {
  try {
    const health = await esClient.cluster.health({ timeout: '2s' });
    return health && (health.status === 'green' || health.status === 'yellow');
  } catch {
    return false;
  }
};
