const mongoose = require('mongoose');

const ServiceTypeSchema = new mongoose.Schema({
    type : { type: String, required: true, unique: true },
    odometerInterval : { type: Number, default: 0, required: true },
    timeIntervalMonths : { type : Number, default: 0, required: true }
});

module.exports = mongoose.model('ServiceType', ServiceTypeSchema);