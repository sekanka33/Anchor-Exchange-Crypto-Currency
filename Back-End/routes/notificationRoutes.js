const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));

const { requireAccount } = require("../middleware/authorizeRole");
const { getNotifications, markAsRead, markAllAsRead } = require("../controllers/notificationController");

router.get("/", requireAccount, getNotifications);

router.patch("/read-all", requireAccount, markAllAsRead);

router.patch("/:id/read", requireAccount, markAsRead);

module.exports = router;
