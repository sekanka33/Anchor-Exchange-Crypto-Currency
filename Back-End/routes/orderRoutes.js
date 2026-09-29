const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));
const rateLimit = require("express-rate-limit");

const authenticate = require("../middleware/authenticate");
const { createBuyOrder, createSellOrder, getOrders, getOrderById } = require("../controllers/orderController");

const orderLimiter = rateLimit({
    windowMs: 60 * 1000,
    skip: () => process.env.NODE_ENV === "test",
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many order attempts. Please slow down." }
});

router.get("/", authenticate, getOrders);

router.post("/buy", authenticate, orderLimiter, createBuyOrder);

router.post("/sell", authenticate, orderLimiter, createSellOrder);

router.get("/:id", authenticate, getOrderById);

module.exports = router;
