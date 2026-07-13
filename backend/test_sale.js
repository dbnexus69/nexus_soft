const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const salesService = require('./src/services/sales.service');

async function test() {
  try {
    const sale = await salesService.getSaleById(17);
    console.log("Success:", sale.id);
    console.log("Retention %:", sale.commissionAgentRetentionPercentage);
    console.log("Commission Amount:", sale.commissionAgentAmount);
    console.log("Net Payment:", sale.commissionAgentNetPayment);
    
    // Check all service categories for supplier info
    const cats = ['ticketData','hotelData','insuranceData','planData','checkInData','migrationData','simCardData','carRentalData','fincaData','tourData','conventionData','restaurantData','visaData','passportData','petServiceData'];
    for (const key of cats) {
      const arr = sale[key] || [];
      if (arr.length > 0) {
        console.log(`\n${key}: ${arr.length} items`);
        arr.forEach((item, i) => {
          console.log(`  [${i}] supplier: ${item.supplier}, cost: ${item.supplierCost}, ta: ${item.ta}`);
        });
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
