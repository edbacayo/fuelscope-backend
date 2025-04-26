const express = require('express');
const ServiceType = require('../models/ServiceType');
const Expense = require('../models/Expense');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// Get all service types
router.get('/', authMiddleware, async (req, res) => {
    try {
        const serviceType = await ServiceType.find().sort({ type: 1 });
        res.json(serviceType);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Add a new service type (admin only) 
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { type, odometerInterval = 0, timeIntervalMonths = 0 } = req.body;
        if (!type) {
            return res.status(400).json({ error: 'Service type is required' });
        }

        const existing = await ServiceType.findOne({ type });
        if (existing) {
            return res.status(400).json({ error: 'Service type already exists' });
        }

        const newService = new ServiceType({ type, odometerInterval, timeIntervalMonths });
        await newService.save();
        res.status(201).json(newService);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete service type (admin only) 
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const serviceType = await ServiceType.findById(req.params.id);
        if (!serviceType) return res.status(404).json({ error: 'Service type not found' });
        const count = await Expense.countDocuments({ type: 'service', 'serviceDetails.serviceType': serviceType.type });
        const force = req.query.force === 'true';
        // Always ask for confirmation first
        if (!force) {
            const msg = count > 0
                ? `There are ${count} expenses using '${serviceType.type}'. Are you sure you want to delete it?`
                : `Are you sure you want to delete the service type '${serviceType.type}'?`;
            return res.status(409).json({
                message: msg,
                needConfirmation: true,
                count
            });
        }
        // Perform deletion when force=true
        await ServiceType.findByIdAndDelete(req.params.id);
        res.json({ message: 'Service type deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;