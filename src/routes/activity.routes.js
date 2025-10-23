import { Router } from 'express';
import { getRecentActivities } from '../controllers/activityController.js';

const router = Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Activity API is working!', timestamp: new Date().toISOString() });
});

// Get recent activities for a specific company
router.get('/:company/activities', getRecentActivities);

export default router;
