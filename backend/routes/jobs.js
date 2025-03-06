// backend/routes/jobs.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

// GET /api/jobs - Search job listings
router.get('/', async (req, res) => {
  try {
    const { query, analysis, page = 1, location } = req.query;
    
    // Check Jooble API key
    const joobleApiKey = process.env.JOOBLE_API_KEY || '0b1d44cd-b23c-4bc2-8f0b-c4b17262f948';
    
    if (!joobleApiKey) {
      return res.status(500).json({ error: 'Jooble API key is not configured' });
    }

    // Default search query
    let searchQuery = query || "software developer";
    let jobType = ""; // Default to all job types
    let searchLocation = location || "";

    // If analysis data exists, create a smarter search query
    if (analysis) {
      console.log('Raw analysis data:', analysis);
      
      try {
        const parsedAnalysis = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
        
        // Extract recommended job titles
        const jobTitles = parsedAnalysis.recommendedJobTitles || 
                         parsedAnalysis.jobTitles || 
                         [];
        
        // Extract key skills
        const skills = parsedAnalysis.keySkills || 
                      parsedAnalysis.skills || 
                      parsedAnalysis.personalSkills || 
                      parsedAnalysis.technicalSkills || 
                      [];
        
        // Extract industry information
        const industry = parsedAnalysis.industryFit || 
                        parsedAnalysis.industry || 
                        '';
        
        console.log('Parsed data:', {
          jobTitles,
          skills,
          industry
        });
        
        // Create search query
        if (jobTitles.length > 0) {
          // Use first 2 recommended job titles
          const primaryJobTitles = jobTitles.slice(0, 2);
          
          // Select top 3 key skills
          const topSkills = skills.slice(0, 3);
          
          // Create search query
          searchQuery = primaryJobTitles.join(' ');
          
          // Add skills
          if (topSkills.length > 0) {
            searchQuery += ` ${topSkills.join(' ')}`;
          }
          
          console.log('Generated search query:', searchQuery);
        }
      } catch (parseError) {
        console.error('Error parsing analysis data:', parseError);
        // If analysis data can't be parsed, use default query
      }
    }

    console.log('Final search query:', searchQuery);
    console.log('Location:', searchLocation);

    // Send request to Jooble API
    console.log('Sending request to Jooble API...');
    const joobleResponse = await axios.post(
      `https://jooble.org/api/${joobleApiKey}`,
      {
        keywords: searchQuery,
        location: searchLocation,
        page: page
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    // Check response
    if (!joobleResponse.data || !joobleResponse.data.jobs) {
      console.error('Invalid response from Jooble API:', joobleResponse.data);
      return res.status(500).json({ error: 'Invalid response from Jooble API' });
    }

    // Process job listings
    const jobs = joobleResponse.data.jobs.map(job => ({
      id: job.id || `jooble-${Math.random().toString(36).substring(7)}`,
      title: job.title || 'No Title',
      company: job.company || 'Company not specified',
      location: job.location || 'Location not specified',
      description: job.snippet || job.description || '',
      url: job.link || '',
      salary: job.salary || null,
      employmentType: job.type || null,
      highlights: job.snippet ? [{ title: 'Description', items: [job.snippet] }] : []
    }));
    
    const totalResults = joobleResponse.data.totalCount || jobs.length;
    
    console.log(`Jooble API returned ${jobs.length} jobs`);

    // Return response
    return res.json({
      jobs,
      totalResults,
      currentPage: page,
      searchQuery,
      apiUsed: 'Jooble'
    });

  } catch (error) {
    console.error('Error fetching job listings:', error.message);
    
    if (error.response) {
      console.error('Jooble API response error:', error.response.data);
      return res.status(error.response.status || 500).json({ 
        error: `Error from Jooble API: ${error.response.data?.error || error.response.data || 'Unknown error'}` 
      });
    } else if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Jooble API timeout' });
    } else if (error.request) {
      return res.status(500).json({ error: 'No response from Jooble API' });
    } else {
      return res.status(500).json({ error: `Error fetching job listings: ${error.message}` });
    }
  }
});

// POST /api/jobs/trackClick - Track job listing clicks
router.post('/trackClick', async (req, res) => {
  try {
    const { jobId, jobTitle, jobCompany, jobUrl } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    console.log('Job click tracked:', {
      jobId,
      jobTitle,
      jobCompany,
      jobUrl,
      timestamp: new Date().toISOString()
    });
    
    // Database record can be created here
    
    return res.json({ success: true, message: 'Job click tracked successfully' });
  } catch (error) {
    console.error('Error tracking job click:', error.message);
    return res.status(500).json({ error: `Error tracking job click: ${error.message}` });
  }
});

// PUT /api/jobs/updateStatus - Update job application status
router.put('/updateStatus', async (req, res) => {
  try {
    const { jobId, status, notes } = req.body;
    
    if (!jobId || !status) {
      return res.status(400).json({ error: 'Job ID and status are required' });
    }
    
    console.log('Job application status updated:', {
      jobId,
      status,
      notes,
      timestamp: new Date().toISOString()
    });
    
    // Database record can be created here
    
    return res.json({ success: true, message: 'Job application status updated successfully' });
  } catch (error) {
    console.error('Error updating job application status:', error.message);
    return res.status(500).json({ error: `Error updating job application status: ${error.message}` });
  }
});

module.exports = router;
