const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { changePassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config();
const router = express.Router();

const regLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1, 
  message: 'Too many accounts created from this IP, try again after 15 minutes'
});

// Register a new user
router.post('/register', regLimiter, async (req, res) => {
    try {
        const { name, email, password, website, agreedToDisclaimerAt } = req.body; 

        if (website && website.trim() !== '') {
            return res.status(400).json({ message: 'Bot detected' });
        }

        // Disclaimer agreement required
        if (!agreedToDisclaimerAt) {
            return res.status(400).json({ message: 'You must agree to the Disclaimer.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ name, email, password: hashedPassword, role: 'user', agreedToDisclaimerAt });
        await user.save();

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });

        res.status(201).json({ 
            token, 
            user: { 
                id: user.id, 
                name, 
                email, 
                role: user.role } 
        });
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
});

// User Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user._id, role: user.role, mustResetPassword: user.mustResetPassword }, process.env.JWT_SECRET, { expiresIn: '2h' });

        res.json({ 
            token, 
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                role: user.role,
                mustResetPassword: user.mustResetPassword
            } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/change-password', authMiddleware, changePassword);

// Test route 
router.get('/test', (req, res) => {
    res.json({ message: 'Auth route is working' });
});

module.exports = router;
