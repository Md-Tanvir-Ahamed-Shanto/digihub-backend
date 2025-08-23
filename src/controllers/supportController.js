const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
// Client creates issue
const createIssue = async (req, res) => {
  try {
    const { subject, description, priority, projectId } = req.body;
    const clientId = req.user.id; 

    if (!subject || !projectId || !clientId) {
      return res.status(400).json({ success: false, message: 'Subject, Project ID, and Client ID are required.' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        id: true, 
        title: true,
        partnerId: true 
      }
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Directly use the partnerId from the found project
    const assignedPartnerId = project.partnerId;
    const projectName = project.title;
    const ticket = await prisma.supportTicket.create({
      data: {
        subject,
        description,
        projectName,
        priority: priority || 'MEDIUM',
        clientId: clientId, 
        projectId: projectId,
        partnerId: assignedPartnerId, // This will always be the project's assigned partner
        status: "OPEN"
      }
    });

    res.status(201).json({ success: true, data: ticket }); 
  } catch (error) {
    console.error("Error creating issue (ticket):", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get issues by client
const getClientIssues = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const tickets = await prisma.supportTicket.findMany({
      where: { clientId },
      include: { responses: true },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Partner views issues for their projects
const getPartnerIssues = async (req, res) => {
  try {
    const { partnerId } = req.params;
    
    const tickets = await prisma.supportTicket.findMany({
      where: { partnerId },
      include: { responses: true },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Client replies to issue
const clientReplyToIssue = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    
    const response = await prisma.supportResponse.create({
      data: {
        message,
        userType: 'CLIENT',
        ticketId
      }
    });

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'REPLIED' }
    });
    
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Partner replies to issue
const partnerReplyToIssue = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    
    const response = await prisma.supportResponse.create({
      data: {
        message,
        userType: 'PARTNER',
        ticketId
      }
    });
      await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'REPLIED' }
    });
    
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Partner closes issue
const closeIssue = async (req, res) => {
  try {
    const { id } = req.params;
    
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status: 'CLOSED' }
    });
    
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin sees all issues
const getAllIssues = async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      include: { responses: true },
      orderBy: { createdAt: 'desc' }
    });

    // Get unique client IDs & partner IDs
    const clientIds = [...new Set(tickets.map(ticket => ticket.clientId))];
    const partnerIds = [...new Set(tickets.map(ticket => ticket.partnerId).filter(Boolean))];

    // Fetch clients
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, }
    });

    // Fetch partners
    const partners = await prisma.partner.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, name: true, }
    });

    // Merge both client & partner data into tickets
    const ticketsWithDetails = tickets.map(ticket => ({
      ...ticket,
      client: clients.find(c => c.id === ticket.clientId) || null,
      partner: partners.find(p => p.id === ticket.partnerId) || null
    }));

    res.json({ success: true, data: ticketsWithDetails });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};




// Admin changes status
const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // OPEN or CLOSED
    
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status }
    });
    
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin deletes issue
const deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.supportTicket.delete({
      where: { id }
    });
    
    res.json({ success: true, message: 'Issue deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Assign issue to partner
const assignToPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { partnerId } = req.body;
    
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { partnerId }
    });
    
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createIssue,
  getClientIssues,
  clientReplyToIssue,
  getPartnerIssues,
  partnerReplyToIssue,
  closeIssue,
  getAllIssues,
  changeStatus,
  deleteIssue,
  assignToPartner
};