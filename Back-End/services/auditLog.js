// Records sensitive administrator actions (append-only table). States are
// small, explicit objects chosen by the caller: never secrets, tokens, or full
// bank account numbers.
const recordAudit = (db, { actor, action, targetType, targetId, reason = null, before = null, after = null }) =>
    db.query(
        `INSERT INTO audit_logs (actor_user_id, actor_role, action, target_type, target_id, reason, before_state, after_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            actor?.id ?? null,
            actor?.role ?? null,
            action,
            targetType,
            targetId == null ? null : String(targetId),
            reason,
            before ? JSON.stringify(before) : null,
            after ? JSON.stringify(after) : null
        ]
    );

module.exports = { recordAudit };
