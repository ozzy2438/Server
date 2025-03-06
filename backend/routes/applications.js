// backend/routes/applications.js
const express = require('express');
const Application = require('../models/Application');
const router = express.Router();

// Add application
router.post('/', async (req, res) => {
  try {
    const applicationData = {
      ...req.body,
      user: req.body.user || 'demoUserId123', // Default demo user
      timeline: [{
        status: req.body.status,
        notes: req.body.notes?.[0]?.content || '',
        date: new Date()
      }]
    };

    const newApplication = new Application(applicationData);
    const savedApp = await newApplication.save();
    res.status(201).json(savedApp);
  } catch (error) {
    console.error('Application save error:', error);
    res.status(500).json({ 
      error: 'Application could not be saved.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user's applications
router.get('/:userId', async (req, res) => {
  try {
    // Query with userId as string
    const applications = await Application.find({ 
      user: req.params.userId 
    }).sort({ lastUpdated: -1 });
    
    res.json(applications);
  } catch (error) {
    console.error('Application fetch error:', error);
    res.status(500).json({ 
      error: 'Applications could not be retrieved.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update application
router.put('/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    // Add new status to timeline if it changed
    if (status && status !== application.status) {
      application.timeline.push({
        status,
        notes: notes?.[0]?.content || '',
        date: new Date()
      });
      application.status = status;
    }

    // Add new notes
    if (notes?.[0]?.content) {
      application.notes.push({
        content: notes[0].content,
        createdAt: new Date()
      });
    }

    application.lastUpdated = new Date();
    const updatedApp = await application.save();
    res.json(updatedApp);
  } catch (error) {
    console.error('Application update error:', error);
    res.status(500).json({ 
      error: 'Application could not be updated.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete application
router.delete('/:id', async (req, res) => {
  try {
    const application = await Application.findByIdAndDelete(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    res.json({ message: 'Application successfully deleted.' });
  } catch (error) {
    console.error('Application delete error:', error);
    res.status(500).json({ 
      error: 'Application could not be deleted.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
