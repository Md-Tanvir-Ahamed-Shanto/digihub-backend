const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const upload = require('../middlewares/upload'); // Your Multer setup
const multer = require('multer'); // <--- ADD THIS LINE
const fs = require('fs'); // <--- ENSURE fs IS REQUIRED
const path = require('path'); // <--- ENSURE path IS REQUIRED

// GET all case studies
exports.getAllCaseStudies = async (req, res) => {
  try {
    const caseStudies = await prisma.caseStudy.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(caseStudies);
  } catch (error) {
    console.error("Error fetching case studies:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// GET case study by ID
exports.getCaseStudyById = async (req, res) => {
  const { id } = req.params;
  try {
    const caseStudy = await prisma.caseStudy.findUnique({
      where: { id },
    });
    if (!caseStudy) {
      return res.status(404).json({ message: "Case study not found." });
    }
    res.status(200).json(caseStudy);
  } catch (error) {
    console.error("Error fetching case study by ID:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// CREATE new case study (with image upload)
exports.createCaseStudy = (req, res) => {
  upload.single('image')(req, res, async function (err) {
    // Corrected Multer error handling
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      // General error handling (e.g., non-Multer errors from middleware)
      return res.status(500).json({ success: false, message: err.message });
    }

    const { title, client, description, challenge, solution, results, technologies } = req.body;
    let imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    let parsedTechnologies = [];

    if (!title || !client || !description || !challenge || !solution || !results || !technologies) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: "All fields except image are required." });
    }

    try {
      parsedTechnologies = JSON.parse(technologies);
      if (!Array.isArray(parsedTechnologies)) {
        throw new Error('Technologies must be a JSON array string.');
      }
    } catch (e) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: "Technologies must be a valid JSON array string." });
    }

    try {
      const newCaseStudy = await prisma.caseStudy.create({
        data: {
          title,
          client,
          description,
          image: imageUrl,
          challenge,
          solution,
          results,
          technologies: parsedTechnologies,
        },
      });
      res.status(201).json({ message: "Case study created successfully.", caseStudy: newCaseStudy });
    } catch (error) {
      console.error("Error creating case study:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path); // Clean up uploaded file on DB error
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('title')) {
        return res.status(409).json({ message: "A case study with this title already exists." });
      }
      res.status(500).json({ message: "Internal server error." });
    }
  });
};

// UPDATE case study by ID (with optional image update)
exports.updateCaseStudy = (req, res) => {
  upload.single('image')(req, res, async function (err) {
    if (err instanceof multer.MulterError) { // <--- Corrected Multer error check
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    const { id } = req.params;
    const { title, client, description, challenge, solution, results, technologies } = req.body;
    let imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined; // Undefined if no new file

    let parsedTechnologies;
    if (technologies !== undefined) {
      try {
        parsedTechnologies = JSON.parse(technologies);
        if (!Array.isArray(parsedTechnologies)) {
          throw new Error('Technologies must be a JSON array string.');
        }
      } catch (e) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ message: "Technologies must be a valid JSON array string." });
      }
    }

    try {
      const existingCaseStudy = await prisma.caseStudy.findUnique({ where: { id } });
      if (!existingCaseStudy) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ message: "Case study not found." });
      }

      // If a new image is uploaded, delete the old one
      if (req.file && existingCaseStudy.image) {
        const oldImagePath = path.join(__dirname, '../uploads', path.basename(existingCaseStudy.image));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      const updatedCaseStudy = await prisma.caseStudy.update({
        where: { id },
        data: {
          title: title !== undefined ? title : existingCaseStudy.title,
          client: client !== undefined ? client : existingCaseStudy.client,
          description: description !== undefined ? description : existingCaseStudy.description,
          challenge: challenge !== undefined ? challenge : existingCaseStudy.challenge,
          solution: solution !== undefined ? solution : existingCaseStudy.solution,
          results: results !== undefined ? results : existingCaseStudy.results,
          image: imageUrl !== undefined ? imageUrl : existingCaseStudy.image, // Use new URL, or retain old
          technologies: parsedTechnologies !== undefined ? parsedTechnologies : existingCaseStudy.technologies,
        },
      });
      res.status(200).json({ message: "Case study updated successfully.", caseStudy: updatedCaseStudy });
    } catch (error) {
      console.error("Error updating case study:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('title')) {
        return res.status(409).json({ message: "A case study with this title already exists." });
      }
      res.status(500).json({ message: "Internal server error." });
    }
  });
};

// DELETE case study by ID
exports.deleteCaseStudy = async (req, res) => {
  const { id } = req.params;
  try {
    const caseStudyToDelete = await prisma.caseStudy.findUnique({ where: { id } });
    if (!caseStudyToDelete) {
      return res.status(404).json({ message: "Case study not found." });
    }

    // Delete the associated image file if it exists
    if (caseStudyToDelete.image) {
      const imagePath = path.join(__dirname, '../uploads', path.basename(caseStudyToDelete.image));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await prisma.caseStudy.delete({ where: { id } });
    res.status(204).send(); // No Content
  } catch (error) {
    console.error("Error deleting case study:", error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Case study not found.' });
    }
    res.status(500).json({ message: "Internal server error." });
  }
};