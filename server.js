const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/camps', require('./routes/campRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

// Test Route
app.get('/', (req, res) => {
    res.send('Blood Donation API is Running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
