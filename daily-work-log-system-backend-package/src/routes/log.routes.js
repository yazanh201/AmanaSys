const express = require('express');
const { body, validationResult } = require('express-validator');
const logController = require('../controllers/log.controller');
const { verifyToken, isManager, isTeamLeader, isManagerOrTeamLeader } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get all logs (with filtering)
router.get('/', isManagerOrTeamLeader, logController.getAllLogs);

// Get logs for current team leader
router.get('/my-logs', isTeamLeader, logController.getMyLogs);

// Get log by ID
router.get('/:id', isManagerOrTeamLeader, logController.getLogById);

// Create a new log (team leaders only)
router.post(
  '/',
  isTeamLeader,
  [
    // Validation rules
    body('date').isISO8601().withMessage('Valid date is required'),
    body('project').isMongoId().withMessage('Valid project ID is required'),
    body('employees').isArray().withMessage('Employees must be an array'),
    body('startTime').isISO8601().withMessage('Valid start time is required'),
    body('endTime').isISO8601().withMessage('Valid end time is required'),
    body('workDescription').notEmpty().withMessage('Work description is required')
  ],
  logController.createLog
);

// Update a log (team leaders only)
router.put(
  '/:id',
  isTeamLeader,
  [
    // Validation rules (optional fields for update)
    body('date').optional().isISO8601().withMessage('Valid date is required'),
    body('project').optional().isMongoId().withMessage('Valid project ID is required'),
    body('employees').optional().isArray().withMessage('Employees must be an array'),
    body('startTime').optional().isISO8601().withMessage('Valid start time is required'),
    body('endTime').optional().isISO8601().withMessage('Valid end time is required'),
    body('workDescription').optional().notEmpty().withMessage('Work description cannot be empty')
  ],
  logController.updateLog
);

// Submit a log (team leaders only)
router.patch('/:id/submit', isTeamLeader, logController.submitLog);

// Approve a log (managers only)
router.patch('/:id/approve', isManager, logController.approveLog);

// Delete a log
router.delete('/:id', isManagerOrTeamLeader, logController.deleteLog);

// Export log to PDF
router.get('/:id/export-pdf', isManagerOrTeamLeader, logController.exportLogToPdf);

module.exports = router;
