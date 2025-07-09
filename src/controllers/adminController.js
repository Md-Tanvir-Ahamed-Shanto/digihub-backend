const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");
const upload = require("../config/multerConfig");
const fs = require("fs");
const path = require("path");

exports.createAdmin = async (req, res) => {
  const { email, password, name } = req.body;
  const image = req.file ? `/uploads/profiles/${req.file.filename}` : null;

  try {
    if (!email || !password) {
      res.status(400).json({
        message: "Email & Password are required!",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name,
        image,
      },
    });
    res.status(201).json(newAdmin);
  } catch (error) {
    console.log("Admin Create Error", error)
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return res.status(409).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.adminLogin = async (req, res) => {
    console.log("calling")
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      res.status(400).json({
        message: "Email & Password are required!",
      });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: "admin" },
      config.jwtSecret,
      { expiresIn: "1d" }
    );
    res.status(200).json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        image: admin.image,
        role: "admin",
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await prisma.admin.findMany();
    res.status(200).json(admins);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAdminById = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id) {
      res.status(400).json({
        message: "Id are required!",
      });
    }
    const admin = await prisma.admin.findUnique({
      where: { id: id },
    });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.status(200).json(admin);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateAdmin = async (req, res) => {
  const { id } = req.params;
  const { email, name, password } = req.body;
  const newImage = req.file
    ? `/uploads/profiles/${req.file.filename}`
    : undefined;

  try {
    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Admin not found" });
    }

    const updateData = { email, name };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    if (newImage) {
      if (admin.image) {
        const oldImagePath = path.join(__dirname, "../../public", admin.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.image = newImage;
    } else if (req.body.image === null || req.body.image === "") {
      if (admin.image) {
        const oldImagePath = path.join(__dirname, "../../public", admin.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.image = null;
    }

    const updatedAdmin = await prisma.admin.update({
      where: { id: id },
      data: updateData,
    });
    res.status(200).json(updatedAdmin);
  } catch (error) {
    if (req.file && newImage) {
      fs.unlinkSync(req.file.path);
    }
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Admin not found" });
    }
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return res.status(409).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    if (admin.image) {
      const imagePath = path.join(__dirname, "../../public", admin.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await prisma.admin.delete({
      where: { id: id },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.changeAdminPassword = async (req, res) => {
  const { id } = req.params;
  const { oldPassword, newPassword } = req.body;

  try {
    if (req.user.id !== id) {
      return res.status(403).json({ message: "Forbidden: You can only change your own password" });
    }

    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin || !admin.password) {
      return res.status(404).json({ message: "admin not found or password not set" });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, admin.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Old password does not match" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.admin.update({
      where: { id },
      data: { password: hashedNewPassword },
    });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
