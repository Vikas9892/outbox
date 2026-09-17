import { Router } from 'express';
import { createCampaign, getCampaigns } from '../controllers/campaignController';

const router = Router();

router.post('/api/campaigns', createCampaign);
router.get('/api/campaigns', getCampaigns);

export default router;
