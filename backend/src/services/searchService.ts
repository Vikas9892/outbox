import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';

export const esClient = new Client({
  node: env.ELASTICSEARCH_NODE,
  // Single-node local config without SSL
});

export const checkElasticsearchHealth = async (): Promise<boolean> => {
  try {
    const health = await esClient.cluster.health({ timeout: '3s' });
    return health && (health.status === 'green' || health.status === 'yellow');
  } catch {
    return false;
  }
};
