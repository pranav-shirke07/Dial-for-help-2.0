const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");

const { config } = require("./config");
const { getDb } = require("./db");
const {
  nowIso,
  normalizePhone,
  normalizeEmail,
  identityKey,
  parseIso,
  isFutureIso,
  safeJsonError,
  createToken,
} = require("./utils");
const { sendEmailMessage, sendSmsMessage, notifyBookingEvent } = require("./services/notify");
const { createRazorpayOrder, verifyRazorpaySignature } = require("./services/payments");
const { seedDemoData, resetDemoData, SERVICES } = require("./seedDemoData");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: config.corsOrigins === "*" ? true : config.corsOrigins.split(",").map((v) => v.trim()),
    credentials: true,
  }),
);

const USER_PLAN_INR = config.prices.userPlanInr;
const WORKER_PLAN_INR = config.prices.workerPlanInr;

const allowedServices = [...SERVICES, "Other"];

const getCollections = () => {
  const db = getDb();
  return {
    db,
    admins: db.collection("admins"),
    adminSessions: db.collection("admin_sessions"),
    users: db.collection("users"),
    userSessions: db.collection("user_sessions"),
    bookings: db.collection("bookings"),
    workers: db.collection("workers"),
    contacts: db.collection("contacts"),
    subscriptions: db.collection("subscriptions"),
    paymentOrders: db.collection("payment_orders"),
    userNotifications: db.collection("user_notifications"),
  };
};

const coerceBookingDoc = (doc) => ({
  ...doc,
  identity_key: doc.identity_key || identityKey(doc.phone, doc.email),
  charge_type: doc.charge_type || "free",
  assigned_worker_id: doc.assigned_worker_id || null,
  notification_log: doc.notification_log || [],
});

const coerceWorkerDoc = (doc) => ({
  ...doc,
  subscription_expires_at: doc.subscription_expires_at || null,
});

const coerceUserProfile = (doc) => ({
  id: doc.id,
  full_name: doc.full_name,
  email: doc.email,
  phone: doc.phone,
  address: doc.address || "",
  notify_email: Boolean(doc.notify_email),
  notify_sms: Boolean(doc.notify_sms),
  created_at: doc.created_at,
  updated_at: doc.updated_at,
});

const requireFields = (body, fields) => {
  const missing = fields.filter((field) => !String(body[field] ?? "").trim());
  return missing;
};

const getActiveSubscription = async ({ phone, email, planType }) => {
  const { subscriptions } = getCollections();
  const sub = await subscriptions.findOne(
    {
      subscriber_key: identityKey(phone, email),
      plan_type: planType,
      status: "active",
    },
    { projection: { _id: 0 } },
  );

  if (!sub) return null;
  if (!isFutureIso(sub.expires_at)) return null;
  return sub;
};

const getUserSubStatus = async ({ phone, email }) => {
  const { bookings } = getCollections();
  const key = identityKey(phone, email);
  const bookingsUsed = await bookings.countDocuments({ identity_key: key });
  const activeSub = await getActiveSubscription({ phone, email, planType: "user" });
  const freeRemaining = Math.max(0, 2 - bookingsUsed);

  return {
    identity_key: key,
    bookings_used: bookingsUsed,
    free_remaining: freeRemaining,
    has_active_subscription: Boolean(activeSub),
    requires_subscription: bookingsUsed >= 2 && !activeSub,
    subscription_expires_at: activeSub?.expires_at || null,
  };
};

const createUserNotification = async ({ email, phone, title, message, category, bookingId = null }) => {
  const { userNotifications } = getCollections();
  await userNotifications.insertOne({
    id: randomUUID(),
    email: normalizeEmail(email),
    phone: normalizePhone(phone),
    title,
    message,
    category,
    booking_id: bookingId,
    read: false,
    created_at: nowIso(),
  });
};

const createAdminSession = async (email) => {
  const { adminSessions } = getCollections();
  const token = createToken();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  await adminSessions.insertOne({
    id: randomUUID(),
    token,
    admin_email: email,
    expires_at: expiresAt,
    created_at: nowIso(),
  });
  return { token, expiresAt };
};

const createUserSession = async (userDoc) => {
  const { userSessions } = getCollections();
  const token = createToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await userSessions.insertOne({
    id: randomUUID(),
    token,
    user_id: userDoc.id,
    user_email: userDoc.email,
    expires_at: expiresAt,
    created_at: nowIso(),
  });
  return { token, expiresAt };
};

const adminAuth = async (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return safeJsonError(res, 401, "Missing admin token");

  const token = auth.replace("Bearer ", "").trim();
  const { adminSessions } = getCollections();
  const session = await adminSessions.findOne({ token }, { projection: { _id: 0 } });

  if (!session) return safeJsonError(res, 401, "Invalid admin token");
  if (!isFutureIso(session.expires_at)) {
    await adminSessions.deleteOne({ token });
    return safeJsonError(res, 401, "Admin token expired");
  }

  req.adminSession = session;
  return next();
};

const userAuth = async (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return safeJsonError(res, 401, "Missing user token");

  const token = auth.replace("Bearer ", "").trim();
  const { userSessions } = getCollections();
  const session = await userSessions.findOne({ token }, { projection: { _id: 0 } });

  if (!session) return safeJsonError(res, 401, "Invalid user token");
  if (!isFutureIso(session.expires_at)) {
    await userSessions.deleteOne({ token });
    return safeJsonError(res, 401, "User token expired");
  }

  req.userSession = session;
  return next();
};

const getMonthBuckets = (count = 6) => {
  const base = new Date();
  base.setUTCDate(1);
  base.setUTCHours(0, 0, 0, 0);
  const items = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const dt = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    items.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return items;
};

const monthBucket = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const validateService = (value) => allowedServices.includes(value);

app.get("/api/", async (_req, res) => {
  res.json({
    message: "Dial For Help API (Node + Express) is running",
    plans: {
      user: `₹${USER_PLAN_INR}/year after 2 free services`,
      worker: `₹${WORKER_PLAN_INR}/year mandatory before signup`,
    },
  });
});

app.get("/api/subscriptions/user-status", async (req, res) => {
  const { phone, email } = req.query;
  if (!phone || !email) return safeJsonError(res, 400, "phone and email are required");
  const statusData = await getUserSubStatus({ phone, email });
  return res.json(statusData);
});

app.get("/api/subscriptions/worker-status", async (req, res) => {
  const { phone, email } = req.query;
  if (!phone || !email) return safeJsonError(res, 400, "phone and email are required");
  const active = await getActiveSubscription({ phone, email, planType: "worker" });
  return res.json({
    subscriber_key: identityKey(phone, email),
    has_active_subscription: Boolean(active),
    subscription_expires_at: active?.expires_at || null,
  });
});

app.post("/api/payments/create-order", async (req, res) => {
  try {
    const missing = requireFields(req.body, ["plan_type", "name", "email", "phone"]);
    if (missing.length) return safeJsonError(res, 400, `Missing fields: ${missing.join(", ")}`);

    const { plan_type: planType, name, email, phone } = req.body;
    if (!["user", "worker"].includes(planType)) return safeJsonError(res, 400, "Invalid plan_type");

    const amountInr = planType === "user" ? USER_PLAN_INR : WORKER_PLAN_INR;
    const amountPaise = amountInr * 100;
    const receipt = `${planType.slice(0, 1)}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

    const order = await createRazorpayOrder({
      amountPaise,
      receipt,
      notes: {
        plan_type: planType,
        subscriber_key: identityKey(phone, email),
      },
    });

    const { paymentOrders } = getCollections();
    await paymentOrders.insertOne({
      id: randomUUID(),
      order_id: order.id,
      plan_type: planType,
      subscriber_name: name,
      email: normalizeEmail(email),
      phone: normalizePhone(phone),
      subscriber_key: identityKey(phone, email),
      amount: amountPaise,
      currency: order.currency || "INR",
      status: "created",
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    return res.json({
      order_id: order.id,
      amount: amountPaise,
      currency: order.currency || "INR",
      key_id: process.env.RAZORPAY_KEY_ID,
      plan_type: planType,
      amount_inr: amountInr,
    });
  } catch (error) {
    return safeJsonError(res, 500, error.message || "Could not create payment order");
  }
});

app.post("/api/payments/verify", async (req, res) => {
  const missing = requireFields(req.body, [
    "plan_type",
    "razorpay_order_id",
    "razorpay_payment_id",
    "razorpay_signature",
    "subscriber_name",
    "email",
    "phone",
  ]);
  if (missing.length) return safeJsonError(res, 400, `Missing fields: ${missing.join(", ")}`);

  const {
    plan_type: planType,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    subscriber_name: subscriberName,
    email,
    phone,
  } = req.body;

  const valid = verifyRazorpaySignature({ orderId, paymentId, signature });
  if (!valid) return safeJsonError(res, 400, "Invalid payment signature");

  const { paymentOrders, subscriptions } = getCollections();
  const order = await paymentOrders.findOne({ order_id: orderId, plan_type: planType }, { projection: { _id: 0 } });
  if (!order) return safeJsonError(res, 404, "Payment order not found");

  const startedAt = new Date();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const amountInr = planType === "user" ? USER_PLAN_INR : WORKER_PLAN_INR;
  const key = identityKey(phone, email);

  await subscriptions.updateOne(
    { subscriber_key: key, plan_type: planType },
    {
      $set: {
        id: randomUUID(),
        subscriber_key: key,
        subscriber_name: subscriberName,
        email: normalizeEmail(email),
        phone: normalizePhone(phone),
        plan_type: planType,
        amount_inr: amountInr,
        status: "active",
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        updated_at: nowIso(),
      },
    },
    { upsert: true },
  );

  await paymentOrders.updateOne(
    { order_id: orderId },
    {
      $set: {
        status: "paid",
        razorpay_payment_id: paymentId,
        updated_at: nowIso(),
      },
    },
  );

  return res.json({
    message: "Subscription activated",
    plan_type: planType,
    active_until: expiresAt.toISOString(),
  });
});

app.post("/api/bookings", async (req, res) => {
  const missing = requireFields(req.body, ["full_name", "phone", "email", "service_type", "address", "preferred_date"]);
  if (missing.length) return safeJsonError(res, 400, `Missing fields: ${missing.join(", ")}`);
  if (!validateService(req.body.service_type)) return safeJsonError(res, 400, "Invalid service_type");

  const payload = {
    ...req.body,
    email: normalizeEmail(req.body.email),
    phone: normalizePhone(req.body.phone),
    notes: req.body.notes || "",
  };

  const subStatus = await getUserSubStatus({ phone: payload.phone, email: payload.email });
  if (subStatus.requires_subscription) {
    return res.status(402).json({
      detail: {
        code: "USER_SUBSCRIPTION_REQUIRED",
        message: `First 2 services are free. Please subscribe for ₹${USER_PLAN_INR}/year to continue.`,
        free_remaining: 0,
        required_amount_inr: USER_PLAN_INR,
      },
    });
  }

  const booking = {
    id: randomUUID(),
    full_name: payload.full_name,
    phone: payload.phone,
    email: payload.email,
    service_type: payload.service_type,
    address: payload.address,
    preferred_date: payload.preferred_date,
    notes: payload.notes,
    status: "pending",
    assigned_worker_id: null,
    identity_key: subStatus.identity_key,
    charge_type: subStatus.has_active_subscription ? "subscription" : "free",
    created_at: nowIso(),
    updated_at: nowIso(),
    notification_log: [],
  };

  const { bookings } = getCollections();
  await bookings.insertOne(booking);

  await createUserNotification({
    email: booking.email,
    phone: booking.phone,
    title: "Booking received",
    message: `Your booking for ${booking.service_type} is received and currently pending.`,
    category: "booking",
    bookingId: booking.id,
  });

  const logs = await notifyBookingEvent(booking, "Booking received");
  if (logs.length) {
    booking.notification_log = logs;
    booking.updated_at = nowIso();
    await bookings.updateOne(
      { id: booking.id },
      { $set: { notification_log: logs, updated_at: booking.updated_at } },
    );
  }

  return res.json(booking);
});

app.get("/api/bookings/track/:bookingId", async (req, res) => {
  const { bookings, workers } = getCollections();
  const bookingDoc = await bookings.findOne({ id: req.params.bookingId }, { projection: { _id: 0 } });
  if (!bookingDoc) return safeJsonError(res, 404, "Booking ID not found");

  const booking = coerceBookingDoc(bookingDoc);
  let assignedName = null;
  if (booking.assigned_worker_id) {
    const worker = await workers.findOne({ id: booking.assigned_worker_id }, { projection: { _id: 0, full_name: 1 } });
    assignedName = worker?.full_name || null;
  }

  return res.json({
    booking_id: booking.id,
    customer_name: booking.full_name,
    service_type: booking.service_type,
    status: booking.status,
    preferred_date: booking.preferred_date,
    created_at: booking.created_at,
    charge_type: booking.charge_type,
    assigned_worker_name: assignedName,
  });
});

app.post("/api/workers/signup", async (req, res) => {
  const missing = requireFields(req.body, ["full_name", "phone", "email", "skill", "city", "years_experience", "availability"]);
  if (missing.length) return safeJsonError(res, 400, `Missing fields: ${missing.join(", ")}`);
  if (!SERVICES.includes(req.body.skill)) return safeJsonError(res, 400, "Invalid worker skill");

  const active = await getActiveSubscription({ phone: req.body.phone, email: req.body.email, planType: "worker" });
  if (!active) {
    return res.status(402).json({
      detail: {
        code: "WORKER_SUBSCRIPTION_REQUIRED",
        message: `Worker subscription of ₹${WORKER_PLAN_INR}/year is mandatory before signup.`,
        required_amount_inr: WORKER_PLAN_INR,
      },
    });
  }

  const worker = {
    id: randomUUID(),
    full_name: req.body.full_name,
    phone: normalizePhone(req.body.phone),
    email: normalizeEmail(req.body.email),
    skill: req.body.skill,
    city: req.body.city,
    years_experience: Number(req.body.years_experience),
    availability: req.body.availability,
    about: req.body.about || "",
    joined_at: nowIso(),
    is_active: true,
    subscription_expires_at: active.expires_at,
  };

  const { workers } = getCollections();
  await workers.insertOne(worker);
  return res.json(worker);
});

app.post("/api/contacts", async (req, res) => {
  const missing = requireFields(req.body, ["name", "email", "phone", "message"]);
  if (missing.length) return safeJsonError(res, 400, `Missing fields: ${missing.join(", ")}`);

  const contact = {
    id: randomUUID(),
    name: req.body.name,
    email: normalizeEmail(req.body.email),
    phone: normalizePhone(req.body.phone),
    message: req.body.message,
    created_at: nowIso(),
  };

  const { contacts } = getCollections();
  await contacts.insertOne(contact);
  return res.json(contact);
});

app.post("/api/users/register", async (req, res) => {
  const missing = requireFields(req.body, ["full_name", "email", "password", "phone"]);
  if (missing.length) return safeJsonError(res, 400, `Missing fields: ${missing.join(", ")}`);

  const { users } = getCollections();
  const email = normalizeEmail(req.body.email);
  const existing = await users.findOne({ email }, { projection: { _id: 0, id: 1 } });
  if (existing) return safeJsonError(res, 409, "User email already exists");

  const user = {
    id: randomUUID(),
    full_name: req.body.full_name,
    email,
    password_hash: await bcrypt.hash(req.body.password, 10),
    phone: normalizePhone(req.body.phone),
    address: req.body.address || "",
    notify_email: req.body.notify_email !== false,
    notify_sms: req.body.notify_sms !== false,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  await users.insertOne(user);
  const session = await createUserSession(user);

  return res.json({
    token: session.token,
    expires_at: session.expiresAt,
    user: coerceUserProfile(user),
  });
});

app.post("/api/users/login", async (req, res) => {
  const missing = requireFields(req.body, ["email", "password"]);
  if (missing.length) return safeJsonError(res, 400, `Missing fields: ${missing.join(", ")}`);

  const { users } = getCollections();
  const user = await users.findOne({ email: normalizeEmail(req.body.email) }, { projection: { _id: 0 } });
  if (!user) return safeJsonError(res, 401, "Invalid user credentials");

  const passOk = await bcrypt.compare(req.body.password, user.password_hash);
  if (!passOk) return safeJsonError(res, 401, "Invalid user credentials");

  const session = await createUserSession(user);
  return res.json({
    token: session.token,
    expires_at: session.expiresAt,
    user: coerceUserProfile(user),
  });
});

app.post("/api/users/logout", userAuth, async (req, res) => {
  const { userSessions } = getCollections();
  await userSessions.deleteOne({ token: req.userSession.token });
  return res.json({ message: "User logged out" });
});

app.get("/api/users/profile", userAuth, async (req, res) => {
  const { users } = getCollections();
  const user = await users.findOne({ id: req.userSession.user_id }, { projection: { _id: 0 } });
  if (!user) return safeJsonError(res, 404, "User not found");
  return res.json(coerceUserProfile(user));
});

app.put("/api/users/profile", userAuth, async (req, res) => {
  const { users } = getCollections();
  const update = {};
  ["full_name", "address", "notify_email", "notify_sms"].forEach((key) => {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  });
  if (req.body.phone !== undefined) update.phone = normalizePhone(req.body.phone);
  update.updated_at = nowIso();

  await users.updateOne({ id: req.userSession.user_id }, { $set: update });
  const user = await users.findOne({ id: req.userSession.user_id }, { projection: { _id: 0 } });
  if (!user) return safeJsonError(res, 404, "User not found");
  return res.json(coerceUserProfile(user));
});

app.get("/api/users/bookings", userAuth, async (req, res) => {
  const { bookings } = getCollections();
  const items = await bookings
    .find({ email: normalizeEmail(req.userSession.user_email) }, { projection: { _id: 0 } })
    .sort({ created_at: -1 })
    .toArray();
  return res.json(items.map(coerceBookingDoc));
});

app.get("/api/users/notifications", userAuth, async (req, res) => {
  const { userNotifications } = getCollections();
  const items = await userNotifications
    .find({ email: normalizeEmail(req.userSession.user_email) }, { projection: { _id: 0 } })
    .sort({ created_at: -1 })
    .toArray();
  return res.json(items);
});

app.patch("/api/users/notifications/:id/read", userAuth, async (req, res) => {
  const { userNotifications } = getCollections();
  await userNotifications.updateOne(
    { id: req.params.id, email: normalizeEmail(req.userSession.user_email) },
    { $set: { read: true } },
  );
  const item = await userNotifications.findOne(
    { id: req.params.id, email: normalizeEmail(req.userSession.user_email) },
    { projection: { _id: 0 } },
  );
  if (!item) return safeJsonError(res, 404, "Notification not found");
  return res.json(item);
});

app.post("/api/admin/login", async (req, res) => {
  const missing = requireFields(req.body, ["email", "password"]);
  if (missing.length) return safeJsonError(res, 400, `Missing fields: ${missing.join(", ")}`);

  const { admins } = getCollections();
  const admin = await admins.findOne({ email: normalizeEmail(req.body.email) }, { projection: { _id: 0 } });
  if (!admin) return safeJsonError(res, 401, "Invalid email or password");

  const ok = await bcrypt.compare(req.body.password, admin.password_hash);
  if (!ok) return safeJsonError(res, 401, "Invalid email or password");

  const session = await createAdminSession(admin.email);
  return res.json({ token: session.token, admin_email: admin.email, expires_at: session.expiresAt });
});

app.post("/api/admin/logout", adminAuth, async (req, res) => {
  const { adminSessions } = getCollections();
  await adminSessions.deleteOne({ token: req.adminSession.token });
  return res.json({ message: "Logged out" });
});

app.get("/api/admin/overview", adminAuth, async (_req, res) => {
  const { bookings, workers, contacts } = getCollections();
  const bookingItems = (await bookings.find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray()).map(coerceBookingDoc);
  const workerItems = (await workers.find({}, { projection: { _id: 0 } }).sort({ joined_at: -1 }).toArray()).map(coerceWorkerDoc);
  const contactItems = await contacts.find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();

  const stats = {
    pending: bookingItems.filter((item) => item.status === "pending").length,
    assigned: bookingItems.filter((item) => item.status === "assigned").length,
    completed: bookingItems.filter((item) => item.status === "completed").length,
    total_workers: workerItems.length,
    total_contacts: contactItems.length,
  };

  return res.json({
    stats,
    bookings: bookingItems,
    workers: workerItems,
    contacts: contactItems,
  });
});

app.patch("/api/admin/bookings/:bookingId/status", adminAuth, async (req, res) => {
  const { bookingId } = req.params;
  const { status, assigned_worker_id: assignedWorkerId } = req.body;
  if (!["pending", "assigned", "completed"].includes(status)) {
    return safeJsonError(res, 400, "Invalid status");
  }

  const { bookings, workers } = getCollections();
  const existingDoc = await bookings.findOne({ id: bookingId }, { projection: { _id: 0 } });
  if (!existingDoc) return safeJsonError(res, 404, "Booking not found");

  await bookings.updateOne(
    { id: bookingId },
    {
      $set: {
        status,
        assigned_worker_id: assignedWorkerId || null,
        updated_at: nowIso(),
      },
    },
  );

  let booking = coerceBookingDoc(await bookings.findOne({ id: bookingId }, { projection: { _id: 0 } }));

  if (status === "assigned" && assignedWorkerId) {
    const worker = await workers.findOne({ id: assignedWorkerId }, { projection: { _id: 0 } });
    if (worker) {
      const assignMessage = `Your service request is assigned to ${worker.full_name} (Phone: ${worker.phone}).`;
      const assignEmailBody = [
        `Booking ID: ${booking.id}`,
        `Service: ${booking.service_type}`,
        `Assigned Worker: ${worker.full_name}`,
        `Worker Phone: ${worker.phone}`,
      ].join("\n");

      const [smsLog, emailLog] = await Promise.all([
        sendSmsMessage(booking.phone, assignMessage),
        sendEmailMessage(booking.email, "Dial For Help: Worker Assigned", assignEmailBody),
      ]);

      booking.notification_log = [...(booking.notification_log || []), smsLog, emailLog];
      await bookings.updateOne({ id: booking.id }, { $set: { notification_log: booking.notification_log } });

      await createUserNotification({
        email: booking.email,
        phone: booking.phone,
        title: "Worker assigned",
        message: `${worker.full_name} assigned. Contact: ${worker.phone}`,
        category: "assignment",
        bookingId: booking.id,
      });
    }
  }

  const eventLogs = await notifyBookingEvent(booking, `Status changed to ${status}`);
  booking.notification_log = [...(booking.notification_log || []), ...eventLogs];
  booking.updated_at = nowIso();
  await bookings.updateOne(
    { id: booking.id },
    { $set: { notification_log: booking.notification_log, updated_at: booking.updated_at } },
  );

  await createUserNotification({
    email: booking.email,
    phone: booking.phone,
    title: "Booking status updated",
    message: `Your booking status is now ${status}.`,
    category: "status",
    bookingId: booking.id,
  });

  return res.json(booking);
});

app.get("/api/admin/subscriptions", adminAuth, async (_req, res) => {
  const { subscriptions } = getCollections();
  const docs = await subscriptions.find({}, { projection: { _id: 0 } }).sort({ expires_at: 1 }).toArray();
  const now = Date.now();

  const items = docs.map((entry) => {
    const expires = parseIso(entry.expires_at);
    const days = expires ? Math.max(0, Math.floor((expires.getTime() - now) / (24 * 60 * 60 * 1000))) : 0;
    return {
      id: entry.id || randomUUID(),
      plan_type: entry.plan_type || "unknown",
      subscriber_name: entry.subscriber_name || "Unknown",
      email: entry.email || "",
      phone: entry.phone || "",
      status: entry.status || "inactive",
      started_at: entry.started_at || nowIso(),
      expires_at: entry.expires_at || nowIso(),
      days_remaining: days,
      renewal_reminder_due: days <= 7,
    };
  });

  return res.json(items);
});

app.post("/api/admin/subscriptions/dispatch-renewal-reminders", adminAuth, async (_req, res) => {
  const { subscriptions } = getCollections();
  const docs = await subscriptions.find({ status: "active" }, { projection: { _id: 0 } }).toArray();

  const now = Date.now();
  const threshold = now + 7 * 24 * 60 * 60 * 1000;
  let remindedCount = 0;

  for (const sub of docs) {
    const expires = parseIso(sub.expires_at);
    if (!expires) continue;

    if (expires.getTime() >= now && expires.getTime() <= threshold) {
      const label = sub.plan_type === "user" ? "User" : "Worker";
      const msg = `Your ${label} subscription will expire on ${sub.expires_at.slice(0, 10)}. Please renew to avoid interruption.`;

      await Promise.all([
        sendSmsMessage(sub.phone, msg),
        sendEmailMessage(sub.email, "Dial For Help Subscription Renewal Reminder", msg),
      ]);

      await createUserNotification({
        email: sub.email,
        phone: sub.phone,
        title: "Subscription renewal reminder",
        message: msg,
        category: "subscription",
      });

      remindedCount += 1;
    }
  }

  return res.json({ reminded_count: remindedCount, message: "Renewal reminder dispatch completed" });
});

app.get("/api/admin/bookings/:bookingId/suggest-workers", adminAuth, async (req, res) => {
  const { bookingId } = req.params;
  const { bookings, workers } = getCollections();
  const bookingDoc = await bookings.findOne({ id: bookingId }, { projection: { _id: 0 } });
  if (!bookingDoc) return safeJsonError(res, 404, "Booking not found");

  const booking = coerceBookingDoc(bookingDoc);
  const workerItems = await workers.find({ is_active: true }, { projection: { _id: 0 } }).toArray();

  const suggestions = workerItems
    .map((worker) => {
      let score = 0;
      if (worker.skill === booking.service_type) score += 5;
      if (worker.availability === "Full-time") score += 2;
      if ((worker.years_experience || 0) >= 5) score += 1;
      return {
        worker_id: worker.id,
        full_name: worker.full_name,
        skill: worker.skill,
        availability: worker.availability,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return res.json(suggestions);
});

app.get("/api/admin/analytics", adminAuth, async (_req, res) => {
  const { bookings, subscriptions } = getCollections();
  const bookingItems = await bookings.find({}, { projection: { _id: 0, created_at: 1, status: 1 } }).toArray();
  const subscriptionItems = await subscriptions
    .find({}, { projection: { _id: 0, started_at: 1, expires_at: 1, amount_inr: 1, status: 1 } })
    .toArray();

  const buckets = getMonthBuckets(6);
  const monthlyMap = Object.fromEntries(
    buckets.map((bucket) => [bucket, { month: bucket, bookings: 0, revenue_inr: 0, renewals_due: 0 }]),
  );

  let completed = 0;
  let assignedOrCompleted = 0;
  bookingItems.forEach((item) => {
    const dt = parseIso(item.created_at);
    if (dt) {
      const key = monthBucket(dt);
      if (monthlyMap[key]) monthlyMap[key].bookings += 1;
    }

    if (["assigned", "completed"].includes(item.status)) assignedOrCompleted += 1;
    if (item.status === "completed") completed += 1;
  });

  const now = Date.now();
  let activeSubs = 0;
  let totalRevenue = 0;
  subscriptionItems.forEach((item) => {
    const start = parseIso(item.started_at);
    const exp = parseIso(item.expires_at);
    const amount = Number(item.amount_inr || 0);

    if (start) {
      const key = monthBucket(start);
      if (monthlyMap[key]) monthlyMap[key].revenue_inr += amount;
    }
    if (exp) {
      const key = monthBucket(exp);
      if (monthlyMap[key]) monthlyMap[key].renewals_due += 1;
    }
    if (item.status === "active" && exp && exp.getTime() > now) {
      activeSubs += 1;
      totalRevenue += amount;
    }
  });

  const completionRate = assignedOrCompleted ? (completed / assignedOrCompleted) * 100 : 0;

  return res.json({
    monthly: buckets.map((bucket) => monthlyMap[bucket]),
    assignment_completion_rate: Number(completionRate.toFixed(2)),
    active_subscriptions: activeSubs,
    total_revenue_inr: totalRevenue,
  });
});

app.get("/api/admin/demo-logins", adminAuth, async (_req, res) => {
  const { users, workers } = getCollections();
  const demoRegex = /@dialhelp\.demo$/i;
  const userDocs = await users
    .find({ email: demoRegex }, { projection: { _id: 0, full_name: 1, email: 1, phone: 1 } })
    .sort({ created_at: -1 })
    .limit(12)
    .toArray();
  const workerDocs = await workers
    .find({ email: demoRegex }, { projection: { _id: 0, full_name: 1, email: 1, phone: 1 } })
    .sort({ joined_at: -1 })
    .limit(12)
    .toArray();

  const items = [
    {
      role: "admin",
      full_name: "Default Admin",
      email: config.defaultAdminEmail,
      phone: "N/A",
      login_password: config.defaultAdminPassword,
    },
    ...userDocs.map((item) => ({ ...item, role: "user", login_password: "User@123" })),
    ...workerDocs.map((item) => ({ ...item, role: "worker-reference", login_password: null })),
  ];

  return res.json(items);
});

app.post("/api/admin/demo/reset", adminAuth, async (_req, res) => {
  const deleted = await resetDemoData(getCollections().db);
  return res.json({ message: "Demo records cleared", deleted_records: deleted });
});

app.post("/api/admin/demo/reset-reseed", adminAuth, async (_req, res) => {
  const { db } = getCollections();
  const deleted = await resetDemoData(db);
  const seeded = await seedDemoData(db);
  return res.json({
    message: "Reset + reseed completed",
    deleted_records: deleted,
    seeded,
  });
});

const ensureDefaultAdmin = async () => {
  const { admins } = getCollections();
  const existing = await admins.findOne({ email: config.defaultAdminEmail }, { projection: { _id: 0, id: 1 } });
  if (existing) return;

  await admins.insertOne({
    id: randomUUID(),
    email: config.defaultAdminEmail,
    password_hash: await bcrypt.hash(config.defaultAdminPassword, 10),
    created_at: nowIso(),
  });
};

module.exports = {
  app,
  ensureDefaultAdmin,
};