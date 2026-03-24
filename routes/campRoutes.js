const express = require('express');
const router = express.Router();
const { getCampRequests, createCampRequest, updateCampStatus, getCampDonors, markAttendance } = require('../controllers/campController');

router.get('/', getCampRequests);
router.post('/', createCampRequest);
router.put('/:id', updateCampStatus); // Update status (Approve/Reject)
router.get('/:id/donors', getCampDonors); // Get donors for a camp
router.post('/attendance', markAttendance); // Mark attendance

module.exports = router;
