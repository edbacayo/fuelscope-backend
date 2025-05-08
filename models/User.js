const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'premium'], // Define allowed roles
        default: 'user' // Regular users are the default
    },
    disabled: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    agreedToDisclaimerAt: {
        type: Date,
        required: true
    }
});

module.exports = mongoose.model('User', UserSchema);
