const express = require('express');
const ServiceType = require('../models/ServiceType');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// Get all service types
router.get('/', authMiddleware, async (req, res) => {
    try {
        const serviceType = await ServiceType.find().sort({ type: 1 });
        console.log('***** serviceType ', serviceType);
        res.json(serviceType);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Add a new service type (admin only) 
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { serviceType } = req.body;
        if (!serviceType) {
            return res.status(400).json({ error: 'Service type is required' });
        }

        const existing = await ServiceType.findOne({ serviceType });
        if (existing) { 
            return res.status(400).json({ error: 'Service type already exists' });
        }

        const newService = new ServiceType({ serviceType });
        await newService.save();
        res.status(201).json(newService);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete service type (admin only) 
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await ServiceType.findByIdAndDelete(req.params.id);
        res.json({ message: 'Service type deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;