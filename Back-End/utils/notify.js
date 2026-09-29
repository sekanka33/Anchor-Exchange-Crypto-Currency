const pool = require("../config/database");
const { getIO } = require("../socket");

const createNotification = async (userId, { title, message, type = "INFO", link = null }) => {
    try {

        const result = await pool.query(
            `
            INSERT INTO notifications(user_id, title, message, type, link)
            VALUES($1, $2, $3, $4, $5)
            RETURNING id, title, message, type, is_read, link, created_at
            `,
            [userId, title, message, type, link]
        );

        // Best-effort real-time push to any connected client that has
        // joined this user's room (see socket.js "join_user"). A client
        // that never connects, or connects later, still sees the
        // notification the normal way via GET /api/notifications.
        try {
            getIO().to(`user:${userId}`).emit("notification:new", result.rows[0]);
        } catch (socketError) {
            // Socket.io not initialized (e.g. a script run outside server.js) — non-fatal.
        }

    } catch (error) {
        console.error("CREATE NOTIFICATION ERROR:", error);
    }
};

module.exports = { createNotification };
