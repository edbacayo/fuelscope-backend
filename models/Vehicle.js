const mongoose = require('mongoose');

const ServiceReminderSchema = new mongoose.Schema({
    type: {
        type: String, // e.g., "Oil Change", "Tire Rotation"
        required: true
    },
    odometerInterval: {
        type: Number, // e.g., 5000 km
        required: true
    },
    timeIntervalMonths: {
        type: Number, // e.g., 6 months
        required: true
    },
    lastServiceDate: {
        type: Date,
        default: Date.now
    },
    lastServiceOdometer: {
        type: Number,
        required: true
    },
    isEnabled: {
        type: Boolean, // Enable/disable the reminder
        default: true
    }
});

const VehicleSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    odometer: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    serviceReminders: [ServiceReminderSchema] // 🔥 Add multiple reminders
});

module.exports = mongoose.model('Vehicle', VehicleSchema);
