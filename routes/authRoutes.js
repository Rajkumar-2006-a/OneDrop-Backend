const express = require('express');
const router = express.Router();
const { register, login, getAllUsers, deleteUser, googleLogin } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/googleLogin', googleLogin);
router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);

module.exports = router;
