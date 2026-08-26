import mongoose from 'mongoose';

export async function connectLegacyMongo(uri: string): Promise<string> {
  const connection = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  return connection.connection.host;
}

export async function disconnectLegacyMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
