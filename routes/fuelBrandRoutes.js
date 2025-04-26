const express = require('express');
const FuelBrand = require('../models/FuelBrand');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

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
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Fuel brand name is required' });
        }

        const existingBrand = await FuelBrand.findOne({ name });
        if (existingBrand) {
            return res.status(400).json({ error: 'Fuel brand already exists' });
        }

        // explicitly set isActive to true to match schema default
        const newFuelBrand = new FuelBrand({ name, isActive: true });
        await newFuelBrand.save();
        res.status(201).json(newFuelBrand);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Soft delete fuel brand (admin only) 
router.patch('/:id/disable', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const fuelBrand = await FuelBrand.findById(req.params.id);
        if (!fuelBrand) {
            return res.status(404).json({ error: 'Fuel brand not found' });
        }

        // soft delete the fuel brand
        fuelBrand.isActive = false;
        await fuelBrand.save();

        res.json(fuelBrand);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// enable fuel brand
router.patch('/:id/enable', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const fuelBrand = await FuelBrand.findById(req.params.id);
        if (!fuelBrand) {
            return res.status(404).json({ error: 'Fuel brand not found' });
        }

        fuelBrand.isActive = true;
        await fuelBrand.save();

        res.json(fuelBrand);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Update a fuel brand (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name, isActive } = req.body;
        const brand = await FuelBrand.findById(req.params.id);
        if (!brand) return res.status(404).json({ error: 'Fuel brand not found' });

        brand.name = name ?? brand.name;
        if (typeof isActive === 'boolean') brand.isActive = isActive;

        await brand.save();
        res.json(brand);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});


module.exports = router;