const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const Decimal = require('decimal.js'); // For precise decimal calculations

// Helper to calculate GST and total cost
const calculateProjectCosts = (baseCost, gstEnabled) => {
    const base = new Decimal(baseCost);
    const gstAmount = gstEnabled ? base.mul(new Decimal('0.10')) : new Decimal(0); // Assuming 10% GST
    const totalAmount = base.add(gstAmount);
    return { gstAmount, totalAmount };
};

// --- Admin-specific Project Management Routes (requires isAdmin role) ---

exports.createProject = async (req, res) => {
    const {
        title, description, category, clientId, partnerId,
        totalCost, partnerCost, adminMargin,
        gstEnabled, timeline, startDate, endDate, leadId
    } = req.body;

    if (!title || !description || !category || !clientId || !partnerId ||
        totalCost === undefined || partnerCost === undefined || adminMargin === undefined ||
        timeline === undefined) {
        return res.status(400).json({ message: "Missing required project fields." });
    }

    try {
        const { gstAmount, totalAmount: finalTotalCost } = calculateProjectCosts(totalCost, gstEnabled);

        const newProject = await prisma.project.create({
            data: {
                title,
                description,
                category,
                status: 'PENDING',
                totalCost: finalTotalCost,
                partnerCost: new Decimal(partnerCost),
                adminMargin: new Decimal(adminMargin),
                gstEnabled: !!gstEnabled,
                gstAmount: gstAmount,
                timeline: parseInt(timeline, 10),
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                clientId,
                partnerId,
                adminId: req.user.id, // Admin creating the project
                leadId: leadId || undefined, // Link to lead if provided
            }
        });

        if (leadId) {
            // Update lead status to CONVERTED and link to the new project
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    status: 'CONVERTED',
                    projectId: newProject.id, // Explicitly connect the project ID
                }
            });
        }

        res.status(201).json({ message: "Project created successfully", project: newProject });
    } catch (error) {
        console.error("Admin: Create project error:", error);
        if (error.code === 'P2002' && error.meta?.target?.includes('leadId')) {
            return res.status(409).json({ message: "This lead is already associated with another project." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getAllProjectsForAdmin = async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            include: {
                client: { select: { id: true, name: true, email: true } },
                partner: { select: { id: true, name: true, email: true } },
                // managedBy: { select: { id: true, name: true, email: true } },
                milestones: true,
                _count: {
                    select: {
                        milestones: true,
                        payments: true,
                        invoices: true,
                     
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(projects);
    } catch (error) {
        console.error("Admin: Get all projects error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getProjectByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                client: { select: { id: true, name: true, email: true } },
                partner: { select: { id: true, name: true, email: true } },
                // managedBy: { select: { id: true, name: true, email: true } },
                lead: { select: { id: true, name: true, email: true, projectCategory: true } },
                milestones: { orderBy: { order: 'asc' } },
                payments: { orderBy: { createdAt: 'desc' } },
                invoices: { orderBy: { createdAt: 'desc' } },
                supportTickets: { orderBy: { createdAt: 'desc' } }
            },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        res.status(200).json(project);
    } catch (error) {
        console.error("Admin: Get project by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateProjectByAdmin = async (req, res) => {
    const { id } = req.params;
    const {
        title, description, category, status,
        totalCost, partnerCost, adminMargin,
        gstEnabled, timeline, startDate, endDate, maintenanceMode
    } = req.body;

    try {
        const project = await prisma.project.findUnique({ where: { id } });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (category) updateData.category = category;
        if (status) updateData.status = status;

        if (totalCost !== undefined || gstEnabled !== undefined) {
            // Recalculate GST if base costs or GST status change
            const currentBaseCost = new Decimal(totalCost !== undefined ? totalCost : project.totalCost); // Assume totalCost here refers to the pre-GST amount
            const currentGstEnabled = gstEnabled !== undefined ? !!gstEnabled : project.gstEnabled;
            const { gstAmount, totalAmount: finalTotalCost } = calculateProjectCosts(currentBaseCost, currentGstEnabled);

            if (totalCost !== undefined) updateData.totalCost = finalTotalCost; // Update with re-calculated total including GST
            if (gstEnabled !== undefined) updateData.gstEnabled = currentGstEnabled;
            if (gstEnabled !== undefined || totalCost !== undefined) updateData.gstAmount = gstAmount;
        }

        if (partnerCost !== undefined) updateData.partnerCost = new Decimal(partnerCost);
        if (adminMargin !== undefined) updateData.adminMargin = new Decimal(adminMargin);
        if (timeline !== undefined) updateData.timeline = parseInt(timeline, 10);
        if (startDate) updateData.startDate = new Date(startDate);
        if (endDate) updateData.endDate = new Date(endDate);
        if (maintenanceMode !== undefined) updateData.maintenanceMode = !!maintenanceMode;

        // Set completedAt timestamp if status changes to COMPLETED and it's not already set
        if (status === 'COMPLETED' && !project.completedAt) {
            updateData.completedAt = new Date();
        } else if (status !== 'COMPLETED' && project.completedAt) {
            // If status changes away from COMPLETED, clear completedAt
            updateData.completedAt = null;
        }

        const updatedProject = await prisma.project.update({
            where: { id },
            data: updateData,
        });
        res.status(200).json({ message: "Project updated successfully by Admin", project: updatedProject });
    } catch (error) {
        console.error("Admin: Update project error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Project not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteProjectByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        // Find the project to potentially clear its leadId association
        const projectToDelete = await prisma.project.findUnique({
            where: { id },
            select: { leadId: true }
        });

        if (projectToDelete && projectToDelete.leadId) {
            // Disconnect the project from the lead if it exists
            await prisma.lead.update({
                where: { id: projectToDelete.leadId },
                data: {
                    projectId: null, // Remove the link from lead to project
                    status: 'REJECTED' // Or a more appropriate status after project deletion
                }
            });
        }

        await prisma.project.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Delete project error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Project not found" });
        }
        if (error.code === 'P2003') { // Foreign key constraint error
            return res.status(409).json({ message: "Cannot delete project due to existing related data (e.g., milestones, payments). Please delete related records first or adjust schema cascade behavior." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};


// --- Client-specific Project Routes (requires isClient role) ---

exports.getClientProjects = async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            where: { clientId: req.user.id }, // Only projects belonging to the logged-in client
            include: {
                partner: { select: { id: true, name: true, profilePhoto: true } },
                milestones: { orderBy: { order: 'asc' } },
                payments: { orderBy: { createdAt: 'desc' } },
                invoices: { orderBy: { createdAt: 'desc' } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(projects);
    } catch (error) {
        console.error("Client: Get projects error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getClientProjectById = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findUnique({
            where: { id, clientId: req.user.id }, // Ensure project belongs to the client
            include: {
                client: { select: { id: true, name: true, email: true } },
                partner: { select: { id: true, name: true, email: true } },
                milestones: { orderBy: { order: 'asc' } },
                payments: { orderBy: { createdAt: 'desc' } },
                invoices: { orderBy: { createdAt: 'desc' } },
                supportTickets: { orderBy: { createdAt: 'desc' } }
            },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found or you don't have access to it." });
        }
        res.status(200).json(project);
    } catch (error) {
        console.error("Client: Get project by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// get client all project by client id 
exports.getClientAllProjects = async (req, res) => {
    try {
        const { id } = req.params;
        const projects = await prisma.project.findMany({
            where: { clientId: id }, // Only projects belonging to the logged-in client
            include: {
                milestones: { orderBy: { order: 'asc' } },
                payments: { orderBy: { createdAt: 'desc' } },
                invoices: { orderBy: { createdAt: 'desc' } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(projects);
    } catch (error) {
        console.error("Client: Get projects error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}


// --- Partner-specific Project Routes (requires isPartner role) ---

exports.getPartnerProjects = async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            where: { partnerId: req.user.id }, // Only projects assigned to the logged-in partner
            include: {
                client: { select: { id: true, name: true, email: true } },
                milestones: { orderBy: { order: 'asc' } },
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(projects);
    } catch (error) {
        console.error("Partner: Get projects error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPartnerProjectById = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findUnique({
            where: { id, partnerId: req.user.id }, // Ensure project is assigned to the partner
            include: {
                client: { select: { id: true, name: true, email: true } },
                milestones: { orderBy: { order: 'asc' } },
                supportTickets: { orderBy: { createdAt: 'desc' } }
            },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found or you don't have access to it." });
        }
        res.status(200).json(project);
    } catch (error) {
        console.error("Partner: Get project by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Partners might be allowed to update certain project fields (e.g., description, status progress)
exports.updateProjectByPartner = async (req, res) => {
    const { id } = req.params;
    const { description, status, startDate, endDate } = req.body; // Partner can only update specific fields
    try {
        const project = await prisma.project.findUnique({ where: { id, partnerId: req.user.id } });
        if (!project) {
            return res.status(404).json({ message: "Project not found or not assigned to you." });
        }

        const updateData = {};
        if (description) updateData.description = description;
        if (status) updateData.status = status;
        if (startDate) updateData.startDate = new Date(startDate);
        if (endDate) updateData.endDate = new Date(endDate);

        const updatedProject = await prisma.project.update({
            where: { id },
            data: updateData,
        });
        res.status(200).json({ message: "Project updated successfully by Partner", project: updatedProject });
    } catch (error) {
        console.error("Partner: Update project error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// project mark as a complete as a admin, status change 
exports.markAsComplete = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Retrieve the project
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        status: true,
        adminMargin: true,
        offerPrice: true,
        partnerCost: true,
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    // Check if the project is already completed
    if (project.status === "COMPLETED") {
      return res.status(409).json({ message: "Project is already marked as complete." });
    }

    // 2. Calculate the revenue amount
    const revenueAmount = project.adminMargin || (offerPrice - partnerCost) 
    const currentMonth = new Date().toLocaleString('en-US', { month: 'short' });

    // Use a transaction to ensure both operations succeed or fail together
    const [updatedProject, newRevenue] = await prisma.$transaction([
      // 3. Update the project status
      prisma.project.update({
        where: { id },
        data: {
          status: "COMPLETED",
        },
      }),
      // 4. Create a new revenue entry
      prisma.revenue.create({
        data: {
          month: currentMonth,
          amount: revenueAmount,
        },
      }),
    ]);

    res.status(200).json({
      message: "Project updated and revenue recorded successfully.",
      project: updatedProject,
      revenue: newRevenue,
    });

  } catch (error) {
    console.error("Error marking project as complete:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};