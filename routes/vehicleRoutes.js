const express = require('express');
const Vehicle = require('../models/Vehicle');
const Expense = require('../models/Expense');
const authMiddleware = require('../middleware/authMiddleware'); // Ensure we protect routes
const multerUpload = require('../middleware/multerUpload');
const { EXPENSE_HEADERS, buildExpenseCsv } = require('../utils/csvExpense');
const csvParser = require('csv-parser');
const fs = require('fs');
const stream = require('stream');
const router = express.Router();

// --- CSV EXPORT ENDPOINT ---
// GET /api/vehicles/:vehicleId/expenses/export
router.get('/:vehicleId/expenses/export', authMiddleware, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.vehicleId);
    if (!vehicle || vehicle.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: You can only export expenses for your own vehicles' });
    }
    const expenses = await Expense.find({ vehicleId: req.params.vehicleId, isDeleted: false });
    const csv = buildExpenseCsv(expenses);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses-${req.params.vehicleId}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// --- CSV IMPORT ENDPOINT ---
// POST /api/vehicles/:vehicleId/expenses/import
router.post('/:vehicleId/expenses/import', authMiddleware, multerUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const errors = [];
  let importedCount = 0;
  let skippedCount = 0;
  let highestOdometer = null;
  try {
    const vehicle = await Vehicle.findById(req.params.vehicleId);
    if (!vehicle || vehicle.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: You can only import expenses for your own vehicles' });
    }
    // Parse CSV
    const rows = [];
    const headerSet = new Set();
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);
    let rowIndex = 1;
    await new Promise((resolve, reject) => {
      bufferStream.pipe(csvParser())
        .on('headers', (headers) => {
          headers.forEach(h => headerSet.add(h));
          const missing = EXPENSE_HEADERS.filter(h => !headerSet.has(h));
          if (missing.length > 0) {
            reject(new Error(`Invalid CSV headers. Missing: ${missing.join(', ')}`));
          }
        })
        .on('data', (row) => {
          // Context-aware required field validation
          for (const field of EXPENSE_HEADERS) {
            if (field === 'notes' || field === 'attachmentUrl') continue; // always optional

            // Contextual required fields
            if (row.type === 'service' && ['fuelDetails.fuelBrand', 'pricePerLiter', 'liters'].includes(field)) continue;
            if (row.type === 'fuel' && ['serviceDetails.serviceType'].includes(field)) continue;
            if (['registration', 'insurance'].includes(row.type) &&
                ['serviceDetails.serviceType', 'fuelDetails.fuelBrand', 'pricePerLiter', 'liters'].includes(field)) continue;

            if (!row[field] || row[field].trim() === '') {
              errors.push({ row: rowIndex, message: `Missing value for required field: ${field}` });
            }
          }
          rows.push(row);
          rowIndex++;
        })
        .on('end', resolve)
        .on('error', reject);
    });
    // Check for duplicates and insert
    for (const [i, row] of rows.entries()) {
      // Only skip if there are no required field errors for this row
      const rowHasError = errors.some(e => e.row === i + 1);
      if (rowHasError) { skippedCount++; continue; }
      const duplicate = await Expense.findOne({
        vehicleId: req.params.vehicleId,
        date: row.date,
        type: row.type,
        odometer: Number(row.odometer),
        totalCost: Number(row.totalCost),
        isDeleted: false
      });
      if (duplicate) { skippedCount++; continue; }
      // Prepare expense doc
      const expenseDoc = {
        userId: req.user.id,
        vehicleId: req.params.vehicleId,
        type: row.type,
        serviceDetails: { serviceType: row['serviceDetails.serviceType'] },
        fuelDetails: {
          fuelBrand: row['fuelDetails.fuelBrand'],
          pricePerLiter: row.pricePerLiter ? Number(row.pricePerLiter) : undefined,
          liters: row.liters ? Number(row.liters) : undefined
        },
        recurringInterval: row.recurringInterval,
        odometer: Number(row.odometer),
        totalCost: Number(row.totalCost),
        notes: row.notes,
        attachmentUrl: row.attachmentUrl,
        isDeleted: row.isDeleted === 'true' || row.isDeleted === true,
        date: new Date(row.date)
      };
      await Expense.create(expenseDoc);
      importedCount++;
      if (highestOdometer === null || expenseDoc.odometer > highestOdometer) {
        highestOdometer = expenseDoc.odometer;
      }
    }
    // Update vehicle odometer if needed
    if (highestOdometer !== null && highestOdometer > vehicle.odometer) {
      vehicle.odometer = highestOdometer;
      await vehicle.save();
    }
    return res.json({ importedCount, skippedCount, errors });
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid CSV headers')) {
      return res.status(400).json({ error: err.message });
    }
    console.log('err: ', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get upcoming service reminders for a vehicle
router.get('/:vehicleId/reminders', authMiddleware, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.vehicleId);

        if (!vehicle || vehicle.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only view reminders for your own vehicles' });
        }

        const upcomingReminders = [];
        const currentOdometer = vehicle.odometer;
        const currentDate = new Date();

        vehicle.serviceReminders.forEach((reminder, i) => {
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

        // Enforce vehicle limits by user role
        const count = await Vehicle.countDocuments({ userId: req.user.id });
        const role = req.user.role;
        const max = role === 'premium' ? 2 : role === 'user' ? 1 : Infinity;
        if (count >= max) {
            return res.status(403).json({ error: `Role '${role}' allows a maximum of ${max} vehicles` });
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

// Get a single vehicle by ID
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

        // Cascade delete all expenses for this vehicle
        await Expense.deleteMany({ vehicleId: req.params.id });
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

        // Prevent odometer rollback
        const latest = await Expense.findOne({ vehicleId: req.params.id }).sort({ odometer: -1 });
        if (latest && odometer < latest.odometer) {
            return res.status(400).json({ error: `Odometer must be >= latest recorded (${latest.odometer})` });
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
