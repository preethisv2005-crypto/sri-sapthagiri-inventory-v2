const express = require('express');
const router = express.Router();
const { getAllChallans, createChallan, updateChallan, deleteChallan } = require('../controllers/challansController');

router.get('/', getAllChallans);
router.post('/', createChallan);
router.put('/:id', updateChallan);
router.delete('/:id', deleteChallan);

module.exports = router;
