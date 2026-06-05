const express = require('express');
const router = express.Router();
const { getAllPipes, createPipe, updatePipe, deletePipe } = require('../controllers/pipesController');

router.get('/', getAllPipes);
router.post('/', createPipe);
router.put('/:id', updatePipe);
router.delete('/:id', deletePipe);

module.exports = router;
