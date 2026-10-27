import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Account } from "../models/Account.js";
import { Transaction } from "../models/Transaction.js";
import { Loan } from "../models/Loan.js";
import { logger } from "../utils/logger.js";



const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("Connected to MongoDB for seeding");

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Account.deleteMany({}),
      Transaction.deleteMany({}),
      Loan.deleteMany({}),
    ]);
    logger.info("Cleared existing data");

    // Create admin
    const admin = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: "admin@banking.com",
      phone: "+1234567890",
      password: "Admin@123456",
      role: "admin",
      isVerified: true,
      kycStatus: "verified",
    });
    logger.info("Created admin user");

    // Create employee
    const employee = await User.create({
      firstName: "John",
      lastName: "Employee",
      email: "employee@banking.com",
      phone: "+1234567891",
      password: "Employee@123",
      role: "employee",
      isVerified: true,
      kycStatus: "verified",
    });
    logger.info("Created employee user");

    // Create customer 1
    const customer1 = await User.create({
      firstName: "Alice",
      lastName: "Customer",
      email: "alice@example.com",
      phone: "+1234567892",
      password: "Customer@123",
      role: "customer",
      isVerified: true,
      kycStatus: "verified",
      address: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "USA",
      },
    });
    logger.info("Created customer 1");

    // Create customer 2
    const customer2 = await User.create({
      firstName: "Bob",
      lastName: "Smith",
      email: "bob@example.com",
      phone: "+1234567893",
      password: "Customer@123",
      role: "customer",
      isVerified: true,
      kycStatus: "verified",
      address: {
        street: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90001",
        country: "USA",
      },
    });
    logger.info("Created customer 2");

    // Create accounts
    const aliceAccount = await Account.create({
      userId: customer1._id,
      accountNumber: "1234567890",
      accountType: "savings",
      balance: 50000,
      currency: "USD",
      interestRate: 2.5,
      minimumBalance: 100,
      status: "active",
    });

    const bobAccount = await Account.create({
      userId: customer2._id,
      accountNumber: "0987654321",
      accountType: "savings",
      balance: 25000,
      currency: "USD",
      interestRate: 2.5,
      minimumBalance: 100,
      status: "active",
    });
    logger.info("Created accounts");

    // Create a sample loan
    const emiAmount = Loan.calculateEMI(10000, 12.5, 12);
    const totalInterest = Loan.calculateTotalInterest(10000, emiAmount, 12);

    await Loan.create({
      userId: customer1._id,
      loanNumber: Loan.generateLoanNumber(),
      loanType: "personal",
      amount: 10000,
      interestRate: 12.5,
      termMonths: 12,
      emiAmount,
      totalInterest,
      totalAmount: 10000 + totalInterest,
      status: "pending",
      accountId: aliceAccount._id,
    });
    logger.info("Created sample loan");

    logger.info("\n✅ Database seeded successfully!\n");
    logger.info("Login credentials:");
    logger.info("Admin: admin@banking.com / Admin@123456");
    logger.info("Employee: employee@banking.com / Employee@123");
    logger.info("Customer 1: alice@example.com / Customer@123");
    logger.info("Customer 2: bob@example.com / Customer@123\n");
    logger.info(`Alice's Account: 1234567890 (Balance: $50,000)`);
    logger.info(`Bob's Account: 0987654321 (Balance: $25,000)\n`);

    process.exit(0);
  } catch (error) {
    logger.error(`Seeding error: ${error.message}`);
    console.error("\n🔍 FULL ERROR OBJECT:\n", error);
    console.error("\n🔍 STACK TRACE:\n", error.stack);
    process.exit(1);
  }
};

seedDatabase();
