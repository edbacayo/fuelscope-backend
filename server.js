// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Vehicle = require('./models/Vehicle');
const Expense = require('./models/Expense');

const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const fuelImportRoutes = require('./routes/fuelImportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const fuelBrandRoutes = require('./routes/fuelBrandRoutes');
const serviceTypeRoutes = require('./routes/serviceTypeRoutes');

dotenv.config();
const app = express();

// Allow requests from frontend
const allowedOrigins = [
    process.env.FRONTEND_DEV_URL,
    process.env.FRONTEND_PROD_URL,
    'https://fuelscope-frontend-af3be29e70a1.herokuapp.com',
    'http://localhost:3001'
].filter(Boolean); // Filter out undefined/null values

console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl requests)
        if (!origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.length === 0 || allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
            callback(null, true);
        } else {
            console.log(`Origin ${origin} not allowed by CORS`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true
}));


// Middleware
app.use(express.json());

// Database Connection
const isProduction = process.env.NODE_ENV === 'production';
const mongoUri = isProduction ? process.env.MONGO_URI : process.env.MONGO_URI_LOCAL;

mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB Connected', isProduction ? 'Production' : 'Local'))
  .catch(err => console.log(err));

// Health check endpoint for Heroku dyno wake-up
app.get('/api/ping', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/import', fuelImportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fuel-brands', fuelBrandRoutes);
app.use('/api/service-types', serviceTypeRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
