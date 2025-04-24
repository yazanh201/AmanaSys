const express = require('express');
const { body, validationResult } = require('express-validator');
const employeeController = require('../controllers/employee.controller');
const { verifyToken, isManager, isManagerOrTeamLeader } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get all employees
router.get('/', isManagerOrTeamLeader, employeeController.getAllEmployees);

// Get active employees
router.get('/active', isManagerOrTeamLeader, employeeController.getActiveEmployees);

// Get employee by ID
router.get('/:id', isManagerOrTeamLeader, employeeController.getEmployeeById);

// Create a new employee (managers only)
router.post(
  '/',
  isManager,
  [
    // Validation rules
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('position').notEmpty().withMessage('Position is required'),
    body('email').optional().isEmail().withMessage('Valid email is required')
  ],
  employeeController.createEmployee
);

// Update an employee (managers only)
router.put(
  '/:id',
  isManager,
  [
    // Validation rules (optional fields for update)
    body('fullName').optional().notEmpty().withMessage('Full name cannot be empty'),
    body('position').optional().notEmpty().withMessage('Position cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('hireDate').optional().isISO8601().withMessage('Valid hire date is required')
  ],
  employeeController.updateEmployee
);

// Delete an employee (managers only)
router.delete('/:id', isManager, employeeController.deleteEmployee);

// Toggle employee active status (managers only)
router.patch('/:id/toggle-status', isManager, employeeController.toggleEmployeeStatus);

module.exports = router;
