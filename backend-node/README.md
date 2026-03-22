# Dial For Help — Node.js + Express Backend

## Setup
1. Copy `.env.example` to `.env`
2. Fill required keys (Mongo, Razorpay, SendGrid, Fast2SMS)
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run server:
   ```bash
   npm start
   ```

## Optional: Seed Demo Data
```bash
npm run seed
```

## Default Admin
- Email: `admin@dialforhelp.com`
- Password: `Admin@123`

## API Base
- `http://localhost:8001/api` (or your configured `PORT`)