import { Router } from 'express';
import { getGoogleAuthURL, handleGoogleCallback } from '@/services/google/auth.js';

const router: Router = Router();

router.get('/google', (req, res) => {
  const url = getGoogleAuthURL();
  res.redirect(url);
});

router.get('/google/callback', async (req, res, next) => {
  try {
    const code = req.query.code as string;
    await handleGoogleCallback(code);
    res.send('Google authentication successful! You can close this tab.');
  } catch (error) {
    next(error);
  }
});

export default router;
