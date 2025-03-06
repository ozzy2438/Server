const express = require('express');
const router = express.Router();
const axios = require('axios');

const JOOBLE_API_KEY = '0b1d44cd-b23c-4bc2-8f0b-c4b17262f948';
const JOOBLE_API_URL = 'https://jooble.org/api/';

// @route   POST /api/jobSearch
// @desc    Search for jobs using Jooble API
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { keywords, location } = req.body;

    const response = await axios.post(`${JOOBLE_API_URL}${JOOBLE_API_KEY}`, {
      keywords: keywords || '',
      location: location || '',
      salary: '',
      page: '1'
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error searching jobs:', error);
    res.status(500).json({ message: 'Error searching jobs' });
  }
});

module.exports = router;
