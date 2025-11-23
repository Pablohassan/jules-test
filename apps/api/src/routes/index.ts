import { Router } from 'express';
import runsRouter from './runs.js';
import authRouter from './auth.js';
import adminRouter from './admin.js';
import featuresRouter from './features.js';
import clientRouter from './client.js';
import veilleRouter from './veille.js';

const router: Router = Router();

router.use('/runs', runsRouter);
router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.use('/features', featuresRouter);
router.use('/clients', clientRouter);
router.use('/veilles', veilleRouter);

export default router;
