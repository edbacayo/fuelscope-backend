const express = require('express');
const csvParser = require('csv-parser');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const Vehicle = require('../models/Vehicle');
const Expense = require('../models/Expense');

const router = express.Router();

// ✅ Fuel CSV Import Route with Accurate Duplicate Detection
router.post('/fuel/:vehicleId', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const vehicleId = req.params.vehicleId;
        const vehicle = await Vehicle.findById(vehicleId);

        if (!vehicle || vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only import data for your own vehicles.' });
        }

        const results = [];
        let highestOdometer = vehicle.odometer;
        let duplicatesSkipped = 0;

        // Store async operations here
        const processingPromises = [];

        fs.createReadStream(req.file.path)
            .pipe(
                csvParser({
                    mapHeaders: ({ header }) => header.trim(), // Remove spaces from headers
                    mapValues: ({ value }) => value.trim()    // Remove spaces from values
                })
            )
            .on('data', (row) => {
                // Push each row processing as a promise
                processingPromises.push(
                    (async () => {
                        try {
                            // Parse and validate numeric fields
                            const odometer = parseFloat(row.odometer);
                            const pricePerLiter = parseFloat(row.price);
                            let liters = parseFloat(row.litres) || (parseFloat(row.price) > 0 ? (parseFloat(row.price) ? parseFloat(row.litres) : 0) : 0); // ✅ Convert litres to liters
                            if (isNaN(liters) || liters <= 0) {
                                liters = parseFloat(row.price) > 0 ? parseFloat(row.price) : 0;
                            }

                            const totalCost = pricePerLiter * liters;
                            const date = new Date(row.fuelup_date);
                            const createdAt = new Date(); // Set the date of import to today

                            // ✅ Skip invalid rows
                            if (
                                isNaN(odometer) ||
                                isNaN(pricePerLiter) ||
                                isNaN(liters) ||
                                isNaN(totalCost) ||
                                date.toString() === 'Invalid Date'
                            ) {
                                console.warn(`Skipping invalid row:`, row);
                                return;
                            }

                            // ✅ Normalize the date range for duplicate detection
                            const startOfDay = new Date(date.setHours(0, 0, 0, 0));
                            const endOfDay = new Date(date.setHours(23, 59, 59, 999));

                            // ✅ Check for duplicates, including soft-deleted entries
                            const existingExpense = await Expense.findOne({
                                userId: req.user.id,
                                vehicleId: vehicleId,
                                odometer: odometer,
                                totalCost: totalCost,
                                type: 'fuel',
                                date: {
                                    $gte: startOfDay,
                                    $lt: endOfDay
                                }
                            });

                            if (existingExpense) {
                                if (existingExpense.isDeleted) {
                                    // ✅ Restore the soft-deleted entry
                                    existingExpense.isDeleted = false;
                                    existingExpense.fuelDetails = {
                                        fuelBrand: 'imported',
                                        pricePerLiter: pricePerLiter,
                                        liters: liters
                                    };
                                    existingExpense.notes = row.notes || '';
                                    existingExpense.date = date;
                                    existingExpense.totalCost = totalCost;
                                    existingExpense.odometer = odometer;

                                    await existingExpense.save();
                                    duplicatesSkipped++;
                                } else {
                                    // ✅ Entry already exists and is not soft-deleted
                                    duplicatesSkipped++;
                                }
                                return; // Skip creating a new entry
                            }

                            // ✅ Update highest odometer if the new entry has a higher value
                            if (odometer > highestOdometer) {
                                highestOdometer = odometer;
                            }

                            // ✅ Create a valid fuel entry
                            const fuelEntry = new Expense({
                                userId: req.user.id,
                                vehicleId: vehicleId,
                                type: 'fuel',
                                fuelDetails: {
                                    fuelBrand: 'imported',
                                    pricePerLiter: pricePerLiter,
                                    liters: liters
                                },
                                odometer: odometer,
                                totalCost: totalCost,
                                date: date, // Actual fuel-up date
                                createdAt: createdAt, // Date of import
                                notes: row.notes || ''
                            });

                            results.push(fuelEntry);
                        } catch (error) {
                            console.error('Error parsing row:', row, error);
                        }
                    })()
                );
            })
            .on('end', async () => {
                try {
                    // ✅ Wait for all row processing to complete
                    await Promise.all(processingPromises);

                    // ✅ Save all valid entries
                    await Expense.insertMany(results);

                    // ✅ Update the vehicle's odometer if needed
                    if (highestOdometer > vehicle.odometer) {
                        vehicle.odometer = highestOdometer;
                        await vehicle.save();
                    }

                    // ✅ Delete the uploaded file after processing
                    fs.unlinkSync(req.file.path);

                    res.status(201).json({
                        message: 'Fuel entries imported successfully',
                        imported: results.length,
                        duplicatesSkipped: duplicatesSkipped,
                        updatedOdometer: highestOdometer
                    });
                } catch (err) {
                    res.status(500).json({ error: 'Server error during saving data', details: err.message });
                }
            });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
