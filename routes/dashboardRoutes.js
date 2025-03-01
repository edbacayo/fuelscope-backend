const express = require('express');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const Expense = require('../models/Expense');
const router = express.Router();

// Dashboard Metrics Route
router.get('/:vehicleId', authMiddleware, async (req, res) => {
    try {
        const vehicleId = req.params.vehicleId;

        // Ensure that vehicleId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
            return res.status(400).json({ message: 'Invalid vehicle ID.' });
        }

        // Aggregate fuel costs
        const fuelData = await Expense.aggregate([
            {
                $match: {
                    vehicleId: new mongoose.Types.ObjectId(vehicleId),
                    userId: mongoose.Types.ObjectId.isValid(req.user.id)
                        ? mongoose.Types.ObjectId.createFromHexString(req.user.id)
                        : req.user.id,
                    type: 'fuel',
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: null,
                    totalFuelCost: { $sum: '$totalCost' },
                    totalLiters: { $sum: '$fuelDetails.liters' },
                    minOdometer: { $min: '$odometer' },
                    maxOdometer: { $max: '$odometer' }
                }
            }
        ]);
        

        // Aggregate service costs
        const serviceData = await Expense.aggregate([
            {
                $match: {
                    vehicleId: new mongoose.Types.ObjectId(vehicleId),
                    userId: new mongoose.Types.ObjectId(req.user.id),
                    type: 'service',
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: null,
                    totalServiceCost: { $sum: '$totalCost' }
                }
            }
        ]);

        // Handle missing data
        if (fuelData.length === 0 && serviceData.length === 0) {
            return res.status(404).json({ message: 'No fuel or service data found for the selected vehicle.' });
        }

        // Set defaults for missing fields
        const fuelStats = fuelData[0] || {
            totalFuelCost: 0,
            totalLiters: 0,
            minOdometer: 0,
            maxOdometer: 0
        };

        const serviceStats = serviceData[0] || {
            totalServiceCost: 0
        };

        // Calculate kilometers traveled and average cost per KM
        const kilometersTraveled = fuelStats.maxOdometer - fuelStats.minOdometer;
        const totalCost = fuelStats.totalFuelCost + serviceStats.totalServiceCost;
        const averageCostPerKm = kilometersTraveled > 0 ? totalCost / kilometersTraveled : 0;

        // Send response with metrics
        res.json({
            totalFuelCost: fuelStats.totalFuelCost,
            totalServiceCost: serviceStats.totalServiceCost,
            totalLiters: fuelStats.totalLiters,
            kilometersTraveled: kilometersTraveled,
            averageCostPerKm: averageCostPerKm.toFixed(2)
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
