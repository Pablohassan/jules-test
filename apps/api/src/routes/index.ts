import { Router } from 'express';
import runsRouter from './runs.js';
import authRouter from './auth.js';
import adminRouter from './admin.js';
import featuresRouter from './features.js';

const router: Router = Router();

router.use('/runs', runsRouter);
router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.use('/features', featuresRouter);

export default router;
