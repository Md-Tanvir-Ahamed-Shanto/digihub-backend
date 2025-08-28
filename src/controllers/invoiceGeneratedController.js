const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

const invoiceController = {
  // Get all invoices
  getAllInvoices: async (req, res) => {
    try {
        // get recent data 
      const invoices = await prisma.generatedInvoice.findMany({
        orderBy: { createdAt: 'desc' }, // Order by most recent entry
      });
      res.status(200).json(invoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Get invoice by ID
  getInvoiceById: async (req, res) => {
    const { id } = req.params;
    try {
      const invoice = await prisma.generatedInvoice.findUnique({
        where: {
          id: id,
        },
      });

      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }

      res.status(200).json(invoice);
    } catch (error) {
      console.error('Error fetching invoice by ID:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Create a new invoice
  createInvoice: async (req, res) => {
    const { invoiceNumber, amount, gstAmount, totalAmount, gstEnabled, status, dueDate, client, project, milestone, items, companyInfo } = req.body;
    try {
      const newInvoice = await prisma.generatedInvoice.create({
        data: {
          invoiceNumber,
          amount,
          gstAmount,
          totalAmount,
          gstEnabled,
          status,
          dueDate: new Date(dueDate), // Ensure dueDate is a valid Date object
          client,
          project,
          milestone,
          items,
          companyInfo,
        },
      });
      res.status(201).json(newInvoice);
    } catch (error) {
      console.error('Error creating invoice:', error);
      res.status(500).json({ message: 'Internal server error', details: error.message });
    }
  },

  // Delete an invoice by ID
  deleteInvoiceById: async (req, res) => {
    const { id } = req.params;
    try {
      const deletedInvoice = await prisma.generatedInvoice.delete({
        where: {
          id: id,
        },
      });
      res.status(200).json({ message: 'Invoice deleted successfully', deletedInvoice });
    } catch (error) {
      if (error.code === 'P2025') { // Prisma error code for "record not found"
        return res.status(404).json({ message: 'Invoice not found' });
      }
      console.error('Error deleting invoice:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
};

module.exports = invoiceController;