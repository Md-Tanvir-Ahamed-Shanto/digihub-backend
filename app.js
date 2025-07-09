const express = require("express");
const adminRoutes = require("./src/routes/adminRoutes")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const morgan = require("morgan")
const path = require("path")

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
app.use('/api/admin', adminRoutes);


app.use("/", (req, res) => {
  res.send("Server in Running...");
});

module.exports = app;
