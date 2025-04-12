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

// Allow requests from frontend (localhost:3001)
app.use(cors({
    origin: 'http://localhost:3001', // Allow frontend origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));


// Middleware
app.use(express.json());
app.use(cors());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

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
