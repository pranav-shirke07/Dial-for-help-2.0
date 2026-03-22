import os
import random
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from passlib.context import CryptContext
from pymongo import MongoClient


ROOT_DIR = "/app"
load_dotenv(f"{ROOT_DIR}/backend/.env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

USER_COUNT = 50
WORKER_COUNT = 60
BOOKING_COUNT = 200
CONTACT_COUNT = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SERVICES = [
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
]

FIRST_NAMES = [
    "Aarav",
    "Vivaan",
    "Aditya",
    "Ishaan",
    "Arjun",
    "Reyansh",
    "Kabir",
    "Aanya",
    "Ananya",
    "Saanvi",
    "Diya",
    "Meera",
    "Myra",
    "Ira",
    "Kiara",
    "Riya",
    "Nisha",
    "Karthik",
    "Rahul",
    "Siddharth",
]

LAST_NAMES = [
    "Sharma",
    "Verma",
    "Gupta",
    "Patel",
    "Yadav",
    "Nair",
    "Reddy",
    "Singh",
    "Khanna",
    "Bansal",
    "Kulkarni",
    "Chauhan",
    "Ghosh",
    "Joshi",
    "Malhotra",
]

CITIES = [
    "Delhi",
    "Mumbai",
    "Bengaluru",
    "Hyderabad",
    "Pune",
    "Chandigarh",
    "Jaipur",
    "Lucknow",
    "Indore",
    "Ahmedabad",
]

AREAS = [
    "MG Road",
    "Sector 21",
    "Baner",
    "Koramangala",
    "Andheri West",
    "Banjara Hills",
    "Vastrapur",
    "Rajouri Garden",
    "Hazratganj",
    "Salt Lake",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def random_iso_within(days: int) -> str:
    dt = datetime.now(timezone.utc) - timedelta(
        days=random.randint(0, days),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )
    return dt.isoformat()


def normalize_phone(phone: str) -> str:
    return phone.replace(" ", "")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def identity_key(phone: str, email: str) -> str:
    return f"{normalize_phone(phone)}::{normalize_email(email)}"


def generate_phone(seed: int) -> str:
    return f"+91{str(7000000000 + seed)[-10:]}"


def build_address() -> str:
    return f"Flat {random.randint(101, 1500)}, {random.choice(AREAS)}, {random.choice(CITIES)}"


def make_notification(channel: str, recipient: str, success: bool, detail: str) -> dict:
    return {
        "channel": channel,
        "recipient": recipient,
        "success": success,
        "detail": detail,
        "timestamp": now_iso(),
    }


def main():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    existing_booking_counts = {
        item["_id"]: item["count"]
        for item in db.bookings.aggregate(
            [{"$group": {"_id": "$identity_key", "count": {"$sum": 1}}}]
        )
        if item.get("_id")
    }

    user_docs = []
    user_subscriptions = []
    user_list = []

    user_seed_prefix = int(datetime.now().timestamp())
    for idx in range(USER_COUNT):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        full_name = f"{first} {last}"
        email = normalize_email(f"{first}.{last}.{user_seed_prefix}.{idx}@dialhelp.demo")
        phone = generate_phone(100000 + idx)
        created_at = random_iso_within(300)

        doc = {
            "id": str(uuid.uuid4()),
            "full_name": full_name,
            "email": email,
            "password_hash": pwd_context.hash("User@123"),
            "phone": phone,
            "address": build_address(),
            "notify_email": random.choice([True, True, True, False]),
            "notify_sms": random.choice([True, True, False]),
            "created_at": created_at,
            "updated_at": created_at,
        }
        user_docs.append(doc)
        user_list.append(doc)

    # 70% users with active subscription
    for user in random.sample(user_list, k=int(USER_COUNT * 0.7)):
        start_at = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 150))
        expires_at = start_at + timedelta(days=365)
        user_subscriptions.append(
            {
                "id": str(uuid.uuid4()),
                "subscriber_key": identity_key(user["phone"], user["email"]),
                "subscriber_name": user["full_name"],
                "email": user["email"],
                "phone": user["phone"],
                "plan_type": "user",
                "amount_inr": 99,
                "status": "active",
                "started_at": start_at.isoformat(),
                "expires_at": expires_at.isoformat(),
                "razorpay_order_id": f"order_seed_user_{uuid.uuid4().hex[:10]}",
                "razorpay_payment_id": f"pay_seed_user_{uuid.uuid4().hex[:10]}",
                "updated_at": now_iso(),
            }
        )

    worker_docs = []
    worker_subscriptions = []
    workers_by_skill = defaultdict(list)

    for idx in range(WORKER_COUNT):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        full_name = f"{first} {last}"
        skill = random.choice(SERVICES)
        email = normalize_email(f"worker.{first}.{last}.{user_seed_prefix}.{idx}@dialhelp.demo")
        phone = generate_phone(200000 + idx)
        joined_at = random_iso_within(320)
        subscription_start = datetime.now(timezone.utc) - timedelta(days=random.randint(5, 200))
        subscription_expires = subscription_start + timedelta(days=365)

        worker_doc = {
            "id": str(uuid.uuid4()),
            "full_name": full_name,
            "phone": phone,
            "email": email,
            "skill": skill,
            "city": random.choice(CITIES),
            "years_experience": random.randint(1, 15),
            "availability": random.choice(["Full-time", "Part-time", "Weekends"]),
            "about": f"{skill} specialist with reliable service and quick turnaround.",
            "joined_at": joined_at,
            "is_active": True,
            "subscription_expires_at": subscription_expires.isoformat(),
        }
        worker_docs.append(worker_doc)
        workers_by_skill[skill].append(worker_doc)

        worker_subscriptions.append(
            {
                "id": str(uuid.uuid4()),
                "subscriber_key": identity_key(phone, email),
                "subscriber_name": full_name,
                "email": email,
                "phone": phone,
                "plan_type": "worker",
                "amount_inr": 199,
                "status": "active",
                "started_at": subscription_start.isoformat(),
                "expires_at": subscription_expires.isoformat(),
                "razorpay_order_id": f"order_seed_worker_{uuid.uuid4().hex[:10]}",
                "razorpay_payment_id": f"pay_seed_worker_{uuid.uuid4().hex[:10]}",
                "updated_at": now_iso(),
            }
        )

    booking_docs = []
    user_notifications = []

    booking_counter_by_identity = defaultdict(int)
    for identity, count in existing_booking_counts.items():
        booking_counter_by_identity[identity] = count

    user_subscription_keys = {sub["subscriber_key"] for sub in user_subscriptions}

    for idx in range(BOOKING_COUNT):
        user = random.choice(user_list)
        service_type = random.choice(SERVICES)
        status = random.choices(
            ["pending", "assigned", "completed"],
            weights=[45, 35, 20],
            k=1,
        )[0]
        booking_id = str(uuid.uuid4())
        booking_identity = identity_key(user["phone"], user["email"])

        count_before = booking_counter_by_identity[booking_identity]
        has_subscription = booking_identity in user_subscription_keys
        charge_type = "free" if count_before < 2 else ("subscription" if has_subscription else "free")

        assigned_worker = None
        if status in {"assigned", "completed"} and workers_by_skill.get(service_type):
            assigned_worker = random.choice(workers_by_skill[service_type])

        created_at = random_iso_within(220)

        notification_log = [
            make_notification("email", user["email"], True, "Email sent"),
            make_notification("sms", user["phone"], False, "Fast2SMS seed simulation"),
        ]
        if assigned_worker:
            notification_log.extend(
                [
                    make_notification("email", user["email"], True, "Assignment email sent"),
                    make_notification("sms", user["phone"], False, "Assignment SMS simulated"),
                ]
            )

        booking_docs.append(
            {
                "id": booking_id,
                "full_name": user["full_name"],
                "phone": user["phone"],
                "email": user["email"],
                "service_type": service_type,
                "address": user["address"],
                "preferred_date": (
                    datetime.now(timezone.utc) + timedelta(days=random.randint(1, 20))
                ).date().isoformat(),
                "notes": random.choice(
                    [
                        "Please call before arrival",
                        "Urgent support needed",
                        "Evening slot preferred",
                        "Gate code shared on call",
                    ]
                ),
                "status": status,
                "assigned_worker_id": assigned_worker["id"] if assigned_worker else None,
                "identity_key": booking_identity,
                "charge_type": charge_type,
                "created_at": created_at,
                "updated_at": now_iso(),
                "notification_log": notification_log,
            }
        )

        booking_counter_by_identity[booking_identity] += 1

        user_notifications.append(
            {
                "id": str(uuid.uuid4()),
                "email": user["email"],
                "phone": user["phone"],
                "title": "Booking received",
                "message": f"Your booking for {service_type} is received.",
                "category": "booking",
                "booking_id": booking_id,
                "read": random.choice([True, False]),
                "created_at": created_at,
            }
        )

        if status in {"assigned", "completed"} and assigned_worker:
            user_notifications.append(
                {
                    "id": str(uuid.uuid4()),
                    "email": user["email"],
                    "phone": user["phone"],
                    "title": "Worker assigned",
                    "message": f"{assigned_worker['full_name']} assigned. Contact: {assigned_worker['phone']}",
                    "category": "assignment",
                    "booking_id": booking_id,
                    "read": random.choice([True, False]),
                    "created_at": now_iso(),
                }
            )

    contact_docs = []
    for idx in range(CONTACT_COUNT):
        user = random.choice(user_list)
        contact_docs.append(
            {
                "id": str(uuid.uuid4()),
                "name": user["full_name"],
                "email": user["email"],
                "phone": user["phone"],
                "message": random.choice(
                    [
                        "Need urgent service update.",
                        "Please confirm worker timing.",
                        "Want to reschedule booking.",
                        "Payment issue, please help.",
                    ]
                ),
                "created_at": random_iso_within(120),
            }
        )

    db.users.insert_many(user_docs)
    db.workers.insert_many(worker_docs)
    db.bookings.insert_many(booking_docs)
    db.contacts.insert_many(contact_docs)
    db.subscriptions.insert_many(user_subscriptions + worker_subscriptions)
    db.user_notifications.insert_many(user_notifications)

    print("✅ Realistic demo dataset inserted successfully")
    print(f"Users added: {len(user_docs)}")
    print(f"Workers added: {len(worker_docs)}")
    print(f"Bookings added: {len(booking_docs)}")
    print(f"Subscriptions added: {len(user_subscriptions) + len(worker_subscriptions)}")
    print(f"Contacts added: {len(contact_docs)}")
    print(f"User notifications added: {len(user_notifications)}")
    print("Demo user login password for seeded users: User@123")


if __name__ == "__main__":
    main()
