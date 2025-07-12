const express = require('express');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Expense = require('../models/Expense');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude passwords
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

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

router.post('/users/:userId/reset-password', authMiddleware, adminMiddleware, authController.resetUserPassword);

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
        // Delete the user
        await User.findByIdAndDelete(userId);

        res.json({ message: 'User and all related vehicles and expenses deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

router.get('/vehicles', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // Get all vehicles
        const vehicles = await Vehicle.find({}).lean();
        
        // Get user info for each vehicle
        const userIds = [...new Set(vehicles.map(v => v.userId))];
        const users = await User.find({ _id: { $in: userIds } }).lean();
        const userMap = {};
        users.forEach(user => {
            userMap[user._id.toString()] = user.name;
        });
        
        // Get expense counts and latest expense date for each vehicle
        const vehicleData = await Promise.all(vehicles.map(async (vehicle) => {
            const expenseCount = await Expense.countDocuments({ 
                vehicleId: vehicle._id, 
                isDeleted: false 
            });
            
            const latestExpense = await Expense.findOne({ 
                vehicleId: vehicle._id, 
                isDeleted: false 
            }).sort({ date: -1 });
            
            return {
                ...vehicle,
                userName: userMap[vehicle.userId.toString()] || 'Unknown',
                expenseCount,
                lastExpenseDate: latestExpense ? latestExpense.date : null
            };
        }));
        
        res.json(vehicleData);
    } catch (err) {
        console.error('Error fetching vehicles:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

router.delete('/vehicles/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        
        // Delete all expenses for this vehicle
        await Expense.deleteMany({ vehicleId: req.params.id });
        
        // Delete the vehicle
        await Vehicle.findByIdAndDelete(req.params.id);
        
        res.json({ message: 'Vehicle and all related expenses deleted successfully' });
    } catch (err) {
        console.error('Error deleting vehicle:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
