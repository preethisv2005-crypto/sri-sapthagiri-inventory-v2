const express = require('express');
const router = express.Router();
const {
    getAllMotors,
    createMotor,
    updateMotor,
    addSerials,
    removeSerial,
    deleteMotor
} = require('../controllers/motorsController');

router.get('/', getAllMotors);
router.post('/', createMotor);
router.put('/:id', updateMotor);
router.post('/:id/serials', addSerials);
router.delete('/:id/serials/:sn', removeSerial);
router.delete('/:id', deleteMotor);

module.exports = router;
