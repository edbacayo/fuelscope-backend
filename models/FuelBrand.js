const mongoose = require('mongoose');

const FuelBrandSchema = new mongoose.Schema( {
    name: { type: String, required: true, unique: true },
    isActive: { type: Boolean, required: true, default: true }
});

module.exports = mongoose.model('FuelBrand', FuelBrandSchema);