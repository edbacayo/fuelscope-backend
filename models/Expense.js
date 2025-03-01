const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true
    },
    type: {
        type: String, // e.g., "fuel", "service", "insurance", "registration"
        required: true
    },
    serviceDetails: {
        serviceType: {
            type: String, // Required if type === 'service'
            required: function () {
                return this.type === 'service';
            }
        }
    },
    fuelDetails: {
        fuelBrand: {
            type: String, // Required if type === 'fuel'
            required: function () {
                return this.type === 'fuel';
            }
        },
        pricePerLiter: {
            type: Number
        },
        liters: Number
    },
    recurringInterval: {
        type: String, // e.g., "monthly", "yearly", "none"
        default: "none"
    },
    odometer: {
        type: Number,
        required: true
    },
    totalCost: {
        type: Number,
        required: true
    },
    notes: {
        type: String // Optional user notes
    },
    attachmentUrl: {
        type: String // For future file uploads (e.g., receipts)
    },
    isDeleted: {
        type: Boolean, // Soft-delete functionality
        default: false
    },
    date: {
        type: Date,
        required: true
    }
});

module.exports = mongoose.model('Expense', ExpenseSchema);
