const DailyLog = require('../models/dailyLog.model');
const User = require('../models/user.model');
const Project = require('../models/project.model');
const { validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const notificationController = require('./notification.controller');

// Get all logs (with filtering)
exports.getAllLogs = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      project,
      status,
      teamLeader,
      searchTerm
    } = req.query;

    // Build filter object
    const filter = {};

    // Date range filter
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      filter.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.date = { $lte: new Date(endDate) };
    }

    // Project filter
    if (project) {
      filter.project = project;
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Team leader filter
    if (teamLeader) {
      filter.teamLeader = teamLeader;
    }

    // Text search in work description
    if (searchTerm) {
      filter.workDescription = { $regex: searchTerm, $options: 'i' };
    }

    // For team leaders, only show their own logs
    if (req.userRole === 'Team Leader') {
      filter.teamLeader = req.userId;
    }

    // Get logs with populated references
    const logs = await DailyLog.find(filter)
      .populate('teamLeader', 'fullName')
      .populate('project', 'name address')
      .populate('employees', 'fullName')
      .sort({ date: -1 });

    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while retrieving logs'
    });
  }
};

// Get logs for current team leader
exports.getMyLogs = async (req, res) => {
  try {
    const logs = await DailyLog.find({ teamLeader: req.userId })
      .populate('project', 'name address')
      .populate('employees', 'fullName')
      .sort({ date: -1 });

    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while retrieving logs'
    });
  }
};

// Get log by ID
exports.getLogById = async (req, res) => {
  try {
    const log = await DailyLog.findById(req.params.id)
      .populate('teamLeader', 'fullName')
      .populate('project', 'name address')
      .populate('employees', 'fullName')
      .populate('approvedBy', 'fullName');

    if (!log) {
      return res.status(404).json({
        message: 'Log not found'
      });
    }

    // Check if user is authorized (must be the team leader or a manager)
    if (req.userRole !== 'Manager' && log.teamLeader._id.toString() !== req.userId) {
      return res.status(403).json({
        message: 'You are not authorized to view this log'
      });
    }

    return res.status(200).json(log);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while retrieving the log'
    });
  }
};

// Create a new log
exports.createLog = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if log already exists for this date, team leader, and project
    const existingLog = await DailyLog.findOne({
      date: new Date(req.body.date),
      teamLeader: req.userId,
      project: req.body.project
    });

    if (existingLog) {
      // Create a duplicate warning notification
      await notificationController.createDuplicateWarningNotification(
        req.userId,
        req.body.date,
        req.body.project
      );

      return res.status(400).json({
        message: 'A log already exists for this date and project',
        existingLogId: existingLog._id
      });
    }

    // Create new log
    const log = new DailyLog({
      date: req.body.date,
      teamLeader: req.userId,
      project: req.body.project,
      employees: req.body.employees,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      workDescription: req.body.workDescription,
      weather: req.body.weather,
      issuesEncountered: req.body.issuesEncountered,
      nextSteps: req.body.nextSteps,
      materialsUsed: req.body.materialsUsed || [],
      status: req.body.status || 'draft'
    });

    // Save log to database
    const savedLog = await log.save();

    // Populate references for response
    const populatedLog = await DailyLog.findById(savedLog._id)
      .populate('project', 'name address')
      .populate('employees', 'fullName');

    return res.status(201).json(populatedLog);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while creating the log'
    });
  }
};

// Update a log
exports.updateLog = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Find log
    const log = await DailyLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        message: 'Log not found'
      });
    }

    // Check if user is authorized (must be the team leader)
    if (log.teamLeader.toString() !== req.userId) {
      return res.status(403).json({
        message: 'You are not authorized to update this log'
      });
    }

    // Check if log is already approved
    if (log.status === 'approved') {
      return res.status(400).json({
        message: 'Cannot update an approved log'
      });
    }

    // Update log fields
    const updateData = {
      date: req.body.date,
      project: req.body.project,
      employees: req.body.employees,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      workDescription: req.body.workDescription,
      weather: req.body.weather,
      issuesEncountered: req.body.issuesEncountered,
      nextSteps: req.body.nextSteps,
      materialsUsed: req.body.materialsUsed,
      status: req.body.status || log.status
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update log
    const updatedLog = await DailyLog.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('project', 'name address')
      .populate('employees', 'fullName');

    return res.status(200).json(updatedLog);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while updating the log'
    });
  }
};

// Submit a log (change status from draft to submitted)
exports.submitLog = async (req, res) => {
  try {
    const log = await DailyLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        message: 'Log not found'
      });
    }

    // Check if user is authorized (must be the team leader)
    if (log.teamLeader.toString() !== req.userId) {
      return res.status(403).json({
        message: 'You are not authorized to submit this log'
      });
    }

    // Check if log is already submitted or approved
    if (log.status !== 'draft') {
      return res.status(400).json({
        message: `Log is already ${log.status}`
      });
    }

    // Update status to submitted
    log.status = 'submitted';
    await log.save();

    return res.status(200).json({
      message: 'Log submitted successfully',
      id: log._id,
      status: log.status
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while submitting the log'
    });
  }
};

// Approve a log (managers only)
exports.approveLog = async (req, res) => {
  try {
    const log = await DailyLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        message: 'Log not found'
      });
    }

    // Check if log is already approved
    if (log.status === 'approved') {
      return res.status(400).json({
        message: 'Log is already approved'
      });
    }

    // Check if log is in submitted status
    if (log.status !== 'submitted') {
      return res.status(400).json({
        message: 'Only submitted logs can be approved'
      });
    }

    // Update status to approved
    log.status = 'approved';
    log.approvedBy = req.userId;
    log.approvedAt = new Date();
    await log.save();

    // Create notification for the team leader
    await notificationController.createLogApprovedNotification(log._id);

    return res.status(200).json({
      message: 'Log approved successfully',
      id: log._id,
      status: log.status
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while approving the log'
    });
  }
};

// Delete a log
exports.deleteLog = async (req, res) => {
  try {
    const log = await DailyLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        message: 'Log not found'
      });
    }

    // Check if user is authorized (must be the team leader or a manager)
    if (req.userRole !== 'Manager' && log.teamLeader.toString() !== req.userId) {
      return res.status(403).json({
        message: 'You are not authorized to delete this log'
      });
    }

    // Check if log is already approved
    if (log.status === 'approved' && req.userRole !== 'Manager') {
      return res.status(400).json({
        message: 'Cannot delete an approved log'
      });
    }

    // Delete log
    await DailyLog.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      message: 'Log deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while deleting the log'
    });
  }
};

// Export log to PDF
exports.exportLogToPdf = async (req, res) => {
  try {
    const log = await DailyLog.findById(req.params.id)
      .populate('teamLeader', 'fullName')
      .populate('project', 'name address')
      .populate('employees', 'fullName')
      .populate('approvedBy', 'fullName');

    if (!log) {
      return res.status(404).json({
        message: 'Log not found'
      });
    }

    // Check if user is authorized (must be the team leader or a manager)
    if (req.userRole !== 'Manager' && log.teamLeader._id.toString() !== req.userId) {
      return res.status(403).json({
        message: 'You are not authorized to export this log'
      });
    }

    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=daily-log-${log._id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(20).text('Daily Work Log', { align: 'center' });
    doc.moveDown();
    
    // Add log details
    doc.fontSize(12).text(`Date: ${moment(log.date).format('MMMM D, YYYY')}`);
    doc.text(`Project: ${log.project.name}`);
    doc.text(`Location: ${log.project.address}`);
    doc.text(`Team Leader: ${log.teamLeader.fullName}`);
    doc.text(`Work Hours: ${moment(log.startTime).format('h:mm A')} - ${moment(log.endTime).format('h:mm A')}`);
    doc.text(`Status: ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}`);
    
    if (log.status === 'approved' && log.approvedBy) {
      doc.text(`Approved By: ${log.approvedBy.fullName}`);
      doc.text(`Approved On: ${moment(log.approvedAt).format('MMMM D, YYYY h:mm A')}`);
    }
    
    doc.moveDown();
    
    // Employees present
    doc.fontSize(14).text('Employees Present:');
    doc.fontSize(12);
    if (log.employees.length === 0) {
      doc.text('No employees recorded for this log');
    } else {
      log.employees.forEach(employee => {
        doc.text(`- ${employee.fullName}`);
      });
    }
    
    doc.moveDown();
    
    // Work description
    doc.fontSize(14).text('Work Description:');
    doc.fontSize(12).text(log.workDescription);
    doc.moveDown();
    
    // Weather
    if (log.weather) {
      doc.fontSize(14).text('Weather:');
      doc.fontSize(12).text(log.weather);
      doc.moveDown();
    }
    
    // Issues encountered
    if (log.issuesEncountered) {
      doc.fontSize(14).text('Issues Encountered:');
      doc.fontSize(12).text(log.issuesEncountered);
      doc.moveDown();
    }
    
    // Next steps
    if (log.nextSteps) {
      doc.fontSize(14).text('Next Steps:');
      doc.fontSize(12).text(log.nextSteps);
      doc.moveDown();
    }
    
    // Materials used
    if (log.materialsUsed && log.materialsUsed.length > 0) {
      doc.fontSize(14).text('Materials Used:');
      doc.fontSize(12);
      
      // Create a table for materials
      const materialTableTop = doc.y + 10;
      const materialColWidths = [200, 100, 100, 100];
      
      // Table headers
      doc.text('Material', doc.x, materialTableTop);
      doc.text('Quantity', doc.x + materialColWidths[0], materialTableTop);
      doc.text('Unit', doc.x + materialColWidths[0] + materialColWidths[1], materialTableTop);
      doc.text('Notes', doc.x + materialColWidths[0] + materialColWidths[1] + materialColWidths[2], materialTableTop);
      
      doc.moveTo(doc.x, materialTableTop + 20)
         .lineTo(doc.x + doc.page.width - doc.page.margins.left - doc.page.margins.right, materialTableTop + 20)
         .stroke();
      
      // Table rows
      let materialRowTop = materialTableTop + 30;
      log.materialsUsed.forEach(material => {
        doc.text(material.name, doc.x, materialRowTop);
        doc.text(material.quantity.toString(), doc.x + materialColWidths[0], materialRowTop);
        doc.text(material.unit, doc.x + materialColWidths[0] + materialColWidths[1], materialRowTop);
        doc.text(material.notes || '-', doc.x + materialColWidths[0] + materialColWidths[1] + materialColWidths[2], materialRowTop);
        materialRowTop += 20;
      });
      
      doc.moveDown(log.materialsUsed.length + 1);
    }
    
    // Footer
    doc.fontSize(10).text(`Generated on: ${moment().format('MMMM D, YYYY h:mm A')}`, { align: 'center' });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while exporting the log to PDF'
    });
  }
};
