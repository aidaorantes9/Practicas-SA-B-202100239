import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireResource } from '../middlewares/authorize.middleware';
import { adminOnlyResource, sharedResource } from '../controllers/protected.controller';

const router = Router();

router.get('/route1', requireAuth, requireResource('route1'), adminOnlyResource);
router.get('/route2', requireAuth, requireResource('route2'), sharedResource);

export default router;