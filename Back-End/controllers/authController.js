const pool = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


const register = async (req, res) => {

    const { username, email, password } = req.body;

    try {

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `
            INSERT INTO users(username, email, password)
            VALUES($1, $2, $3)
            RETURNING *
            `,
            [
                username,
                email,
                hashedPassword
            ]
        );


        const user = result.rows[0];

        await pool.query(
            `
            INSERT INTO wallets(user_id)
            VALUES($1)
            `,
            [
                user.id
            ]
        );

        res.status(201).json({
            message: "User created",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at
            }
        });


    } catch(error){

        res.status(500).json({
            message: error.message
        });

    }
};



const login = async (req,res)=>{

    const {email,password} = req.body;


    try {

        const result = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
        );


        if(result.rows.length === 0){
            return res.status(404).json({
                message:"User not found"
            });
        }


        const user = result.rows[0];


        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );


        if(!passwordMatch){
            return res.status(401).json({
                message:"Invalid password"
            });
        }


        const token = jwt.sign(
            {
                id:user.id,
                email:user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn:"1h"
            }
        );


        res.json({
            message:"Login successful",
            token
        });


    } catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};


// VERY IMPORTANT
module.exports = {
    register,
    login
};