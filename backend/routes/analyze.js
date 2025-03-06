// backend/routes/analyze.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const axios = require('axios');

const router = express.Router();

// Function to extract text from PDF
async function extractTextFromPDF(pdfPath) {
  try {
    console.log(`Extracting text from PDF file: ${pdfPath}`);
    
    // Check PDF file
    if (!fs.existsSync(pdfPath)) {
      console.error(`PDF file not found: ${pdfPath}`);
      throw new Error(`PDF file not found: ${pdfPath}`);
    }
    
    // Check file size
    const stats = fs.statSync(pdfPath);
    console.log(`PDF file size: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      console.error('PDF file is empty');
      throw new Error('PDF file is empty');
    }
    
    // Read PDF
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // PDF parse options
    const options = {
      max: 10, // Maximum number of pages
      version: 'v2.0.550'
    };
    
    // Parse PDF
    const data = await pdfParse(dataBuffer, options);
    
    console.log(`Length of text extracted from PDF: ${data.text.length}`);
    console.log(`Sample of text extracted from PDF: ${data.text.substring(0, 100)}...`);
    
    // Check if text is empty
    if (!data.text || data.text.trim().length === 0) {
      console.error('Text could not be extracted from PDF or text is empty');
      throw new Error('Text could not be extracted from PDF or text is empty');
    }
    
    return data.text;
  } catch (error) {
    console.error('PDF text extraction error:', error);
    
    // More descriptive error message
    if (error.message.includes('file ended prematurely')) {
      throw new Error('PDF file is corrupted or incomplete');
    } else if (error.message.includes('not a PDF file')) {
      throw new Error('File is not a valid PDF format');
    } else {
      throw new Error(`Could not extract text from PDF: ${error.message}`);
    }
  }
}

// POST /api/analyze
router.post('/', async (req, res) => {
  try {
    const { filePath } = req.body;

    console.log('Analysis request received, filePath:', filePath);

    if (!filePath) {
      console.error('No file path provided');
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    // Process file path
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    console.log('Uploads directory:', uploadsDir);
    
    // Accept filePath directly as filename
    const fileName = filePath;
    console.log('Filename to be used:', fileName);
    
    // Create full path
    const fullPath = path.join(uploadsDir, fileName);
    console.log('Full path being processed:', fullPath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      
      // Debug: list files in uploads directory
      const files = fs.readdirSync(uploadsDir);
      console.log('Files in uploads directory:', files);
      
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Extract text from file
    console.log('Extracting text from file...');
    const resumeText = await extractTextFromPDF(fullPath);
    console.log(`Extracted text length: ${resumeText.length} characters`);
    
    // Check text length and truncate if necessary
    const maxLength = 4000;
    const truncatedText = resumeText.length > maxLength 
      ? resumeText.substring(0, maxLength) 
      : resumeText;
    
    console.log(`Truncated text length: ${truncatedText.length}`);
    console.log(`Resume text sample: \n${truncatedText.substring(0, 200)}...`);
    
    // Attempt to analyze resume with available APIs
    console.log('Attempting to analyze resume with available APIs');
    
    let analysisResult = null;
    let errors = [];
    
    // Store results from both APIs
    let deepseekResult = null;
    let openaiResult = null;
    
    // Try DeepSeek API
    if (process.env.DEEPSEEK_REASONER_API) {
      try {
        console.log('Using DeepSeek API for analysis');
        deepseekResult = await callDeepSeekAPI(truncatedText);
        console.log('DeepSeek API response received successfully');
        analysisResult = deepseekResult;
      } catch (deepseekError) {
        console.error('DeepSeek API failed:', deepseekError.message);
        errors.push({ api: 'DeepSeek', error: deepseekError.message });
      }
    } else {
      console.log('DeepSeek API key not configured, skipping');
    }
    
    // Try OpenAI API
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('Using OpenAI API for analysis');
        openaiResult = await callOpenAIAPI(truncatedText);
        console.log('OpenAI API response received successfully');
        
        // If DeepSeek failed, use OpenAI result
        if (!analysisResult) {
          analysisResult = openaiResult;
        }
      } catch (openaiError) {
        console.error('OpenAI API failed:', openaiError.message);
        errors.push({ api: 'OpenAI', error: openaiError.message });
      }
    } else {
      console.log('OpenAI API key not configured, skipping');
    }
    
    // If both APIs returned results, merge them
    if (deepseekResult && openaiResult) {
      console.log('Merging results from both APIs');
      analysisResult = mergeAPIResults(deepseekResult, openaiResult);
    }
    
    // If no API works, return error
    if (!analysisResult) {
      console.log('All APIs failed, returning error');
      return res.status(500).json({ error: 'Failed to analyze resume with available APIs. Please try again later.' });
    }
    
    // Return the analysis result
    return res.json(analysisResult);
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

// OpenAI API call helper function
async function callOpenAIAPI(resumeText) {
  console.log('Preparing OpenAI API call...');
  
  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OpenAI API key is not configured');
    throw new Error('OpenAI API key is not configured');
  }
  
  // Prepare system message
  const systemMessage = {
    role: "system",
    content: `You are an experienced HR professional and career consultant. Analyze the given resume thoroughly and provide a comprehensive response in English only. Your analysis should be detailed, insightful, and actionable.

    Respond in the following JSON format:
    {
      "summary": "// A comprehensive executive summary (at least 300 words) highlighting the candidate's background, key qualifications, notable achievements, and overall career trajectory. Be specific and detailed, mentioning actual metrics and accomplishments from the resume.",
      
      "strengths": [
        // At least 7 strengths with detailed explanations and specific examples from the resume
        "Strong analytical skills - Proven in data science projects with measurable outcomes such as X",
        "Technical expertise - Comprehensive experience in Python, SQL with specific applications"
      ],
      
      "areasToImprove": [
        // 4-5 areas for improvement with constructive and specific suggestions
        "Management experience - Can gain more experience in team leadership roles by pursuing X",
        "Industry diversity - Can take on projects in different industries such as Y and Z"
      ],
      
      "recommendations": [
        // Provide 3 actionable recommendations with specific steps
        "Enhance your resume by adding quantifiable achievements to each role",
        "Obtain certification in X to strengthen your technical credentials",
        "Develop a portfolio showcasing your projects with measurable outcomes"
      ],
      
      "personalSkills": [
        // At least 10 technical and personal skills with level (Beginner/Intermediate/Advanced/Expert) and specific experience
        "Python (Advanced) - NumPy, Pandas, Scikit-learn with 5+ years experience",
        "Data Analysis (Expert) - Statistical analysis, forecasting, A/B testing"
      ],
      
      "detailedAnalysis": {
        "professionalProfile": "// 300-400 word detailed profile summary including experience, achievements, career goals, and unique value proposition. Be specific about the candidate's professional journey, highlighting transitions, growth, and specializations.",
        
        "keyAchievements": [
          // At least 7 concrete achievements with specific metrics and impact
          "Increased average order size by 7% with recommendation engine, resulting in $1.2M additional annual revenue",
          "Improved operational efficiency by 30% with machine learning model, reducing processing time from 3 days to 1"
        ],
        
        "industryFit": [
          // At least 7 suitable industry and role suggestions with detailed rationale
          "Fintech - Ideal for data analysis and forecasting experience, particularly the work with financial datasets and predictive models",
          "E-commerce - Valuable customer analysis and segmentation expertise demonstrated in previous retail analytics projects"
        ],
        
        "recommendedJobTitles": [
          // 7-8 most suitable job titles based on resume with brief explanation
          "Senior Data Scientist - Well-aligned with statistical analysis background and machine learning expertise",
          "Machine Learning Engineer - Matches programming skills and algorithm development experience"
        ],
        
        "skillGaps": [
          // 5-6 skills that might be needed for target roles with specific recommendations
          "Cloud Computing - AWS certification recommended, particularly Solutions Architect or Machine Learning Specialty",
          "Deep Learning - Neural Networks experience can be enhanced through projects with TensorFlow or PyTorch"
        ]
      }
    }
    
    IMPORTANT: Your response MUST be a valid JSON object. Do not include any text outside the JSON structure. Do not include markdown formatting, explanations, or any other content outside the JSON object.
    
    IMPORTANT: Analyze the resume content carefully and extract the actual education, skills, and experience from the document. Do not make assumptions or use generic responses. The job titles and industry recommendations should be directly based on the resume content.
    
    IMPORTANT: ALL content must be in ENGLISH only. Do not use any other language in your response.
    
    IMPORTANT: Be specific and detailed in your analysis. Include actual metrics, project names, technologies, and other concrete details from the resume whenever possible.`
  };

  // API call model selection
  const model = process.env.USE_GPT4 === 'true' ? "gpt-4" : "gpt-3.5-turbo";
  console.log(`Using OpenAI model: ${model}`);
  
  // Truncate resume text (if too long)
  const maxTextLength = 3000;
  const truncatedResumeText = resumeText.length > maxTextLength 
    ? resumeText.substring(0, maxTextLength) + "..." 
    : resumeText;
  
  console.log(`Resume text length for OpenAI API: ${truncatedResumeText.length} characters`);
  
  try {
    // API isteği gönder
    console.log('Sending request to OpenAI API...');
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model,
        messages: [systemMessage, {
          role: "user",
          content: `Please analyze this resume thoroughly and provide a detailed analysis in English only. Return your analysis in JSON format as specified: ${truncatedResumeText}`
        }],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v1'
        },
        timeout: 120000 // 120 saniye timeout (2 dakika)
      }
    );
    
    // Yanıtı kontrol et
    if (!openaiResponse.data || !openaiResponse.data.choices || !openaiResponse.data.choices[0]) {
      console.error('Invalid response from OpenAI API:', openaiResponse.data);
      throw new Error('Invalid response from OpenAI API');
    }
    
    // Yanıtı işle
    const analysis = openaiResponse.data.choices[0].message.content;
    console.log('OpenAI API response received, length:', analysis.length);
    console.log('OpenAI API response sample:', analysis.substring(0, 100) + '...');
    
    return processAPIResponse(analysis);
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    
    if (error.response) {
      console.error('OpenAI API response error:', error.response.data);
      throw new Error(`OpenAI API error: ${error.response.data.error?.message || error.response.data.error || 'Unknown error'}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('OpenAI API timeout - request took too long');
    } else if (error.request) {
      throw new Error('No response from OpenAI API');
    } else {
      throw error;
    }
  }
}

// DeepSeek API çağrısı
async function callDeepSeekAPI(resumeText) {
  console.log('Calling DeepSeek API...');
  
  const apiKey = process.env.DEEPSEEK_REASONER_API;
  if (!apiKey) {
    throw new Error('DEEPSEEK_REASONER_API key is not configured');
  }

  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: "deepseek-reasoner",
        messages: [
          {
            role: "system",
            content: `You are a professional resume analyst. Analyze the given resume thoroughly and provide a comprehensive response in ENGLISH ONLY. Your analysis should be detailed, insightful, and actionable.

Respond in the following JSON format:
{
  "summary": "A comprehensive executive summary (at least 300 words) highlighting the candidate's background, key qualifications, notable achievements, and overall career trajectory.",
  "professionalProfile": "Detailed professional profile (300-400 words) including experience, achievements, and career goals",
  "keySkills": ["Skill 1", "Skill 2", "Skill 3", ...],
  "strengths": ["Strength 1", "Strength 2", ...],
  "weaknesses": ["Area to improve 1", "Area to improve 2", ...],
  "resumeScore": 85, // Score from 0-100
  "recommendations": ["Provide 3 actionable recommendations with specific steps", "Recommendation 2", "Recommendation 3"],
  "keyAchievements": ["Achievement 1 with metrics", "Achievement 2 with metrics", ...],
  "industryFit": ["Industry 1 - Rationale", "Industry 2 - Rationale", ...],
  "recommendedJobTitles": ["Recommended position 1", "Recommended position 2", ...],
  "skillGaps": ["Missing skill 1", "Missing skill 2", ...],
  "detailedAnalysis": {
    "professionalProfile": "300-400 word detailed profile summary including experience, achievements, career goals, and unique value proposition",
    "keyAchievements": ["Achievement 1 with metrics", "Achievement 2 with metrics", ...],
    "industryFit": ["Industry 1 - Rationale", "Industry 2 - Rationale", ...],
    "recommendedJobTitles": ["Job title 1 - Rationale", "Job title 2 - Rationale", ...],
    "skillGaps": ["Skill gap 1 - How to improve", "Skill gap 2 - How to improve", ...]
  }
}

IMPORTANT: Your response MUST be a valid JSON object. Do not include any text outside the JSON structure.
IMPORTANT: ALL content must be in ENGLISH only. Do not use any other language in your response.
IMPORTANT: Be specific and detailed in your analysis. Include actual metrics, project names, technologies, and other concrete details from the resume whenever possible.`
          },
          {
            role: "user",
            content: resumeText
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 60000 // 60 saniye timeout
      }
    );

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      console.error('Invalid response from DeepSeek API:', response.data);
      throw new Error('Invalid response from DeepSeek API');
    }

    const content = response.data.choices[0].message.content;
    
    try {
      // JSON yanıtını ayrıştır
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON response not found in API response');
      }
      
      const jsonContent = jsonMatch[0];
      const parsedResult = JSON.parse(jsonContent);
      
      return parsedResult;
    } catch (parseError) {
      console.error('Error parsing DeepSeek API response:', parseError);
      console.error('Raw content:', content);
      throw new Error('Failed to parse DeepSeek API response');
    }
  } catch (error) {
    console.error('DeepSeek API error:', error.message);
    
    if (error.response) {
      console.error('DeepSeek API response error:', error.response.data);
      throw new Error(`DeepSeek API error: ${error.response.data.error || 'Unknown error'}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('DeepSeek API timeout');
    } else if (error.request) {
      throw new Error('No response from DeepSeek API');
    } else {
      throw error;
    }
  }
}

// Merge results from both APIs
function mergeAPIResults(deepseekResult, openaiResult) {
  console.log('Merging API results from DeepSeek and OpenAI');
  
  // Create a merged object with data from both APIs
  const mergedAnalysis = {
    // Prefer OpenAI summary if available, otherwise use DeepSeek
    summary: openaiResult.summary || deepseekResult.summary || '',
    
    // Combine skills from both APIs, removing duplicates
    skills: [...new Set([
      ...(Array.isArray(openaiResult.personalSkills) ? openaiResult.personalSkills : []),
      ...(Array.isArray(openaiResult.skills) ? openaiResult.skills : []),
      ...(Array.isArray(deepseekResult.keySkills) ? deepseekResult.keySkills : [])
    ])],
    
    // Combine strengths from both APIs
    strengths: [...new Set([
      ...(Array.isArray(openaiResult.strengths) ? openaiResult.strengths : []),
      ...(Array.isArray(deepseekResult.strengths) ? deepseekResult.strengths : [])
    ])],
    
    // Combine areas to improve from both APIs
    areasToImprove: [...new Set([
      ...(Array.isArray(openaiResult.areasToImprove) ? openaiResult.areasToImprove : []),
      ...(Array.isArray(deepseekResult.weaknesses) ? deepseekResult.weaknesses : [])
    ])],
    
    // Combine recommendations from both APIs
    recommendations: [...new Set([
      ...(Array.isArray(openaiResult.recommendations) ? openaiResult.recommendations : []),
      ...(Array.isArray(deepseekResult.recommendations) ? deepseekResult.recommendations : [])
    ])],
    
    // Combine job titles from both APIs
    jobTitles: [...new Set([
      ...(Array.isArray(openaiResult.recommendedJobTitles) ? openaiResult.recommendedJobTitles : []),
      ...(Array.isArray(deepseekResult.recommendedJobTitles) ? deepseekResult.recommendedJobTitles : [])
    ])],
    
    // Use resume score from either API
    resumeScore: openaiResult.resumeScore || deepseekResult.resumeScore || 75,
    
    // Combine detailed analysis from both APIs
    detailedAnalysis: {
      professionalProfile: openaiResult.detailedAnalysis?.professionalProfile || 
                          deepseekResult.professionalProfile || '',
      
      keyAchievements: Array.isArray(openaiResult.detailedAnalysis?.keyAchievements) ? 
                      openaiResult.detailedAnalysis.keyAchievements : 
                      (Array.isArray(deepseekResult.keyAchievements) ? 
                       deepseekResult.keyAchievements : []),
      
      industryFit: Array.isArray(openaiResult.detailedAnalysis?.industryFit) ? 
                  openaiResult.detailedAnalysis.industryFit : 
                  (Array.isArray(deepseekResult.industryFit) ? 
                   deepseekResult.industryFit : []),
      
      recommendedJobTitles: Array.isArray(openaiResult.detailedAnalysis?.recommendedJobTitles) ? 
                           openaiResult.detailedAnalysis.recommendedJobTitles : 
                           (Array.isArray(deepseekResult.recommendedJobTitles) ? 
                            deepseekResult.recommendedJobTitles : []),
      
      skillGaps: Array.isArray(openaiResult.detailedAnalysis?.skillGaps) ? 
                openaiResult.detailedAnalysis.skillGaps : 
                (Array.isArray(deepseekResult.skillGaps) ? 
                 deepseekResult.skillGaps : [])
    }
  };
  
  console.log('Merged analysis created successfully');
  return mergedAnalysis;
}

// API yanıtını işle
const processAPIResponse = (data) => {
  try {
    // Parse data if it's a string
    let parsedData;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (parseError) {
        console.error('Error parsing API response as JSON:', parseError);
        
        // If JSON parsing fails, try to find JSON in the text
        const jsonMatch = data.match(/```json\n([\s\S]*?)\n```/) || 
                         data.match(/{[\s\S]*}/);
        
        if (jsonMatch) {
          try {
            parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          } catch (nestedParseError) {
            console.error('Error parsing extracted JSON:', nestedParseError);
            throw new Error('Failed to parse API response');
          }
        } else {
          throw new Error('No JSON found in API response');
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      parsedData = data;
    } else {
      throw new Error('Invalid API response format');
    }
    
    // Create a standardized response format
    const standardizedResponse = {
      summary: parsedData.summary || '',
      strengths: Array.isArray(parsedData.strengths) ? parsedData.strengths : [],
      areasToImprove: Array.isArray(parsedData.areasToImprove) ? parsedData.areasToImprove : 
                     Array.isArray(parsedData.weaknesses) ? parsedData.weaknesses : [],
      recommendations: Array.isArray(parsedData.recommendations) ? parsedData.recommendations : [],
      skills: Array.isArray(parsedData.personalSkills) ? parsedData.personalSkills : 
             Array.isArray(parsedData.keySkills) ? parsedData.keySkills : [],
      resumeScore: parsedData.resumeScore || 75,
      jobTitles: Array.isArray(parsedData.recommendedJobTitles) ? parsedData.recommendedJobTitles : [],
      
      // Handle detailed analysis
      detailedAnalysis: parsedData.detailedAnalysis || {}
    };
    
    // If detailedAnalysis is missing but we have professionalProfile, create it
    if (!parsedData.detailedAnalysis && parsedData.professionalProfile) {
      standardizedResponse.detailedAnalysis = {
        professionalProfile: parsedData.professionalProfile,
        keyAchievements: Array.isArray(parsedData.keyAchievements) ? parsedData.keyAchievements : 
                        typeof parsedData.keyAchievements === 'string' ? [parsedData.keyAchievements] : [],
        industryFit: Array.isArray(parsedData.industryFit) ? parsedData.industryFit : 
                    typeof parsedData.industryFit === 'string' ? [parsedData.industryFit] : [],
        recommendedJobTitles: Array.isArray(parsedData.recommendedJobTitles) ? parsedData.recommendedJobTitles : [],
        skillGaps: Array.isArray(parsedData.skillGaps) ? parsedData.skillGaps : []
      };
    }
    
    console.log('Standardized response created successfully');
    return standardizedResponse;
  } catch (error) {
    console.error('Error processing API response:', error);
    
    // Return a fallback response
    return {
      summary: 'Could not analyze resume properly. Please try again.',
      strengths: ['Technical skills', 'Professional experience'],
      areasToImprove: ['Add more quantifiable achievements', 'Enhance skill descriptions'],
      recommendations: [
        'Add quantitative achievements to your resume',
        'Describe your skills in more detail',
        'Include concrete results for each work experience'
      ],
      skills: ['Communication', 'Problem Solving', 'Teamwork', 'Analytical Thinking', 'Organization'],
      resumeScore: 50,
      jobTitles: ['Professional', 'Specialist', 'Analyst'],
      detailedAnalysis: {
        professionalProfile: 'Could not generate a detailed profile. Please try again with a more complete resume.',
        keyAchievements: [],
        industryFit: [],
        recommendedJobTitles: [],
        skillGaps: []
      }
    };
  }
};

// Function for simple text analysis
function createBasicAnalysis(resumeText) {
  console.log('Creating basic analysis from resume text');
  
  // Search for keywords in text
  const skills = extractSkills(resumeText);
  const education = extractEducation(resumeText);
  const experience = extractExperience(resumeText);
  const achievements = extractAchievements(resumeText);
  const industries = extractIndustries(resumeText);
  const jobTitles = extractJobTitles(resumeText, skills);
  const skillGaps = generateSkillGaps(skills, jobTitles);
  
  // Calculate resume score
  const resumeScore = calculateResumeScore({
    skills,
    education,
    experience,
    achievements,
    textLength: resumeText.length
  });
  
  // Generate professional profile
  const professionalProfile = generateProfessionalProfile(resumeText, {
    skills,
    education,
    experience,
    industries
  });
  
  // Determine strengths
  const strengths = determineStrengths(resumeText, {
    skills,
    education,
    experience,
    achievements
  });
  
  // Determine weaknesses
  const weaknesses = determineWeaknesses(resumeText, {
    skills,
    education,
    experience,
    achievements
  });
  
  // Generate recommendations
  const recommendations = generateRecommendations(weaknesses);
  
  // Create a simple analysis object
  return {
    professionalProfile,
    keySkills: skills,
    strengths,
    weaknesses,
    resumeScore,
    recommendations,
    keyAchievements: achievements.length > 0 
      ? achievements.join(". ") 
      : "No significant achievements could be extracted from your resume. Please add your concrete achievements to your resume.",
    industryFit: industries.length > 0 
      ? `Your resume appears suitable for the following industries: ${industries.join(", ")}` 
      : "Your resume shows a generally professional profile.",
    recommendedJobTitles: jobTitles,
    skillGaps
  };
}

// Function to calculate resume score
function calculateResumeScore({ skills, education, experience, achievements, textLength }) {
  let score = 50; // Starting score
  
  // Add points based on number of skills (max 15 points)
  score += Math.min(skills.length * 2, 15);
  
  // Add points based on education
  if (education) score += 10;
  
  // Add points based on experience
  if (experience) score += 10;
  
  // Add points based on number of achievements (max 10 points)
  score += Math.min(achievements.length * 2, 10);
  
  // Add points based on resume length (max 5 points)
  score += Math.min(Math.floor(textLength / 500), 5);
  
  // Limit score to 0-100 range
  return Math.max(0, Math.min(100, score));
}

// Function to generate professional profile
function generateProfessionalProfile(text, { skills, education, experience, industries }) {
  let profile = "Your resume has been analyzed. ";
  
  if (skills.length > 0) {
    profile += `You appear to be a professional with skills such as ${skills.slice(0, 3).join(", ")}. `;
  }
  
  if (experience) {
    profile += "Your professional work experience is mentioned in your resume. ";
  }
  
  if (education) {
    profile += "Your educational background is included in your resume. ";
  }
  
  if (industries.length > 0) {
    profile += `Your resume shows experience in the ${industries.join(", ")} industries. `;
  }
  
  profile += "For a more detailed analysis, you can update your resume and try again.";
  
  return profile;
}

// Function to determine strengths
function determineStrengths(text, { skills, education, experience, achievements }) {
  const strengths = [];
  
  if (skills.length >= 5) {
    strengths.push("Broad skill set");
  }
  
  if (skills.length > 0) {
    strengths.push(`Expertise in ${skills[0]}`);
  }
  
  if (education) {
    strengths.push("Educational background");
  }
  
  if (experience) {
    strengths.push("Professional experience");
  }
  
  if (achievements.length > 0) {
    strengths.push("Proven achievements");
  }
  
  // If no strengths are found, add default values
  if (strengths.length === 0) {
    strengths.push(
      "Skills mentioned in your resume",
      "Professional approach",
      "Self-expression ability"
    );
  }
  
  return strengths;
}

// Function to determine weaknesses
function determineWeaknesses(text, { skills, education, experience, achievements }) {
  const weaknesses = [];
  
  if (skills.length < 5) {
    weaknesses.push("Limited skill set");
  }
  
  if (!education) {
    weaknesses.push("Missing or insufficient education information");
  }
  
  if (!experience) {
    weaknesses.push("Missing or insufficient work experience");
  }
  
  if (achievements.length === 0) {
    weaknesses.push("No concrete achievements mentioned");
  }
  
  if (text.length < 1000) {
    weaknesses.push("Resume content is short and insufficient");
  }
  
  // If no weaknesses are found, add default values
  if (weaknesses.length === 0) {
    weaknesses.push(
      "Your resume could include more quantitative results",
      "Describe your skills in more detail",
      "You could add industry-specific keywords"
    );
  }
  
  return weaknesses;
}

// Function to generate recommendations
function generateRecommendations(weaknesses) {
  const recommendationMap = {
    "Limited skill set": "Add more technical and personal skills to your resume",
    "Missing or insufficient education information": "Detail your education information and add relevant courses",
    "Missing or insufficient work experience": "List your work experiences chronologically and in detail",
    "No concrete achievements mentioned": "Add measurable achievements for each work experience",
    "Resume content is short and insufficient": "Make your resume more comprehensive"
  };
  
  // Create recommendations based on weaknesses
  const recommendations = weaknesses.map(weakness => 
    recommendationMap[weakness] || `Improve on ${weakness}`
  );
  
  // If there are no recommendations, add default recommendations
  if (recommendations.length === 0) {
    return [
      "Add quantitative achievements to your resume",
      "Describe your skills in more detail",
      "Include concrete results for each work experience"
    ];
  }
  
  return recommendations;
}

// Helper function to extract achievements from text
function extractAchievements(text) {
  // Achievement-related keywords
  const achievementKeywords = [
    'achieved', 'improved', 'increased', 'decreased', 'reduced', 'saved',
    'developed', 'created', 'implemented', 'launched', 'led', 'managed',
    'award', 'recognition', 'certificate', 'honor', 'prize', 'scholarship',
    'achievement', 'developed', 'increased', 'decreased', 'saved', 'award', 'certificate'
  ];
  
  // Split text into sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Find sentences containing achievements
  const achievementSentences = sentences.filter(sentence => 
    achievementKeywords.some(keyword => 
      sentence.toLowerCase().includes(keyword.toLowerCase())
    )
  );
  
  // Return at most 5 achievement sentences
  return achievementSentences.slice(0, 5);
}

// Helper function to extract industries from text
function extractIndustries(text) {
  // Common industry keywords
  const industryKeywords = [
    'Technology', 'IT', 'Software', 'Healthcare', 'Finance', 'Banking',
    'Education', 'Manufacturing', 'Retail', 'E-commerce', 'Marketing',
    'Advertising', 'Media', 'Entertainment', 'Hospitality', 'Tourism',
    'Construction', 'Real Estate', 'Automotive', 'Aerospace', 'Energy',
    'Telecommunications', 'Consulting', 'Legal', 'Government', 'Non-profit',
    'Technology', 'Software', 'Healthcare', 'Finance', 'Banking', 'Education',
    'Manufacturing', 'Retail', 'E-commerce', 'Marketing', 'Advertising', 'Media',
    'Entertainment', 'Tourism', 'Construction', 'Automotive', 'Energy', 'Telecommunications',
    'Consulting', 'Legal', 'Government', 'Non-profit'
  ];
  
  // Convert text to lowercase and check each industry
  const lowerText = text.toLowerCase();
  const foundIndustries = industryKeywords.filter(industry => 
    lowerText.includes(industry.toLowerCase())
  );
  
  // Return at most 3 industries
  return foundIndustries.slice(0, 3);
}

// Function to generate skill gaps
function generateSkillGaps(skills, jobTitles) {
  // Required skills for common job titles
  const jobSkillsMap = {
    'Software Developer': ['JavaScript', 'Python', 'Java', 'C#', 'Git', 'Agile'],
    'Software Engineer': ['Data Structures', 'Algorithms', 'System Design', 'CI/CD'],
    'Web Developer': ['HTML', 'CSS', 'JavaScript', 'React', 'Angular', 'Node.js'],
    'Frontend Developer': ['HTML', 'CSS', 'JavaScript', 'React', 'Vue', 'UI/UX'],
    'Full Stack Developer': ['Frontend', 'Backend', 'Database', 'API Design'],
    'Data Analyst': ['SQL', 'Excel', 'Data Visualization', 'Statistics'],
    'Data Engineer': ['SQL', 'ETL', 'Data Warehousing', 'Big Data'],
    'Database Administrator': ['SQL', 'Database Design', 'Performance Tuning'],
    'Project Manager': ['Project Management', 'Agile', 'Scrum', 'Leadership'],
    'Business Analyst': ['Requirements Analysis', 'Process Modeling', 'Documentation'],
    'Marketing Specialist': ['Digital Marketing', 'SEO', 'Content Marketing'],
    'Administrative Assistant': ['Microsoft Office', 'Organization', 'Communication'],
    'Customer Service Representative': ['Communication', 'Problem Solving', 'Patience']
  };
  
  // Convert existing skills to lowercase
  const lowerSkills = skills.map(skill => skill.toLowerCase());
  
  // Determine required skills based on job titles
  let requiredSkills = new Set();
  jobTitles.forEach(title => {
    const skillsForJob = jobSkillsMap[title] || [];
    skillsForJob.forEach(skill => requiredSkills.add(skill));
  });
  
  // Find missing skills
  const missingSkills = Array.from(requiredSkills).filter(skill => 
    !lowerSkills.includes(skill.toLowerCase())
  );
  
  // If no missing skills are found, return default values
  if (missingSkills.length === 0) {
    return [
      "Industry-specific certifications",
      "Leadership experience",
      "Project management skills"
    ];
  }
  
  // Return at most 5 missing skills
  return missingSkills.slice(0, 5);
}

// Helper function to extract skills from text
function extractSkills(text) {
  // Common skill keywords
  const skillKeywords = [
    'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin',
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
    'SQL', 'NoSQL', 'MongoDB', 'MySQL', 'PostgreSQL', 'Oracle', 'Firebase',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub',
    'Machine Learning', 'AI', 'Data Science', 'Big Data', 'Data Analysis',
    'Project Management', 'Agile', 'Scrum', 'Kanban', 'Jira', 'Confluence',
    'Leadership', 'Communication', 'Teamwork', 'Problem Solving', 'Critical Thinking',
    'Microsoft Office', 'Excel', 'PowerPoint', 'Word', 'Outlook',
    'Marketing', 'Sales', 'Customer Service', 'SEO', 'SEM', 'Content Marketing',
    'Accounting', 'Finance', 'Budgeting', 'Forecasting', 'Financial Analysis',
    'HR', 'Recruitment', 'Talent Management', 'Employee Relations', 'Training'
  ];
  
  // Convert text to lowercase and check each word
  const lowerText = text.toLowerCase();
  const foundSkills = skillKeywords.filter(skill => 
    lowerText.includes(skill.toLowerCase())
  );
  
  // If no skills are found, return general skills
  if (foundSkills.length === 0) {
    return ['Communication', 'Problem Solving', 'Teamwork', 'Analytical Thinking', 'Organization'];
  }
  
  return foundSkills.slice(0, 10); // Return at most 10 skills
}

// Helper function to extract education information from text
function extractEducation(text) {
  // Education-related keywords
  const educationKeywords = [
    'Bachelor', 'Master', 'PhD', 'Doctorate', 'BSc', 'MSc', 'BA', 'MA', 'MBA',
    'University', 'College', 'School', 'Institute', 'Academy',
    'Degree', 'Diploma', 'Certificate', 'Certification', 'Graduate', 'Undergraduate',
    'Bachelor', 'Master', 'PhD', 'University', 'School', 'Graduate'
  ];
  
  // Search for education keywords in text
  const hasEducation = educationKeywords.some(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return hasEducation;
}

// Helper function to extract experience information from text
function extractExperience(text) {
  // Experience-related keywords
  const experienceKeywords = [
    'Experience', 'Work', 'Job', 'Career', 'Employment', 'Position', 'Role',
    'Manager', 'Director', 'Lead', 'Senior', 'Junior', 'Intern', 'Specialist',
    'Coordinator', 'Supervisor', 'Assistant', 'Associate', 'Consultant',
    'Experience', 'Work', 'Career', 'Position', 'Role', 'Manager', 'Director', 'Leader'
  ];
  
  // Search for experience keywords in the text
  const hasExperience = experienceKeywords.some(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return hasExperience;
}

// Helper function to extract job titles from text and skills
function extractJobTitles(text, skills) {
  // Common job titles
  const commonTitles = [
    'Software Engineer', 'Software Developer', 'Web Developer', 'Frontend Developer',
    'Backend Developer', 'Full Stack Developer', 'Mobile Developer', 'iOS Developer',
    'Android Developer', 'Data Scientist', 'Data Analyst', 'Business Analyst',
    'Product Manager', 'Project Manager', 'Scrum Master', 'DevOps Engineer',
    'System Administrator', 'Network Engineer', 'Cloud Engineer', 'Security Engineer',
    'QA Engineer', 'Test Engineer', 'UX Designer', 'UI Designer', 'Graphic Designer',
    'Marketing Manager', 'Sales Manager', 'Account Manager', 'Customer Success Manager',
    'HR Manager', 'Recruiter', 'Financial Analyst', 'Accountant', 'Content Writer'
  ];
  
  // Determine appropriate job titles based on skills and text content
  let recommendedTitles = [];
  
  // Programming languages and technologies
  const techSkills = ['JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin'];
  const webSkills = ['React', 'Angular', 'Vue', 'HTML', 'CSS', 'Node.js', 'Express', 'Django', 'Flask'];
  const dataSkills = ['SQL', 'NoSQL', 'MongoDB', 'MySQL', 'PostgreSQL', 'Data Analysis', 'Machine Learning', 'AI'];
  
  // Suggest job titles based on skills
  const foundTechSkills = skills.filter(skill => techSkills.includes(skill));
  const foundWebSkills = skills.filter(skill => webSkills.includes(skill));
  const foundDataSkills = skills.filter(skill => dataSkills.includes(skill));
  
  if (foundTechSkills.length > 0) {
    recommendedTitles.push('Software Developer', 'Software Engineer');
  }
  
  if (foundWebSkills.length > 0) {
    recommendedTitles.push('Web Developer', 'Frontend Developer', 'Full Stack Developer');
  }
  
  if (foundDataSkills.length > 0) {
    recommendedTitles.push('Data Analyst', 'Database Administrator', 'Data Engineer');
  }
  
  // If no suitable titles are found, suggest general titles
  if (recommendedTitles.length === 0) {
    recommendedTitles = [
      'Project Manager',
      'Business Analyst',
      'Marketing Specialist',
      'Administrative Assistant',
      'Customer Service Representative'
    ];
  }
  
  // Remove duplicate titles and return at most 5 titles
  return [...new Set(recommendedTitles)].slice(0, 5);
}

module.exports = router;
