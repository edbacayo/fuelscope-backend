const express = require('express');
const Expense = require('../models/Expense');
const Vehicle = require('../models/Vehicle'); // ✅ Ensure expense is tied to user's vehicle
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Permanently delete all soft-deleted expenses
// purge route placed before the /:id route to avoid treating /purge as in :id
router.delete('/purge', authMiddleware, async (req, res) => {
    try {
        await Expense.deleteMany({ isDeleted: true });
        res.json({ message: 'All soft-deleted expenses permanently removed' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


// Add an expense and handle fuel efficiency & service reminders
router.post('/', authMiddleware, async (req, res) => {
    try {
        const {
            vehicleId, type, fuelDetails, serviceDetails, odometer, totalCost, date, notes, reminderToSend
        } = req.body;

        const vehicle = await Vehicle.findById(vehicleId);

        if (!vehicle || vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only add expenses to your own vehicles' });
        }

        // ✅ Check for existing duplicate (both soft-deleted & active entries)
        const duplicateQuery = {
            vehicleId,
            type,
            odometer,
            totalCost,
            date,
            isDeleted: false // Check only active records
        };

        if (type === 'fuel') {
            duplicateQuery['fuelDetails.fuelBrand'] = fuelDetails.fuelBrand;
        } else if (type === 'service') {
            duplicateQuery['serviceDetails.serviceType'] = serviceDetails.serviceType;
        }

        const { forceAdd } = req.body;
        const existingExpense = await Expense.findOne(duplicateQuery);

        if (existingExpense && !forceAdd) {
            return res.status(409).json({
                error: 'Duplicate expense detected.',
                message: 'A similar expense already exists. Do you still want to add this?',
                duplicate: existingExpense
            });
        }

        // ✅ Check for soft-deleted duplicate
        duplicateQuery.isDeleted = true;
        const softDeletedExpense = await Expense.findOne(duplicateQuery);

        if (softDeletedExpense) {
            // Restore the soft-deleted expense
            softDeletedExpense.isDeleted = false;
            await softDeletedExpense.save();
            return res.status(200).json({
                message: 'Soft-deleted expense restored successfully.',
                restoredExpense: softDeletedExpense
            });
        }

        // ✅ Update odometer if needed
        if (odometer > vehicle.odometer) {
            vehicle.odometer = odometer;
            await vehicle.save();
        }

        // ✅ Validate and handle different types
        let computedFuelDetails = null;

        if (type === 'fuel') {
            if (!fuelDetails || !fuelDetails.fuelBrand || !fuelDetails.pricePerLiter) {
                return res.status(400).json({ error: 'Fuel details (fuelBrand, pricePerLiter) are required for fuel entries.' });
            }

            const liters = totalCost / fuelDetails.pricePerLiter;
            computedFuelDetails = {
                ...fuelDetails,
                liters: parseFloat(liters.toFixed(3))
            };
        }

        if (type === 'service' && (!serviceDetails || !serviceDetails.serviceType)) {
            return res.status(400).json({ error: 'Service type is required for service entries.' });
        }

        // ✅ Create the new expense entry
        const newExpense = new Expense({
            userId: req.user.id,
            vehicleId,
            type,
            fuelDetails: computedFuelDetails || undefined,
            serviceDetails: type === 'service' ? serviceDetails : undefined,
            odometer,
            totalCost,
            date,
            notes
        });

        await newExpense.save();

        let efficiencyAlert = null;
        let serviceAlerts = [];

        // 🚦 Check for efficiency drop if the entry is a fuel entry
        if (type === 'fuel') {
            const lastFuelEntries = await Expense.find({
                vehicleId: vehicleId,
                type: 'fuel',
                _id: { $ne: newExpense._id }
            })
                .sort({ date: -1 })
                .limit(5);

            if (lastFuelEntries.length >= 5) {
                let totalEfficiency = 0;

                for (let i = 1; i < lastFuelEntries.length; i++) {
                    const previousEntry = lastFuelEntries[i];
                    const currentEntry = lastFuelEntries[i - 1];

                    if (previousEntry.fuelDetails && currentEntry.fuelDetails) {
                        const distance = currentEntry.odometer - previousEntry.odometer;
                        const liters = currentEntry.fuelDetails.liters;

                        if (distance > 0 && liters > 0) {
                            totalEfficiency += distance / liters;
                        }
                    }
                }

                const movingAverage = totalEfficiency / (lastFuelEntries.length - 1);

                const previousOdometer = lastFuelEntries[0].odometer;
                const distanceTraveled = odometer - previousOdometer;
                const currentEfficiency = distanceTraveled / computedFuelDetails.liters;

                if (currentEfficiency < movingAverage * 0.8) {
                    efficiencyAlert = `⚠️ Significant drop detected! Your fuel efficiency has dropped by more than 20% compared to your recent average.`;
                }
            }
        }

        // 🔄 Handle service reminders reset and check for due services
        if (type === 'service') {
            let reminderExists = false;

            vehicle.serviceReminders.forEach((reminder) => {
                if (
                    reminder.isEnabled && // ✅ Only update enabled reminders
                    reminder.type.toLowerCase() === serviceDetails.serviceType.toLowerCase()
                ) {
                    // ✅ Reset existing reminder
                    reminder.lastServiceDate = new Date(date);
                    reminder.lastServiceOdometer = odometer;
                    reminder.odometerInterval = reminderToSend.odometerInterval; // added so the existing intervals is also updated
                    reminder.timeIntervalMonths = reminderToSend.timeIntervalMonths; // added so the existing intervals is also updated
                    reminderExists = true; // Mark that the reminder exists
                }
            });

            // 🔥 If no matching reminder exists and user wants to enable a reminder
            if (!reminderExists && req.body.reminderToSend && req.body.reminderToSend.isEnabled) {
                vehicle.serviceReminders.push({
                    type: serviceDetails.serviceType,
                    odometerInterval: reminderToSend.odometerInterval,
                    timeIntervalMonths: reminderToSend.timeIntervalMonths,
                    lastServiceDate: new Date(date),
                    lastServiceOdometer: odometer,
                    isEnabled: true // ✅ Only add if user enabled it
                });
            }

            await vehicle.save();
        }


        // 🔔 Check if any reminders are due
        vehicle.serviceReminders.forEach((reminder) => {
            if (reminder.isEnabled) {
                const dueOdometer = reminder.lastServiceOdometer + reminder.odometerInterval;
                const dueDate = new Date(reminder.lastServiceDate);
                dueDate.setMonth(dueDate.getMonth() + reminder.timeIntervalMonths);

                if (odometer >= dueOdometer) {
                    serviceAlerts.push(`🚗 Service due: ${reminder.type} (Odometer)`);
                }

                if (new Date() >= dueDate) {
                    serviceAlerts.push(`🕒 Service due: ${reminder.type} (Time-based)`);
                }
            }
        });

        res.status(201).json({
            message: 'Expense recorded successfully',
            alert: efficiencyAlert,
            serviceAlerts,
            expense: newExpense
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});



// Get all active expenses for a vehicle (with explicit authorization check)
router.get('/:vehicleId', authMiddleware, async (req, res) => {
    try {
        // Step 1: Verify if the vehicle exists and belongs to the logged-in user
        const vehicle = await Vehicle.findById(req.params.vehicleId);

        if (!vehicle || vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only view expenses for your own vehicles' });
        }

        // Step 2: Fetch active (non-deleted) expenses for the authorized vehicle
        const expenses = await Expense.find({
            vehicleId: req.params.vehicleId,
            isDeleted: false
        });

        res.json(expenses);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


// Soft-delete an expense entry
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense || expense.userId.toString() !== req.user.id) {
            return res.status(404).json({ error: 'Expense not found or unauthorized' });
        }

        // Mark the expense as soft-deleted
        expense.isDeleted = true;
        expense.deletedBy = req.user.id; // Optional for tracking who deleted
        expense.deletedAt = new Date(); // Timestamp for deletion
        await expense.save();

        // Find the associated vehicle and ensure the user owns it
        const vehicle = await Vehicle.findOne({ _id: expense.vehicleId, userId: req.user.id });
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // ✅ If the deleted expense was a service, update the related reminder
        if (expense.type === 'service' && expense.serviceDetails) {
            const serviceType = expense.serviceDetails.serviceType;

            // Find the most recent service entry (excluding the deleted one)
            const mostRecentService = await Expense.findOne({
                vehicleId: expense.vehicleId,
                type: 'service',
                'serviceDetails.serviceType': serviceType,
                isDeleted: false, // Exclude deleted services
                _id: { $ne: expense._id } // Exclude the current one being deleted
            }).sort({ date: -1, _id: -1 }); // Ensure proper sorting

            let reminder = vehicle.serviceReminders.find(r => r.type === serviceType);
            if (reminder) {
                if (mostRecentService && new Date(mostRecentService.date) > new Date(reminder.lastServiceDate)) {
                    // ✅ Update reminder only if the new date is more recent
                    reminder.lastServiceDate = new Date(mostRecentService.date);
                    reminder.lastServiceOdometer = mostRecentService.odometer;
                } else if (!mostRecentService) {
                    // ❌ No previous service record found → Disable the reminder
                    reminder.isEnabled = false;
                }
                await vehicle.save();
            }
        }

        res.json({ message: 'Expense marked as deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});



// Update an expense (Only if it belongs to the logged-in user)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { type, odometer, pricePerLiter, totalCost, fuelBrand, date } = req.body;

        if (!type || odometer == null || totalCost == null || !date) {
            return res.status(400).json({ error: 'Type, odometer, totalCost, and date are required' });
        }

        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        // Ensure the logged-in user owns the expense
        if (expense.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only update your own expenses' });
        }

        expense.type = type;
        expense.odometer = odometer;
        expense.pricePerLiter = pricePerLiter;
        expense.totalCost = totalCost;
        expense.fuelBrand = fuelBrand;
        expense.date = date;
        await expense.save();

        res.json({ message: 'Expense updated successfully', expense });
    } catch (err) {
        console.log('Error: ', err.message);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Function to check if a service reminder is due
const checkServiceReminderDue = (reminder, currentOdometer) => {
    const { odometerInterval, timeIntervalMonths, lastServiceOdometer, lastServiceDate, isEnabled } = reminder;

    if (!isEnabled) return false; // Skip disabled reminders

    // Check odometer interval
    const dueByOdometer = lastServiceOdometer + odometerInterval;

    // Check time interval
    const dueByDate = new Date(lastServiceDate);
    dueByDate.setMonth(dueByDate.getMonth() + timeIntervalMonths);

    const now = new Date();

    // Trigger reminder if odometer or date conditions are met
    return currentOdometer >= dueByOdometer || now >= dueByDate;
};


module.exports = router;
