// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   POST /api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
  console.log('Register request received:', req.body);
  
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      console.log('Missing required fields:', { name, email, password: !!password });
      return res.status(400).json({ 
        error: 'Please fill in all fields' 
      });
    }

    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('Invalid email format:', email);
      return res.status(400).json({ 
        error: 'Please enter a valid email address' 
      });
    }

    // Check password strength
    if (password.length < 6) {
      console.log('Password too short');
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      console.log('User already exists:', email);
      return res.status(400).json({
        error: 'This email is already registered'
      });
    }

    // Create new user
    user = new User({
      name,
      email,
      password
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user
    await user.save();
    console.log('User saved successfully:', user.id);

    // Create token
    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) {
          console.error('JWT Sign error:', err);
          throw err;
        }
        res.json({ token });
      }
    );

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({
      error: 'An error occurred during registration',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user & get token
// @access  Public
router.post('/login', async (req, res) => {
  console.log('Login request received:', { email: req.body.email });
  
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({
        error: 'Please fill in all fields'
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({
        error: 'User not found'
      });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Invalid password for user:', email);
      return res.status(400).json({
        error: 'Invalid email or password'
      });
    }

    // Create token
    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) {
          console.error('JWT Sign error:', err);
          throw err;
        }
        res.json({ token });
      }
    );

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      error: 'An error occurred during login',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// @route   GET /api/auth/user
// @desc    Get user data
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    // Get user data (exclude password)
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({
      error: 'An error occurred while getting user information'
    });
  }
});

// @route   GET /api/auth/status
// @desc    Get auth system status
// @access  Public
router.get('/status', async (req, res) => {
  try {
    // Get total user count
    const userCount = await User.countDocuments();
    
    // Get last registered user (masked email)
    const lastUser = await User.findOne().sort({ createdAt: -1 }).select('email createdAt');
    
    let maskedEmail = null;
    if (lastUser) {
      const [username, domain] = lastUser.email.split('@');
      maskedEmail = `${username[0]}${'*'.repeat(username.length - 2)}${username.slice(-1)}@${domain}`;
    }

    res.json({
      status: 'active',
      userCount,
      lastRegistration: lastUser ? {
        email: maskedEmail,
        time: lastUser.createdAt
      } : null
    });
  } catch (err) {
    console.error('Status check error:', err);
    res.status(500).json({
      error: 'An error occurred while checking system status'
    });
  }
});

module.exports = router;
