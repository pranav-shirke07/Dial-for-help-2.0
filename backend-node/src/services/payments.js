const crypto = require("crypto");
const axios = require("axios");

const createRazorpayOrder = async ({ amountPaise, receipt, notes }) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials missing");
  }

  const response = await axios.post(
    "https://api.razorpay.com/v1/orders",
    {
      amount: amountPaise,
      currency: "INR",
      receipt,
      payment_capture: 1,
      notes,
    },
    {
      auth: {
        username: keyId,
        password: keySecret,
      },
      timeout: 20000,
    },
  );

  return response.data;
};

const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return false;

  const payload = `${orderId}|${paymentId}`;
  const generated = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
  return generated === signature;
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpaySignature,
};