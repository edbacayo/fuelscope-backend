const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const authController = require('../controllers/authController');

const router = express.Router();

// 🔹 Get all users (Admin Only)
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude passwords
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// 🔹 Update User Role
router.put('/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) return res.status(404).json({ error: 'User not found' });

        user.role = role;
        await user.save();

        res.json({ message: 'User role updated successfully', user });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// 🔹 Disable a User Account
router.put('/users/:id/disable', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.disabled = true;
        await user.save();

        res.json({ message: 'User disabled successfully', user });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// 🔹 Reset User Password (Admin)
router.post('/users/:userId/reset-password', authMiddleware, adminMiddleware, authController.resetUserPassword);

// 🔹 Delete a User and all related data
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Find all vehicles belonging to the user
        const Vehicle = require('../models/Vehicle');
        const Expense = require('../models/Expense');
        const vehicles = await Vehicle.find({ userId });
        const vehicleIds = vehicles.map(v => v._id);

        // Delete all expenses related to these vehicles or directly to the user
        await Expense.deleteMany({ $or: [ { userId }, { vehicleId: { $in: vehicleIds } } ] });
        // Delete all vehicles
        await Vehicle.deleteMany({ userId });
        // Finally, delete the user
        await User.findByIdAndDelete(userId);

        res.json({ message: 'User and all related vehicles and expenses deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
