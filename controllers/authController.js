const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

exports.register = async (req, res) => {
    const { name, email, password, blood_group, phone, city, is_donor } = req.body;

    try {
        // Check if user exists
        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Define flags
        const donorFlag = is_donor ? 1 : 0;
        const adminFlag = 0; // Admins cannot sign themselves up from regular form

        // Insert user
        const [result] = await db.query(
            'INSERT INTO users (name, email, password, blood_group, location, contact, is_donor, is_admin, donations_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
            [name, email, hashedPassword, blood_group, city, phone, donorFlag, adminFlag]
        );

        res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: 'Server error', error: error.message, sqlMessage: error.sqlMessage });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check user
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = users[0];

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Determine role from flags
        let role = 'recipient';
        if (user.is_admin) role = 'admin';
        else if (user.is_donor) role = 'donor';

        // Create Token
        const token = jwt.sign({ id: user.id, role: role }, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: role,
                blood_group: user.blood_group,
                city: user.location, // Map back for frontend
                phone: user.contact,
                donations_count: user.donations_count || 0
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, name, email, blood_group, location as city, contact as phone, is_donor, is_admin FROM users WHERE is_admin = 0');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.googleLogin = async (req, res) => {
    const { access_token } = req.body;

    if (!access_token) {
        return res.status(400).json({ message: 'Access token is required' });
    }

    try {
        // Fetch user profile from Google using the access token
        const googleResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const { sub, email, name } = googleResponse.data;

        if (!email) {
            return res.status(400).json({ message: 'Email not provided by Google' });
        }

        // Check if user exists
        let [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        let user;

        if (users.length === 0) {
            // Register new user with a random dummy password (since they authenticated via Google)
            const salt = await bcrypt.genSalt(10);
            const dummyPassword = await bcrypt.hash(sub + Math.random().toString(), salt);

            const [result] = await db.query(
                'INSERT INTO users (name, email, password, is_donor, is_admin, donations_count) VALUES (?, ?, ?, ?, ?, ?)',
                [name, email, dummyPassword, 0, 0, 0]
            );

            const [newUsers] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
            user = newUsers[0];
        } else {
            user = users[0];
        }

        // Determine role from flags
        let role = 'recipient';
        if (user.is_admin) role = 'admin';
        else if (user.is_donor) role = 'donor';

        // Create Token
        const token = jwt.sign({ id: user.id, role: role }, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: role,
                blood_group: user.blood_group,
                city: user.location,
                phone: user.contact,
                donations_count: user.donations_count || 0
            }
        });

    } catch (error) {
        console.error('Google Auth Error:', error.response?.data || error.message);
        res.status(401).json({ message: 'Invalid Google Token or Server Error' });
    }
};
