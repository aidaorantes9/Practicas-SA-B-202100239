import { Router } from 'express';
import { checkAuthorization } from '../controllers/authorization.controller';

const router = Router();

// POST /authorize  { role: "admin" | "cliente", resource: "route1" | "route2" }
router.post('/authorize', checkAuthorization);

export default router;