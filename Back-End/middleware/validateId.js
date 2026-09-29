// Postgres `integer` ids overflow above 2^31-1 and throw ("out of range for
// type integer"), which used to surface as a 500. Anything that can't be a
// real id can't exist, so answer 404 before touching the database.
const MAX_INT = 2147483647;

const validateId = (req, res, next, value) => {
    if (!/^\d{1,10}$/.test(value) || Number(value) < 1 || Number(value) > MAX_INT) {
        return res.status(404).json({ message: "Not found" });
    }
    next();
};

module.exports = validateId;
