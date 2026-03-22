const axios = require("axios");
const { nowIso } = require("../utils");

const sendSmsMessage = async (phoneNumber, message) => {
  const fast2smsApiKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsApiKey) {
    const senderId = process.env.FAST2SMS_SENDER_ID || "DIALHP";
    const cleaned = String(phoneNumber || "").replace(/\+/g, "").replace(/\s+/g, "");

    try {
      const response = await axios.post(
        "https://www.fast2sms.com/dev/bulkV2",
        new URLSearchParams({
          route: "q",
          sender_id: senderId,
          message,
          language: "english",
          numbers: cleaned,
        }).toString(),
        {
          headers: {
            authorization: fast2smsApiKey,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache",
          },
          timeout: 15000,
        },
      );

      const responseData = response?.data || {};
      const success = Boolean(responseData.return);
      if (success) {
        return {
          channel: "sms",
          recipient: phoneNumber,
          success: true,
          detail: "SMS sent via Fast2SMS",
          timestamp: nowIso(),
        };
      }

      return {
        channel: "sms",
        recipient: phoneNumber,
        success: false,
        detail: `Fast2SMS error: ${responseData.message || responseData.error || "Unknown error"}`,
        timestamp: nowIso(),
      };
    } catch (error) {
      return {
        channel: "sms",
        recipient: phoneNumber,
        success: false,
        detail: `Fast2SMS request failed: ${error.message}`,
        timestamp: nowIso(),
      };
    }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return {
      channel: "sms",
      recipient: phoneNumber,
      success: false,
      detail: "SMS provider is not configured",
      timestamp: nowIso(),
    };
  }

  try {
    const payload = new URLSearchParams({
      To: phoneNumber,
      From: fromNumber,
      Body: message,
    }).toString();

    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      payload,
      {
        auth: { username: accountSid, password: authToken },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      },
    );

    return {
      channel: "sms",
      recipient: phoneNumber,
      success: true,
      detail: "SMS sent via Twilio",
      timestamp: nowIso(),
    };
  } catch (error) {
    return {
      channel: "sms",
      recipient: phoneNumber,
      success: false,
      detail: `Twilio request failed: ${error.message}`,
      timestamp: nowIso(),
    };
  }
};

const sendEmailMessage = async (recipient, subject, text) => {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!sendgridApiKey || !fromEmail) {
    return {
      channel: "email",
      recipient,
      success: false,
      detail: "SendGrid is not configured",
      timestamp: nowIso(),
    };
  }

  try {
    await axios.post(
      "https://api.sendgrid.com/v3/mail/send",
      {
        personalizations: [{ to: [{ email: recipient }] }],
        from: { email: fromEmail },
        subject,
        content: [{ type: "text/plain", value: text }],
      },
      {
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    return {
      channel: "email",
      recipient,
      success: true,
      detail: "Email sent",
      timestamp: nowIso(),
    };
  } catch (error) {
    return {
      channel: "email",
      recipient,
      success: false,
      detail: `SendGrid request failed: ${error.message}`,
      timestamp: nowIso(),
    };
  }
};

const notifyBookingEvent = async (booking, eventTitle) => {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
  const adminPhone = process.env.ADMIN_NOTIFY_PHONE;

  const emailTargets = [booking.email, adminEmail].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const smsTargets = [booking.phone, adminPhone].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  const emailSubject = `Dial For Help: ${eventTitle}`;
  const emailBody = [
    `Booking ID: ${booking.id}`,
    `Customer: ${booking.full_name}`,
    `Service: ${booking.service_type}`,
    `Status: ${booking.status}`,
    `Preferred Date: ${booking.preferred_date}`,
  ].join("\n");

  const smsBody = `Dial For Help update: ${eventTitle}. Booking ${booking.id.slice(0, 8)} | ${booking.service_type} | ${booking.status}`;

  const tasks = [];
  emailTargets.forEach((email) => tasks.push(sendEmailMessage(email, emailSubject, emailBody)));
  smsTargets.forEach((phone) => tasks.push(sendSmsMessage(phone, smsBody)));

  return Promise.all(tasks);
};

module.exports = {
  sendSmsMessage,
  sendEmailMessage,
  notifyBookingEvent,
};