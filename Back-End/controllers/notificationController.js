const pool = require("../config/database");

const getNotifications = async (req, res) => {

    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    try {

        const [rowsResult, countResult, unreadResult] = await Promise.all([
            pool.query(
                `
                SELECT id, title, message, type, is_read, link, created_at
                FROM notifications
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                `,
                [userId, limit, offset]
            ),
            pool.query(
                "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1",
                [userId]
            ),
            pool.query(
                "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false",
                [userId]
            )
        ]);

        res.json({
            notifications: rowsResult.rows,
            unreadCount: unreadResult.rows[0].count,
            pagination: {
                page,
                limit,
                total: countResult.rows[0].count,
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });

    } catch (error) {

        console.error("GET NOTIFICATIONS ERROR:", error);

        res.status(500).json({ message: "Unable to load notifications" });

    }

};


const markAsRead = async (req, res) => {

    const userId = req.user.id;
    const { id } = req.params;

    try {

        const result = await pool.query(
            `
            UPDATE notifications
            SET is_read = true
            WHERE id = $1 AND user_id = $2
            RETURNING id
            `,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.json({ message: "Notification marked as read" });

    } catch (error) {

        console.error("MARK NOTIFICATION READ ERROR:", error);

        res.status(500).json({ message: "Unable to update notification" });

    }

};


const markAllAsRead = async (req, res) => {

    const userId = req.user.id;

    try {

        await pool.query(
            "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
            [userId]
        );

        res.json({ message: "All notifications marked as read" });

    } catch (error) {

        console.error("MARK ALL NOTIFICATIONS READ ERROR:", error);

        res.status(500).json({ message: "Unable to update notifications" });

    }

};


module.exports = { getNotifications, markAsRead, markAllAsRead };
