const Employee = require('../models/employee.model');
const { validationResult } = require('express-validator');

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find();
    return res.status(200).json(employees);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while retrieving employees'
    });
  }
};

// Get active employees
exports.getActiveEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true });
    return res.status(200).json(employees);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while retrieving active employees'
    });
  }
};

// Get employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({
        message: 'Employee not found'
      });
    }
    
    return res.status(200).json(employee);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while retrieving the employee'
    });
  }
};

// Create a new employee
exports.createEmployee = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Create new employee
    const employee = new Employee({
      fullName: req.body.fullName,
      position: req.body.position,
      phone: req.body.phone,
      email: req.body.email,
      employeeId: req.body.employeeId,
      hireDate: req.body.hireDate || new Date(),
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      notes: req.body.notes
    });
    
    // Save employee to database
    const savedEmployee = await employee.save();
    
    return res.status(201).json(savedEmployee);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while creating the employee'
    });
  }
};

// Update an employee
exports.updateEmployee = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Find employee and update
    const updateData = {
      fullName: req.body.fullName,
      position: req.body.position,
      phone: req.body.phone,
      email: req.body.email,
      employeeId: req.body.employeeId,
      hireDate: req.body.hireDate,
      isActive: req.body.isActive,
      notes: req.body.notes
    };
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!employee) {
      return res.status(404).json({
        message: 'Employee not found'
      });
    }
    
    return res.status(200).json(employee);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while updating the employee'
    });
  }
};

// Delete an employee
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    
    if (!employee) {
      return res.status(404).json({
        message: 'Employee not found'
      });
    }
    
    return res.status(200).json({
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while deleting the employee'
    });
  }
};

// Toggle employee active status
exports.toggleEmployeeStatus = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({
        message: 'Employee not found'
      });
    }
    
    employee.isActive = !employee.isActive;
    await employee.save();
    
    return res.status(200).json({
      id: employee._id,
      isActive: employee.isActive,
      message: `Employee ${employee.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while updating employee status'
    });
  }
};
