import { MongoClient, Collection } from 'mongodb';

export interface Message {
  chatId: number;
  userId?: number;
  text: string;
  timestamp: string;
  businessConnectionId?: string;
}

let client: MongoClient;
let collection: Collection<Message>;

export async function connectDB(uri: string) {
  try {
    client = new MongoClient(uri);
    await client.connect();
    collection = client.db('telegram_bot').collection<Message>('messages');
    console.log('DB connected');
  } catch (err) {
    console.error('DB error:', err);
    setTimeout(() => connectDB(uri), 5000);
  }
}

export async function saveToDB(data: Message) {
  if (!collection) {
    console.warn('DB not connected, skipping save');
    return;
  }
  await collection.insertOne(data);
}
