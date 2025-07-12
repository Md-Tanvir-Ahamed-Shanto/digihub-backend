const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const adminRoutes = require("./src/routes/adminRoutes");
const clientRoutes = require("./src/routes/clientRoutes")
const partnerRoutes = require("./src/routes/partnerRoutes")
const leadRoutes = require("./src/routes/leadRoutes")
const milestoneRoutes = require("./src/routes/milestoneRoutes")
const projectRoutes = require("./src/routes/projectRoutes")

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
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

//Route
app.use("/api/admin", adminRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/partner", partnerRoutes)
app.use("/api/lead",leadRoutes)
app.use("/api/project", projectRoutes)
app.use("/api/milestone", milestoneRoutes)

app.use("/", (req, res) => {
  res.send("Server in Running...");
});

module.exports = app;
