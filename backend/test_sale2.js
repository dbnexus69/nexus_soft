const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const salesService = require('./src/services/sales.service');

async function test() {
  try {
    const sale = await salesService.getSaleById(17);
    console.log(JSON.stringify(sale.ticketData, null, 2));
    console.log(JSON.stringify(sale.insuranceData, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
