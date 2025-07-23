require("dotenv").config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || "secretcode",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "your_jwt_secret",
  stripeSecretKey:
    process.env.STRIPE_SECRET_KEY || "sk_test_YOUR_STRIPE_SECRET_KEY",
  stripeWebhookSecret:
    process.env.STRIPE_WEBHOOK_SECRET || "whsec_YOUR_STRIPE_WEBHOOK_SECRET",
};
