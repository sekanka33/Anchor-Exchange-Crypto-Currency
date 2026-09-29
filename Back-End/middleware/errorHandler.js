const notFound = (req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
};

const errorHandler = (err, req, res, next) => {

    if (res.headersSent) {
        return next(err);
    }

    // body-parser errors carry parser internals in err.message
    // ("Unexpected token ..."); give clients a stable message instead.
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Invalid JSON body" });
    }

    if (err.type === "entity.too.large") {
        return res.status(413).json({ message: "Request body too large" });
    }

    const status = err.status || err.statusCode || 500;

    // Log the route and error, never the request body (passwords, tokens).
    console.error(`ERROR ${req.method} ${req.originalUrl.split("?")[0]} ->`, status, status >= 500 ? err : err.message);

    res.status(status).json({
        message: status >= 500 && !err.expose ? "Internal server error" : err.message
    });

};

module.exports = { notFound, errorHandler };
