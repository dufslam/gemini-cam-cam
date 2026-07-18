module.exports = async function handler(req, res) {
  res.status(200).json({
    hasToken: !!process.env.GEMINI_API_KEY
  });
};
