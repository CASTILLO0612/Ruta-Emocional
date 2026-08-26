import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function listAllClusterDatabases() {
  try {
    const connStr = process.env.MONGO_URI;
    if (!connStr) throw new Error('No MONGO_URI');

    await mongoose.connect(connStr);
    console.log('[Cluster Admin] Conectado a MongoDB Atlas');

    const admin = mongoose.connection.db?.admin();
    if (!admin) {
      console.log('No admin db');
      return;
    }

    const { databases } = await admin.listDatabases();
    console.log('\n=== DATABASES EN TU CLUSTER MONGODB ===');
    for (const dbInfo of databases) {
      console.log(`\nDATABASE: "${dbInfo.name}" (${dbInfo.sizeOnDisk} bytes)`);
      const db = (mongoose.connection as any).client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`   └─ Colección: "${col.name}" (${count} documentos)`);
        if (col.name === 'psychologists' || col.name === 'users') {
          const sample = await db.collection(col.name).find().limit(5).toArray();
          sample.forEach((doc: any) => {
            console.log(`       • ${col.name} => email: ${doc.email}, name: ${doc.displayName}`);
          });
        }
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('[Cluster Error]', err);
  }
}

listAllClusterDatabases();
