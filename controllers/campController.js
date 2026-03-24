const db = require('../config/db');
const { sendCampNotification } = require('../utils/emailService');

// Get all camp requests
exports.getCampRequests = async (req, res) => {
    try {
        const [requests] = await db.query('SELECT * FROM camp_requests ORDER BY camp_date DESC');
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create camp request
exports.createCampRequest = async (req, res) => {
    const { institution_name, location, camp_date, camp_time, contact_person, contact_mobile } = req.body;

    try {
        const [result] = await db.query(
            'INSERT INTO camp_requests (institution_name, location, camp_date, camp_time, contact_person, contact_mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [institution_name, location, camp_date, camp_time, contact_person, contact_mobile, 'Pending']
        );

        res.status(201).json({ message: 'Camp request submitted successfully', requestId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update camp request status (Admin only)
exports.updateCampStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        await db.query(
            'UPDATE camp_requests SET status = ? WHERE id = ?',
            [status, id]
        );

        // If Approved, send email to all eligible donors (anyone with is_donor=1 and a gmail address)
        if (status === 'Approved') {
            const [donors] = await db.query("SELECT email FROM users WHERE is_donor = 1 AND email LIKE '%@gmail.com'");
            const [camp] = await db.query('SELECT * FROM camp_requests WHERE id = ?', [id]);

            if (donors.length > 0 && camp.length > 0) {
                const recipientEmails = donors.map(d => d.email);
                await sendCampNotification(recipientEmails, camp[0]);
            }
        }

        res.json({ message: 'Camp request status updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get donors for a specific camp (with attendance status)
exports.getCampDonors = async (req, res) => {
    const { id } = req.params; // campId

    try {
        // Fetch all donors and their attendance status for this camp
        // LEFT JOIN attendance to see if they are already marked
        const query = `
            SELECT u.id, u.name, u.email, u.blood_group, a.status as attendance_status 
            FROM users u 
            LEFT JOIN attendance a ON u.id = a.user_id AND a.camp_id = ?
            WHERE u.is_donor = 1
        `;
        const [donors] = await db.query(query, [id]);
        res.json(donors);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Mark Attendance
exports.markAttendance = async (req, res) => {
    const { campId, userId, status } = req.body; // status: 'Present' or 'Absent'

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert or Update Attendance
        await connection.query(
            `INSERT INTO attendance (camp_id, user_id, status) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE status = VALUES(status), marked_at = CURRENT_TIMESTAMP`,
            [campId, userId, status]
        );

        // 2. Update Donations Count in Users table
        // Logic: If status is 'Present', increment count. 
        // Note: To be precise, we should only increment if they were NOT present before.
        // But for simplicity in this MVP, we might assume marking 'Present' implies a donation.
        // A better approach: check previous status.

        // Let's implementation a slightly smarter update:
        // We really need to know if we are toggling from Absent -> Present or Present -> Absent (oops correction)
        // For now, let's just do a recalc or a simple increment if the current request is 'Present'.
        // Simplified Rule: If admin marks "Present", we ensure they have credit. If they mark "Absent", we remove credit? 
        // Getting this perfect requires state awareness. 
        // Alternative: Just run a count query for the user across all 'Present' attendances and update user table.

        if (status === 'Present') {
            // Let's just recalculate to be safe and idempotent
            const [countResult] = await connection.query(
                `SELECT COUNT(*) as count FROM attendance WHERE user_id = ? AND status = 'Present'`,
                [userId]
            );
            const newCount = countResult[0].count;

            await connection.query('UPDATE users SET donations_count = ? WHERE id = ?', [newCount, userId]);
        } else {
            // Also recalc if marked absent (in case they were previously present)
            const [countResult] = await connection.query(
                `SELECT COUNT(*) as count FROM attendance WHERE user_id = ? AND status = 'Present'`,
                [userId]
            );
            const newCount = countResult[0].count;

            await connection.query('UPDATE users SET donations_count = ? WHERE id = ?', [newCount, userId]);
        }

        await connection.commit();
        res.json({ message: 'Attendance updated' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
};
