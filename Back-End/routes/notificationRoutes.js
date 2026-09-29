const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));

const authenticate = require("../middleware/authenticate");
const { getNotifications, markAsRead, markAllAsRead } = require("../controllers/notificationController");

router.get("/", authenticate, getNotifications);

router.patch("/read-all", authenticate, markAllAsRead);

router.patch("/:id/read", authenticate, markAsRead);

module.exports = router;
