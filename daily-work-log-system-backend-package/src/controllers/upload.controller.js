const DailyLog = require('../models/dailyLog.model');
const fs = require('fs');
const path = require('path');

// Upload photos to a daily log
exports.uploadPhotos = async (req, res) => {
  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: 'No photos uploaded'
      });
    }

    // Find the log
    const log = await DailyLog.findById(req.params.logId);
    
    if (!log) {
      // Delete uploaded files if log not found
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      
      return res.status(404).json({
        message: 'Log not found'
      });
    }

    // Check if user is authorized (must be the team leader or a manager)
    if (req.userRole !== 'Manager' && log.teamLeader.toString() !== req.userId) {
      // Delete uploaded files if not authorized
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      
      return res.status(403).json({
        message: 'You are not authorized to upload photos to this log'
      });
    }

    // Check if log is already approved
    if (log.status === 'approved') {
      // Delete uploaded files if log is approved
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      
      return res.status(400).json({
        message: 'Cannot upload photos to an approved log'
      });
    }

    // Add photos to log
    const photos = req.files.map(file => ({
      path: `/uploads/photos/${path.basename(file.path)}`,
      originalName: file.originalname,
      uploadedAt: new Date()
    }));

    log.photos = [...log.photos, ...photos];
    await log.save();

    return res.status(200).json({
      message: 'Photos uploaded successfully',
      photos: photos
    });
  } catch (error) {
    // Delete uploaded files if error occurs
    if (req.files) {
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
    }
    
    return res.status(500).json({
      message: error.message || 'Some error occurred while uploading photos'
    });
  }
};

// Upload documents to a daily log
exports.uploadDocuments = async (req, res) => {
  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: 'No documents uploaded'
      });
    }

    // Find the log
    const log = await DailyLog.findById(req.params.logId);
    
    if (!log) {
      // Delete uploaded files if log not found
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      
      return res.status(404).json({
        message: 'Log not found'
      });
    }

    // Check if user is authorized (must be the team leader or a manager)
    if (req.userRole !== 'Manager' && log.teamLeader.toString() !== req.userId) {
      // Delete uploaded files if not authorized
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      
      return res.status(403).json({
        message: 'You are not authorized to upload documents to this log'
      });
    }

    // Check if log is already approved
    if (log.status === 'approved') {
      // Delete uploaded files if log is approved
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      
      return res.status(400).json({
        message: 'Cannot upload documents to an approved log'
      });
    }

    // Determine document type based on file extension
    const getDocumentType = (filename) => {
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.pdf') return 'delivery_note';
      if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) return 'receipt';
      if (['.doc', '.docx', '.xls', '.xlsx'].includes(ext)) return 'invoice';
      return 'other';
    };

    // Add documents to log
    const documents = req.files.map(file => ({
      path: `/uploads/documents/${path.basename(file.path)}`,
      originalName: file.originalname,
      type: req.body.type || getDocumentType(file.originalname),
      uploadedAt: new Date()
    }));

    log.documents = [...log.documents, ...documents];
    await log.save();

    return res.status(200).json({
      message: 'Documents uploaded successfully',
      documents: documents
    });
  } catch (error) {
    // Delete uploaded files if error occurs
    if (req.files) {
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
    }
    
    return res.status(500).json({
      message: error.message || 'Some error occurred while uploading documents'
    });
  }
};

// Delete a file (photo or document)
exports.deleteFile = async (req, res) => {
  try {
    const { logId, fileType, fileId } = req.params;

    // Validate file type
    if (fileType !== 'photos' && fileType !== 'documents') {
      return res.status(400).json({
        message: 'Invalid file type'
      });
    }

    // Find the log
    const log = await DailyLog.findById(logId);
    
    if (!log) {
      return res.status(404).json({
        message: 'Log not found'
      });
    }

    // Check if user is authorized (must be the team leader or a manager)
    if (req.userRole !== 'Manager' && log.teamLeader.toString() !== req.userId) {
      return res.status(403).json({
        message: `You are not authorized to delete ${fileType} from this log`
      });
    }

    // Check if log is already approved
    if (log.status === 'approved') {
      return res.status(400).json({
        message: `Cannot delete ${fileType} from an approved log`
      });
    }

    // Find the file
    const files = fileType === 'photos' ? log.photos : log.documents;
    const fileIndex = files.findIndex(file => file._id.toString() === fileId);
    
    if (fileIndex === -1) {
      return res.status(404).json({
        message: 'File not found'
      });
    }

    // Get file path
    const filePath = path.join(__dirname, '..', files[fileIndex].path);

    // Delete file from disk if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove file from log
    if (fileType === 'photos') {
      log.photos.splice(fileIndex, 1);
    } else {
      log.documents.splice(fileIndex, 1);
    }

    await log.save();

    return res.status(200).json({
      message: 'File deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while deleting the file'
    });
  }
};
