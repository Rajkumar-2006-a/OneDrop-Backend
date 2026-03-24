const db = require('../config/db');

exports.getInventory = async (req, res) => {
    try {
        const [inventory] = await db.query('SELECT * FROM inventory ORDER BY hospital_name, blood_group');
        res.json(inventory);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.searchDonors = async (req, res) => {
    const { blood_group, city } = req.query;

    try {
        // Schema mapping: city -> location, phone -> contact, role='donor' -> is_donor=1
        let query = "SELECT id, name, blood_group, location as city, contact as phone FROM users WHERE is_donor = 1";
        let params = [];

        if (blood_group) {
            query += " AND blood_group = ?";
            params.push(blood_group);
        }

        if (city) {
            query += " AND location LIKE ?";
            params.push(`%${city}%`);
        }

        const [donors] = await db.query(query, params);
        res.json(donors);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateInventory = async (req, res) => {
    const { hospital_name, blood_group, units } = req.body;

    if (!hospital_name) {
        return res.status(400).json({ message: 'Hospital Name is required' });
    }

    try {
        // Check if blood group exists for the hospital
        const [existing] = await db.query('SELECT * FROM inventory WHERE hospital_name = ? AND blood_group = ?', [hospital_name, blood_group]);

        if (existing.length > 0) {
            // Update existing
            await db.query('UPDATE inventory SET units = ? WHERE hospital_name = ? AND blood_group = ?', [units, hospital_name, blood_group]);
        } else {
            // Insert new
            await db.query('INSERT INTO inventory (hospital_name, blood_group, units) VALUES (?, ?, ?)', [hospital_name, blood_group, units]);
        }

        res.json({ message: 'Inventory updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
