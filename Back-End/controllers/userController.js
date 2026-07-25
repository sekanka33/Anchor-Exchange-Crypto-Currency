const pool = require("../config/database");


const getProfile = async(req,res)=>{

    try{

        const userId = req.user.id;


        const result = await pool.query(
            "SELECT id,email,fullname,surname,country,phonenumber FROM users WHERE id=$1",
            [userId]
        );


        res.json({
            user: result.rows[0]
        });


    }catch(error){

        res.status(500).json({
            message:"Server error"
        });

    }

};


module.exports = {
    getProfile
};