const express = require('express');
const router = express.Router();

const {
  createRevenue,
  getAllRevenues,
  getRevenueById,
  updateRevenue,
  deleteRevenue,
} = require('../controllers/revenueController');

// POST request to create a new revenue entry
router.post('/', createRevenue);

// GET request to retrieve all revenue entries
router.get('/', getAllRevenues);

// GET request to retrieve a single revenue entry by its ID
router.get('/:id', getRevenueById);

// PUT request to update a revenue entry by its ID
router.put('/:id', updateRevenue);

// DELETE request to remove a revenue entry by its ID
router.delete('/:id', deleteRevenue);

module.exports = router;