const express = require('express');
const FuelBrand = require('../models/FuelBrand');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleWare = require('../middleware/adminMiddleware');

const router = express.router();

// Get all fuel brands
router.get('/', authMiddleware, async (req, res) => {
    try {
        const fuelBrands = await FuelBrand.find().sort({ name: 1 });
        res.json(fuelBrands);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Add a new fuel brand (admin only) 
router.post('/', authMiddleware, adminMiddleWare, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Fuel brand name is required' });
        }

        const existingBrand = await FuelBrand.findOne({ name });
        if (existingBrand) {
            return res.status(400).json({ error: 'Fuel brand already exists' });
        }

        const newFuelBrand = new FuelBrand({ name });
        await newFuelBrand.save();
        res.status(201).json(newFuelBrand);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete fuel brand (admin only) 
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await FuelBrand.findByIdAndDelete(req.params.id);
        res.json({ message: 'Fuel brand deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;