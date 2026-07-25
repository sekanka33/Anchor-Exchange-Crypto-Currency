const getWallet = async (req, res) => {
  try {
    
    const userId = req.user.id;


    return res.status(200).json({
      balance: 0,
      currency: "ZAR"
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error retrieving wallet." });
  }
};

module.exports = { getWallet };