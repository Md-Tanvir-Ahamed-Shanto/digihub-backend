const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const adminRoutes = require("./src/routes/adminRoutes");
const clientRoutes = require("./src/routes/clientRoutes");
const partnerRoutes = require("./src/routes/partnerRoutes");
const leadRoutes = require("./src/routes/leadRoutes");
const milestoneRoutes = require("./src/routes/milestoneRoutes");
const projectRoutes = require("./src/routes/projectRoutes");
const invoiceRoutes = require("./src/routes/invoiceRoutes");
const contactRoutes = require("./src/routes/contactSubmissionRoutes");
const withdrawalRoutes = require("./src/routes/withdrawalRoutes");
const supportRoutes =  require("./src/routes/supportRoutes");
const subscriptionRoutes = require("./src/routes/maintenanceSubscriptionRoutes");
const paymentsRoutes = require("./src/routes/paymentRoutes")
const cardRoutes = require("./src/routes/paymentCardRoutes");
const expenseRoutes = require("./src/routes/expenseRoutes");
const gstRerportRoutes = require("./src/routes/gstReportRoutes");
const solutionRoutes = require("./src/routes/solutionRoutes");
const caseStudyRoutes = require("./src/routes/caseStudyRoutes");
const revenueRoutes = require("./src/routes/revenueRoutes")
const paymentDetailsRoutes = require("./src/routes/paymentDetailsRoutes")
const paymentRoutes = require("./src/routes/paymentAndFinanceRoutes")

const corsOptions = {
  origin: "*",
};

const app = express();
app.use(cookieParser());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cors(corsOptions));
app.use("/uploads", express.static(path.join(__dirname, "./src/uploads")));

//Route
app.use("/api/admin", adminRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/partner", partnerRoutes);
app.use("/api/lead", leadRoutes);
app.use("/api/project", projectRoutes);
app.use("/api/milestone", milestoneRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/withdrawal", withdrawalRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/card", cardRoutes)
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/gst-reports", gstRerportRoutes);
app.use('/api/solutions', solutionRoutes);
app.use('/api/case-studies', caseStudyRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/payment-details', paymentDetailsRoutes);
app.use("/api/payment", paymentRoutes);

app.use("/", (req, res) => {
  res.send("Server in Running...");
});

module.exports = app;
