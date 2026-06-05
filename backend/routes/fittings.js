const express = require('express');
const router = express.Router();
const { getAllFittings, createFitting, updateFitting, deleteFitting } = require('../controllers/fittingsController');

router.get('/', getAllFittings);
router.post('/', createFitting);
router.put('/:id', updateFitting);
router.delete('/:id', deleteFitting);

module.exports = router;
