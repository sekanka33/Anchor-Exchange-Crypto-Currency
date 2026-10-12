const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));

const { requireCustomer } = require("../middleware/authorizeRole");
const { getTransactions, getTransactionById } = require("../controllers/transactionController");

router.get("/", requireCustomer, getTransactions);

router.get("/:id", requireCustomer, getTransactionById);

module.exports = router;
