const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authenticate");

const {
    getProfile
}=require("../controllers/userController");


router.get(
    "/profile",
    authenticate,
    getProfile
);


module.exports = router;