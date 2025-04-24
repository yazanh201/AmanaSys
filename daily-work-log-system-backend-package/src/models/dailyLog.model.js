const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Material name is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
});

const PhotoSchema = new mongoose.Schema({
  path: {
    type: String,
    required: [true, 'Photo path is required']
  },
  originalName: {
    type: String,
    required: [true, 'Original file name is required']
  },
  description: {
    type: String,
    trim: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const DocumentSchema = new mongoose.Schema({
  path: {
    type: String,
    required: [true, 'Document path is required']
  },
  originalName: {
    type: String,
    required: [true, 'Original file name is required']
  },
  type: {
    type: String,
    enum: ['delivery_note', 'receipt', 'invoice', 'other'],
    default: 'other'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const DailyLogSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Date is required'],
      index: true
    },
    teamLeader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Team leader is required'],
      index: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
      index: true
    },
    employees: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    }],
    startTime: {
      type: Date,
      required: [true, 'Start time is required']
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required']
    },
    workDescription: {
      type: String,
      required: [true, 'Work description is required'],
      trim: true
    },
    weather: {
      type: String,
      trim: true
    },
    issuesEncountered: {
      type: String,
      trim: true
    },
    nextSteps: {
      type: String,
      trim: true
    },
    materialsUsed: [MaterialSchema],
    photos: [PhotoSchema],
    documents: [DocumentSchema],
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved'],
      default: 'draft',
      index: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound index for preventing duplicate logs for the same date and team leader
DailyLogSchema.index({ date: 1, teamLeader: 1, project: 1 }, { unique: true });

const DailyLog = mongoose.model('DailyLog', DailyLogSchema);

module.exports = DailyLog;
