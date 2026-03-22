const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { identityKey, normalizeEmail, normalizePhone } = require("./utils");

const SERVICES = [
  "Plumbing",
  "Electrical",
  "Cleaning",
  "General Handyman",
  "AC Repair",
  "Carpentry",
  "Painting",
  "Pest Control",
  "Appliance Repair",
  "Deep Cleaning",
  "Salon at Home",
  "RO Service",
  "CCTV Installation",
  "Movers & Packers",
  "Gardening",
];

const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Arjun", "Aanya", "Ananya", "Saanvi", "Riya", "Rahul", "Siddharth"];
const LAST_NAMES = ["Sharma", "Verma", "Gupta", "Patel", "Yadav", "Nair", "Reddy", "Singh", "Khanna", "Bansal"];
const CITIES = ["Delhi", "Mumbai", "Bengaluru", "Hyderabad", "Pune", "Jaipur", "Lucknow", "Ahmedabad"];
const AREAS = ["MG Road", "Sector 21", "Baner", "Koramangala", "Andheri West", "Banjara Hills", "Rajouri Garden"];

const nowIso = () => new Date().toISOString();
const randomFrom = (array) => array[Math.floor(Math.random() * array.length)];

const randomIsoWithinDays = (days) => {
  const now = Date.now();
  const offsetMs = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(now - offsetMs).toISOString();
};

const makePhone = (seed) => `+91${String(7000000000 + seed).slice(-10)}`;
const makeAddress = () => `Flat ${Math.floor(Math.random() * 1500) + 101}, ${randomFrom(AREAS)}, ${randomFrom(CITIES)}`;

const makeNotification = (channel, recipient, success, detail) => ({
  channel,
  recipient,
  success,
  detail,
  timestamp: nowIso(),
});

const resetDemoData = async (db) => {
  const demoRegex = /@dialhelp\.demo$/i;

  const userDocs = await db.collection("users").find({ email: demoRegex }, { projection: { email: 1, _id: 0 } }).toArray();
  const workerDocs = await db.collection("workers").find({ email: demoRegex }, { projection: { email: 1, _id: 0 } }).toArray();
  const emails = [...new Set([...userDocs, ...workerDocs].map((doc) => doc.email))];

  if (!emails.length) return 0;

  let deleted = 0;
  const collections = [
    "user_sessions",
    "users",
    "workers",
    "bookings",
    "contacts",
    "user_notifications",
    "subscriptions",
    "payment_orders",
  ];

  for (const name of collections) {
    const result = await db.collection(name).deleteMany({ email: { $in: emails } });
    deleted += result.deletedCount;
  }

  return deleted;
};

const seedDemoData = async (db) => {
  const USER_COUNT = 50;
  const WORKER_COUNT = 60;
  const BOOKING_COUNT = 200;
  const CONTACT_COUNT = 60;

  const seedPrefix = Date.now();
  const users = [];
  const workers = [];
  const bookings = [];
  const contacts = [];
  const subscriptions = [];
  const notifications = [];

  for (let i = 0; i < USER_COUNT; i += 1) {
    const first = randomFrom(FIRST_NAMES);
    const last = randomFrom(LAST_NAMES);
    const email = normalizeEmail(`${first}.${last}.${seedPrefix}.${i}@dialhelp.demo`);
    const phone = makePhone(100000 + i);
    users.push({
      id: randomUUID(),
      full_name: `${first} ${last}`,
      email,
      phone,
      password_hash: bcrypt.hashSync("User@123", 8),
      address: makeAddress(),
      notify_email: true,
      notify_sms: true,
      created_at: randomIsoWithinDays(300),
      updated_at: nowIso(),
    });
  }

  for (let i = 0; i < WORKER_COUNT; i += 1) {
    const first = randomFrom(FIRST_NAMES);
    const last = randomFrom(LAST_NAMES);
    const skill = randomFrom(SERVICES);
    const email = normalizeEmail(`worker.${first}.${last}.${seedPrefix}.${i}@dialhelp.demo`);
    const phone = makePhone(200000 + i);
    const starts = new Date(Date.now() - Math.floor(Math.random() * 140) * 86400000);
    const expires = new Date(starts.getTime() + 365 * 86400000);

    workers.push({
      id: randomUUID(),
      full_name: `${first} ${last}`,
      phone,
      email,
      skill,
      city: randomFrom(CITIES),
      years_experience: Math.floor(Math.random() * 12) + 1,
      availability: randomFrom(["Full-time", "Part-time", "Weekends"]),
      about: `${skill} specialist with fast response.`,
      joined_at: randomIsoWithinDays(320),
      is_active: true,
      subscription_expires_at: expires.toISOString(),
    });

    subscriptions.push({
      id: randomUUID(),
      subscriber_key: identityKey(phone, email),
      subscriber_name: `${first} ${last}`,
      email,
      phone,
      plan_type: "worker",
      amount_inr: 199,
      status: "active",
      started_at: starts.toISOString(),
      expires_at: expires.toISOString(),
      razorpay_order_id: `order_seed_worker_${randomUUID().slice(0, 10)}`,
      razorpay_payment_id: `pay_seed_worker_${randomUUID().slice(0, 10)}`,
      updated_at: nowIso(),
    });
  }

  const userSubsCandidates = [...users].sort(() => 0.5 - Math.random()).slice(0, Math.floor(USER_COUNT * 0.7));
  userSubsCandidates.forEach((user) => {
    const starts = new Date(Date.now() - Math.floor(Math.random() * 120) * 86400000);
    const expires = new Date(starts.getTime() + 365 * 86400000);
    subscriptions.push({
      id: randomUUID(),
      subscriber_key: identityKey(user.phone, user.email),
      subscriber_name: user.full_name,
      email: user.email,
      phone: user.phone,
      plan_type: "user",
      amount_inr: 99,
      status: "active",
      started_at: starts.toISOString(),
      expires_at: expires.toISOString(),
      razorpay_order_id: `order_seed_user_${randomUUID().slice(0, 10)}`,
      razorpay_payment_id: `pay_seed_user_${randomUUID().slice(0, 10)}`,
      updated_at: nowIso(),
    });
  });

  const workerBySkill = workers.reduce((acc, worker) => {
    if (!acc[worker.skill]) acc[worker.skill] = [];
    acc[worker.skill].push(worker);
    return acc;
  }, {});

  for (let i = 0; i < BOOKING_COUNT; i += 1) {
    const user = randomFrom(users);
    const service = randomFrom(SERVICES);
    const status = randomFrom(["pending", "assigned", "completed"]);
    const assigned = ["assigned", "completed"].includes(status) && workerBySkill[service]?.length
      ? randomFrom(workerBySkill[service])
      : null;
    const bookingId = randomUUID();

    const booking = {
      id: bookingId,
      full_name: user.full_name,
      phone: user.phone,
      email: user.email,
      service_type: service,
      address: user.address,
      preferred_date: new Date(Date.now() + (Math.floor(Math.random() * 21) + 1) * 86400000).toISOString().slice(0, 10),
      notes: randomFrom(["Please call before arrival", "Urgent support needed", "Evening slot preferred"]),
      status,
      assigned_worker_id: assigned ? assigned.id : null,
      identity_key: identityKey(user.phone, user.email),
      charge_type: randomFrom(["free", "subscription"]),
      created_at: randomIsoWithinDays(220),
      updated_at: nowIso(),
      notification_log: [
        makeNotification("email", user.email, true, "Seed email sent"),
        makeNotification("sms", user.phone, false, "Seed SMS simulated"),
      ],
    };
    bookings.push(booking);

    notifications.push({
      id: randomUUID(),
      email: user.email,
      phone: normalizePhone(user.phone),
      title: "Booking received",
      message: `Your booking for ${service} is received.`,
      category: "booking",
      booking_id: bookingId,
      read: Math.random() > 0.5,
      created_at: booking.created_at,
    });

    if (assigned) {
      notifications.push({
        id: randomUUID(),
        email: user.email,
        phone: normalizePhone(user.phone),
        title: "Worker assigned",
        message: `${assigned.full_name} assigned. Contact: ${assigned.phone}`,
        category: "assignment",
        booking_id: bookingId,
        read: Math.random() > 0.5,
        created_at: nowIso(),
      });
    }
  }

  for (let i = 0; i < CONTACT_COUNT; i += 1) {
    const user = randomFrom(users);
    contacts.push({
      id: randomUUID(),
      name: user.full_name,
      email: user.email,
      phone: user.phone,
      message: randomFrom(["Need urgent service update.", "Please confirm worker timing.", "Want to reschedule booking.", "Payment issue, please help."]),
      created_at: randomIsoWithinDays(120),
    });
  }

  await db.collection("users").insertMany(users);
  await db.collection("workers").insertMany(workers);
  await db.collection("bookings").insertMany(bookings);
  await db.collection("contacts").insertMany(contacts);
  await db.collection("subscriptions").insertMany(subscriptions);
  await db.collection("user_notifications").insertMany(notifications);

  return {
    users: users.length,
    workers: workers.length,
    bookings: bookings.length,
    contacts: contacts.length,
    subscriptions: subscriptions.length,
    notifications: notifications.length,
  };
};

module.exports = {
  seedDemoData,
  resetDemoData,
  SERVICES,
};
