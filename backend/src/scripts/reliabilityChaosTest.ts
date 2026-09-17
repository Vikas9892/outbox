import { prisma } from '../db/prisma';
import { redisConnection } from '../config/redis';
import { emailQueue } from '../queues/emailQueue';
import { CampaignService } from '../services/campaignService';
import { emailWorkerInstance } from '../workers/emailWorker';

async function runReliabilityChaosTest() {
  console.log('====================================================');
  console.log('       REACHINBOX SCHEDULER RELIABILITY TEST        ');
  console.log('  Testing Concurrency, Rate Limiting & Zero Loss   ');
  console.log('====================================================\n');

  try {
    // 1. Clean environment
    await prisma.email.deleteMany({});
    await prisma.campaign.deleteMany({});
    await emailQueue.drain();

    const recipientCount = 15;
    const hourlyLimit = 5; // Enforce rate limit after 5 sends

    console.log(`[ChaosTest] Scheduling campaign with ${recipientCount} recipients...`);
    console.log(`[ChaosTest] Hourly Limit: ${hourlyLimit}/hr | Delay: 50ms`);

    const recipients = Array.from({ length: recipientCount }, (_, i) => `lead_${i + 1}_${Date.now()}@example.com`);

    const { campaign } = await CampaignService.createCampaign({
      subject: 'Reliability Stress Test',
      body: 'Testing high concurrency and rate limits',
      recipients,
      delayMs: 50,
      hourlyLimit,
    });

    console.log(`[ChaosTest] Campaign created with ID: ${campaign.id}`);

    // 2. Fetch BullMQ jobs
    const jobs = await emailQueue.getJobs(['delayed', 'waiting']);
    console.log(`[ChaosTest] Successfully queued ${jobs.length} jobs in BullMQ\n`);

    // 3. Simulate high concurrent worker execution (3 concurrent workers competing for jobs)
    console.log('[ChaosTest] Simulating 3 concurrent workers processing queue...');

    const processJobWithSimulatedWorker = async (workerId: number, job: any) => {
      try {
        await emailWorkerInstance.processJob(job);
      } catch (err: any) {
        console.error(`[Worker ${workerId}] Error:`, err.message);
      }
    };

    // Parallel execution across concurrent worker loops
    const promises = jobs.map((job, idx) => {
      const workerId = (idx % 3) + 1;
      return processJobWithSimulatedWorker(workerId, job);
    });

    await Promise.all(promises);

    console.log('\n[ChaosTest] All initial jobs finished execution cycle.');
    console.log('[ChaosTest] Auditing database states...\n');

    // 4. Audit DB states
    const emails = await prisma.email.findMany({
      where: { campaignId: campaign.id },
    });

    const sentCount = emails.filter((e) => e.status === 'sent').length;
    const scheduledCount = emails.filter((e) => e.status === 'scheduled').length;
    const failedCount = emails.filter((e) => e.status === 'failed').length;

    console.log('----------------------------------------------------');
    console.log(`  Total Emails in DB:      ${emails.length} (Expected: ${recipientCount})`);
    console.log(`  Sent (Delivered):        ${sentCount} (Capped by rate limit: ${hourlyLimit})`);
    console.log(`  Rescheduled / Pending:   ${scheduledCount} (Preserved in 'scheduled')`);
    console.log(`  Permanently Failed:      ${failedCount} (Expected: 0)`);
    console.log('----------------------------------------------------\n');

    // Check 1: Rate limit bound respected
    if (sentCount > hourlyLimit) {
      throw new Error(`Rate limit exceeded! Sent ${sentCount} but limit was ${hourlyLimit}`);
    }
    console.log('✔ Check 1 PASSED: Hourly rate limit strictly enforced without over-sending');

    // Check 2: Zero emails lost or dropped
    if (sentCount + scheduledCount !== recipientCount) {
      throw new Error(`Data loss detected! Total accounted: ${sentCount + scheduledCount} vs ${recipientCount}`);
    }
    console.log('✔ Check 2 PASSED: 100% data retention (zero emails dropped or deleted)');

    // Check 3: Zero failed jobs
    if (failedCount > 0) {
      throw new Error(`Unexpected failure status: ${failedCount} emails marked failed`);
    }
    console.log('✔ Check 3 PASSED: Rate-limited jobs properly rescheduled instead of marked failed');

    // Check 4: Idempotency check (no duplicate sent records for any recipient)
    const uniqueRecipients = new Set(emails.map((e) => e.recipient));
    if (uniqueRecipients.size !== recipientCount) {
      throw new Error('Duplicate recipient entries detected in DB!');
    }
    console.log('✔ Check 4 PASSED: Idempotency verified - no duplicate sends or duplicate records\n');

    console.log('====================================================');
    console.log('    RELIABILITY & CONCURRENCY TEST PASSED (100%)    ');
    console.log('====================================================');
  } catch (err: any) {
    console.error('\n❌ RELIABILITY TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    await emailWorkerInstance.stop();
    await emailQueue.close();
    await prisma.$disconnect();
    redisConnection.disconnect();
    process.exit(0);
  }
}

runReliabilityChaosTest();
