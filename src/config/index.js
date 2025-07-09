require('dotenv').config(); 

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'secretcode', 
  databaseUrl: process.env.DATABASE_URL,
};