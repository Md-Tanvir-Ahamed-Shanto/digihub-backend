const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config'); 


exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin.id,name: admin.name, email: admin.email, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '8h' }
    );
    const { password: _, ...adminWithoutPassword } = admin;
    res.status(200).json({
      message: "Login successful",
      token,
      admin: { ...adminWithoutPassword, role: 'admin' }
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true, image: true,
        createdAt: true, updatedAt: true,
        _count: {
          select: {
            createdPartners: true,
            processedLeads: true,
            approvedMilestones: true,
            managedProjects: true,
            expenses: true,
            systemSettings: true,
          }
        }
      },
    });
    if (!admin) {
      return res.status(404).json({ message: "Admin profile not found" });
    }
    res.status(200).json(admin);
  } catch (error) {
    console.error("Get admin profile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateAdminProfile = async (req, res) => {
  const { name, image, oldPassword, newPassword } = req.body;
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (image !== undefined) updateData.image = image;

    if (oldPassword && newPassword) {
      const isPasswordValid = await bcrypt.compare(oldPassword, admin.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Old password does not match" });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    } else if (newPassword) {
      return res.status(400).json({ message: "Old password is required to change password" });
    }

    const updatedAdmin = await prisma.admin.update({
      where: { id: req.user.id },
      data: updateData,
      select: { 
        id: true, email: true, name: true, image: true,
        createdAt: true, updatedAt: true,
      },
    });
    res.status(200).json({ message: "Profile updated successfully", admin: updatedAdmin });
  } catch (error) {
    console.error("Update admin profile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.createAdmin = async (req, res) => {
  const { email, password, name, image } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ message: "Email, password, and name are required." });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name,
        image,
      },
    });
    const { password: _, ...adminWithoutPassword } = newAdmin;
    res.status(201).json({ message: "Admin account created successfully", admin: adminWithoutPassword });
  } catch (error) {
    console.error("Admin creation error:", error);
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(409).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true, email: true, name: true, image: true,
        createdAt: true, updatedAt: true,
        _count: {
          select: {
            createdPartners: true,
            processedLeads: true,
            approvedMilestones: true,
            managedProjects: true,
  
            expenses: true,
            systemSettings: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(admins);
  } catch (error) {
    console.error("Get all admins error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAdminById = async (req, res) => {
  const { id } = req.params;
  try {
    const admin = await prisma.admin.findUnique({
      where: { id },
      include: {
        createdPartners: { select: { id: true, name: true, email: true } },
        processedLeads: { select: { id: true, projectCategory: true, status: true } },
        approvedMilestones: { select: { id: true, title: true, status: true } },
        managedProjects: { select: { id: true, title: true, status: true } },
        supportTickets: { select: { id: true, subject: true, status: true } },
        expenses: { select: { id: true, title: true, amount: true, category: true } },
        systemSettings: { select: { id: true, key: true, value: true } },
      },
    });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.status(200).json(admin);
  } catch (error) {
    console.error("Get admin by ID error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateAdminById = async (req, res) => {
  const { id } = req.params;
  const { email, password, name, image } = req.body;
  try {
    const updateData = {};
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (name) updateData.name = name;
    if (image !== undefined) updateData.image = image;

    const updatedAdmin = await prisma.admin.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, name: true, image: true,
        createdAt: true, updatedAt: true,
      },
    });
    res.status(200).json({ message: "Admin updated successfully", admin: updatedAdmin });
  } catch (error) {
    console.error("Update admin error:", error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: "Admin not found" });
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(409).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteAdminById = async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.id === id) {
        return res.status(403).json({ message: "You cannot delete your own admin account through this endpoint." });
    }

    const adminCount = await prisma.admin.count();
    if (adminCount <= 1) {
        return res.status(400).json({ message: "Cannot delete the last remaining admin account. Create another admin first if needed." });
    }

    await prisma.admin.delete({
      where: { id },
    });
    res.status(204).send(); 
  } catch (error) {
    console.error("Delete admin error:", error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: "Admin not found" });
    }
    if (error.code === 'P2003') { 
        return res.status(409).json({ message: "Cannot delete admin due to existing related data (e.g., created partners, managed projects, system settings). Please reassign or delete them first." });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateCredentials = async (req, res) => { 
    try {
      const { email,currentPassword, password } = req.body;
      const admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }
      const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid current password" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.admin.update({
        where: { id: req.user.id },
        data: { email, password: hashedPassword },
      });
      res.status(200).json({ message: "Credentials updated successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
};