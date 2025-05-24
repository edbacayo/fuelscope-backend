const express = require('express');
const Vehicle = require('../models/Vehicle');
const Expense = require('../models/Expense');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const router = express.Router();

// Get all vehicles with user info and expense counts
// GET /api/admin/vehicles
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

// Delete a vehicle and all its expenses (admin only)
// DELETE /api/admin/vehicles/:id
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
