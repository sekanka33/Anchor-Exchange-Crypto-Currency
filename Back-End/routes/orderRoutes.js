const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));
const rateLimit = require("express-rate-limit");

const { requireCustomer } = require("../middleware/authorizeRole");
const { createBuyOrder, createSellOrder, getOrders, getOrderById } = require("../controllers/orderController");

const orderLimiter = rateLimit({
    windowMs: 60 * 1000,
    skip: () => process.env.NODE_ENV === "test",
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many order attempts. Please slow down." }
});

router.get("/", requireCustomer, getOrders);

router.post("/buy", requireCustomer, orderLimiter, createBuyOrder);

router.post("/sell", requireCustomer, orderLimiter, createSellOrder);

router.get("/:id", requireCustomer, getOrderById);

module.exports = router;
