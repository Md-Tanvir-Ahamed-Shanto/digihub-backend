const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

const deleteAllExceptAdmin = async (req, res) => {
  try {
    // Optional: protect with a secret key
    const secret = req.headers['x-secret-key'];
    if (secret !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Run raw SQL to truncate all tables except Admin
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename != 'admins'
        LOOP
          EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" RESTART IDENTITY CASCADE';
        END LOOP;
      END $$;
    `);

    res.json({ message: 'All table data deleted except Admin table' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete data' });
  }
};

module.exports = { deleteAllExceptAdmin };
