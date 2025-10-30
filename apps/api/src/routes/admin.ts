import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { orchestrationQueue } from '@/queue.js';

const router: Router = Router();

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(orchestrationQueue)],
  serverAdapter,
});

router.use('/queues', serverAdapter.getRouter());

export default router;
