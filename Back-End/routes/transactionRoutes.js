const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));

const authenticate = require("../middleware/authenticate");
const { getTransactions, getTransactionById } = require("../controllers/transactionController");

router.get("/", authenticate, getTransactions);

router.get("/:id", authenticate, getTransactionById);

module.exports = router;
