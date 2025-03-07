const express = require('express');
const Vehicle = require('../models/Vehicle');
const authMiddleware = require('../middleware/authMiddleware'); // Ensure we protect routes
const router = express.Router();

// ✅ Get upcoming service reminders for a vehicle
router.get('/:vehicleId/reminders', authMiddleware, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.vehicleId);

        if (!vehicle || vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only view reminders for your own vehicles' });
        }

        const upcomingReminders = [];
        const currentOdometer = vehicle.odometer;
        const currentDate = new Date();

        vehicle.serviceReminders.forEach((reminder) => {
            if (reminder.isEnabled) {
                const dueOdometer = reminder.lastServiceOdometer + reminder.odometerInterval;
                const dueDate = new Date(reminder.lastServiceDate);
                dueDate.setMonth(dueDate.getMonth() + reminder.timeIntervalMonths);

                // Set thresholds for upcoming reminders
                const kmThreshold = 1000; // Within 1000 km
                const timeThreshold = 30; // Within 30 days

                const daysUntilDue = Math.floor((dueDate - currentDate) / (1000 * 60 * 60 * 24));
                const kmUntilDue = dueOdometer - currentOdometer;

                if (kmUntilDue <= kmThreshold || daysUntilDue <= timeThreshold) {
                    upcomingReminders.push({
                        type: reminder.type,
                        dueOdometer,
                        dueDate: dueDate.toISOString(),
                        kmUntilDue: kmUntilDue > 0 ? kmUntilDue : 0,
                        daysUntilDue: daysUntilDue > 0 ? daysUntilDue : 0,
                    });
                }
            }
        });

        res.json(upcomingReminders);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Create a new vehicle
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, odometer } = req.body;

        if (!name || odometer == null) {
            return res.status(400).json({ error: 'Name and odometer are required' });
        }

        const newVehicle = new Vehicle({
            userId: req.user.id,
            name,
            odometer
        });

        await newVehicle.save();
        res.status(201).json(newVehicle);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ✅ Get a single vehicle by ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        if (vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only view your own vehicles' });
        }

        res.json(vehicle);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});


// Get all vehicles for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const vehicles = await Vehicle.find({ userId: req.user.id });
        res.json(vehicles);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete a vehicle (Only if it belongs to the logged-in user)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Check if the logged-in user is the owner of the vehicle
        if (vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only delete your own vehicles' });
        }

        await Vehicle.findByIdAndDelete(req.params.id);
        res.json({ message: 'Vehicle deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Update a vehicle (Only if it belongs to the logged-in user)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { name, odometer } = req.body;

        if (!name || odometer == null) {
            return res.status(400).json({ error: 'Name and odometer are required' });
        }

        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Ensure the logged-in user owns the vehicle
        if (vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only update your own vehicles' });
        }

        vehicle.name = name;
        vehicle.odometer = odometer;
        await vehicle.save();

        res.json({ message: 'Vehicle updated successfully', vehicle });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Add a new service reminder to a vehicle
router.post('/:id/reminders', authMiddleware, async (req, res) => {
    try {
        const { type, odometerInterval, timeIntervalMonths } = req.body;
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        if (vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only add reminders to your own vehicle' });
        }

        // Add the reminder
        vehicle.serviceReminders.push({
            type,
            odometerInterval,
            timeIntervalMonths,
            lastServiceDate: new Date(),
            lastServiceOdometer: vehicle.odometer
        });

        await vehicle.save();
        res.status(201).json({ message: 'Service reminder added successfully', vehicle });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Update a specific service reminder
router.put('/:vehicleId/reminders/:reminderId', authMiddleware, async (req, res) => {
    try {
        const { odometerInterval, timeIntervalMonths } = req.body;
        const vehicle = await Vehicle.findById(req.params.vehicleId);

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        const reminder = vehicle.serviceReminders.id(req.params.reminderId);
        if (!reminder) {
            return res.status(404).json({ error: 'Service reminder not found' });
        }

        if (vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only update your own reminders' });
        }

        // Update reminder details
        reminder.odometerInterval = odometerInterval || reminder.odometerInterval;
        reminder.timeIntervalMonths = timeIntervalMonths || reminder.timeIntervalMonths;

        await vehicle.save();
        res.json({ message: 'Service reminder updated successfully', reminder });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Enable/Disable a service reminder
router.patch('/:vehicleId/reminders/:reminderId/toggle', authMiddleware, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.vehicleId);

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        const reminder = vehicle.serviceReminders.id(req.params.reminderId);
        if (!reminder) {
            return res.status(404).json({ error: 'Service reminder not found' });
        }

        if (vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only update your own reminders' });
        }

        reminder.isEnabled = !reminder.isEnabled;
        await vehicle.save();

        res.json({ message: `Reminder has been ${reminder.isEnabled ? 'enabled' : 'disabled'}`, reminder });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete a service reminder
router.delete('/:vehicleId/reminders/:reminderId', authMiddleware, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.vehicleId);

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        if (vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only delete your own reminders' });
        }

        // Remove the reminder
        vehicle.serviceReminders = vehicle.serviceReminders.filter(
            (reminder) => reminder._id.toString() !== req.params.reminderId
        );

        await vehicle.save();
        res.json({ message: 'Service reminder deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get all service reminders for a vehicle
router.get('/:vehicleId/reminders', authMiddleware, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.vehicleId);

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        if (vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only view reminders for your own vehicles' });
        }

        res.json(vehicle.serviceReminders);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});



module.exports = router;
