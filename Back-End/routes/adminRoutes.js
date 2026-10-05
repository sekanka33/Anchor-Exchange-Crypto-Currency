const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));
const rateLimit = require("express-rate-limit");

const authenticate = require("../middleware/authenticate");
const authorizeAdmin = require("../middleware/authorizeAdmin");
const {
    getStats,
    getStatsHistory,
    getUsers,
    getUserById,
    updateUserRole,
    setUserSuspension,
    getAllTransactions,
    getAllDeposits,
    getAllWithdrawals,
    rejectWithdrawal,
    getAllOrders
} = require("../controllers/adminController");

// Every route here requires a valid JWT (authenticate) AND a current
// role of 'admin' looked up fresh from the DB (authorizeAdmin) — see
// middleware/authorizeAdmin.js for why the role isn't just trusted from
// the token.
router.use(authenticate, authorizeAdmin);

const adminWriteLimiter = rateLimit({
    windowMs: 60 * 1000,
    skip: () => process.env.NODE_ENV === "test",
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many admin actions. Please slow down." }
});

router.get("/stats", getStats);

router.get("/stats/history", getStatsHistory);

router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/role", adminWriteLimiter, updateUserRole);
router.patch("/users/:id/suspension", adminWriteLimiter, setUserSuspension);

router.get("/transactions", getAllTransactions);

router.get("/deposits", getAllDeposits);

router.get("/withdrawals", getAllWithdrawals);
router.post("/withdrawals/:id/reject", adminWriteLimiter, rejectWithdrawal);

router.get("/orders", getAllOrders);

module.exports = router;
