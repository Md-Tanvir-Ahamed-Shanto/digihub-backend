const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const upload = require('../middlewares/upload');
const path = require('path');   
const fs = require('fs');
const multer = require('multer');

// GET all solutions
exports.getAllSolutions = async (req, res) => {
  try {
    const solutions = await prisma.solution.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(solutions);
  } catch (error) {
    console.error("Error fetching solutions:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// GET solution by ID
exports.getSolutionById = async (req, res) => {
  const { id } = req.params;
  try {
    const solution = await prisma.solution.findUnique({
      where: { id },
    });
    if (!solution) {
      return res.status(404).json({ message: "Solution not found." });
    }
    res.status(200).json(solution);
  } catch (error) {
    console.error("Error fetching solution by ID:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// CREATE new solution (with image upload)
exports.createSolution = (req, res) => {
  upload.single('image')(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    const { title, description, features } = req.body;
    let imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    let parsedFeatures = [];

    if (!title || !description || !features) {
      // If file was uploaded but required fields are missing, clean up
      if (req.file) {
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: "Title, description, and features are required." });
    }

    try {
      parsedFeatures = JSON.parse(features);
      if (!Array.isArray(parsedFeatures)) {
        throw new Error('Features must be a JSON array string.');
      }
    } catch (e) {
      if (req.file) {
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: "Features must be a valid JSON array string." });
    }

    try {
      const newSolution = await prisma.solution.create({
        data: {
          title,
          description,
          image: imageUrl,
          features: parsedFeatures,
        },
      });
      res.status(201).json({ message: "Solution created successfully.", solution: newSolution });
    } catch (error) {
      console.error("Error creating solution:", error);
      if (req.file) {
        const fs = require('fs');
        fs.unlinkSync(req.file.path); // Clean up uploaded file on DB error
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('title')) {
        return res.status(409).json({ message: "A solution with this title already exists." });
      }
      res.status(500).json({ message: "Internal server error." });
    }
  });
};

// UPDATE solution by ID (with optional image update)
exports.updateSolution = (req, res) => {
  upload.single('image')(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    const { id } = req.params;
    const { title, description, features } = req.body;
    let imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined; // Undefined if no new file

    let parsedFeatures;
    if (features !== undefined) {
      try {
        parsedFeatures = JSON.parse(features);
        if (!Array.isArray(parsedFeatures)) {
          throw new Error('Features must be a JSON array string.');
        }
      } catch (e) {
        if (req.file) {
          const fs = require('fs');
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ message: "Features must be a valid JSON array string." });
      }
    }

    try {
      const existingSolution = await prisma.solution.findUnique({ where: { id } });
      if (!existingSolution) {
        if (req.file) {
          const fs = require('fs');
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ message: "Solution not found." });
      }

      // If a new image is uploaded, delete the old one
      if (req.file && existingSolution.image) {
        const fs = require('fs');
        const oldImagePath = path.join(__dirname, '../uploads', path.basename(existingSolution.image));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      const updatedSolution = await prisma.solution.update({
        where: { id },
        data: {
          title: title !== undefined ? title : existingSolution.title,
          description: description !== undefined ? description : existingSolution.description,
          image: imageUrl !== undefined ? imageUrl : existingSolution.image, // Use new URL, or retain old
          features: parsedFeatures !== undefined ? parsedFeatures : existingSolution.features,
        },
      });
      res.status(200).json({ message: "Solution updated successfully.", solution: updatedSolution });
    } catch (error) {
      console.error("Error updating solution:", error);
      if (req.file) {
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('title')) {
        return res.status(409).json({ message: "A solution with this title already exists." });
      }
      res.status(500).json({ message: "Internal server error." });
    }
  });
};

// DELETE solution by ID
exports.deleteSolution = async (req, res) => {
  const { id } = req.params;
  try {
    const solutionToDelete = await prisma.solution.findUnique({ where: { id } });
    if (!solutionToDelete) {
      return res.status(404).json({ message: "Solution not found." });
    }

    // Delete the associated image file if it exists
    if (solutionToDelete.image) {
      const fs = require('fs');
      const imagePath = path.join(__dirname, '../uploads', path.basename(solutionToDelete.image));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await prisma.solution.delete({ where: { id } });
    res.status(204).send(); // No Content
  } catch (error) {
    console.error("Error deleting solution:", error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Solution not found.' });
    }
    res.status(500).json({ message: "Internal server error." });
  }
};