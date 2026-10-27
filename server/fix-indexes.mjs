import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection.db;

console.log('\n=== Transactions collection indexes ===');
const txIndexes = await db.collection('transactions').listIndexes().toArray();
txIndexes.forEach((idx) => console.log(idx.name, '| unique:', idx.unique || false, '| key:', JSON.stringify(idx.key)));

console.log('\n=== Dropping duplicate index referenceNumber_1 ===');
try {
  await db.collection('transactions').dropIndex('referenceNumber_1');
  console.log('✅ Dropped referenceNumber_1');
} catch (err) {
  console.log('⚠️  Could not drop:', err.message);
}

console.log('\n=== Recreating correct index ===');
await db.collection('transactions').createIndex(
  { referenceNumber: 1 },
  { unique: true, name: 'referenceNumber_1' }
);
console.log('✅ Recreated unique referenceNumber_1');

console.log('\n=== Final indexes ===');
const finalIndexes = await db.collection('transactions').listIndexes().toArray();
finalIndexes.forEach((idx) => console.log(idx.name, '| unique:', idx.unique || false));

await mongoose.disconnect();
process.exit(0);
