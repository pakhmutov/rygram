import { MongoClient, Collection } from 'mongodb'

export interface Message {
  chatId: number
  userId?: number
  text: string
  timestamp: string
  businessConnectionId?: string
  deleted?: boolean
  messageId?: number
}

let client: MongoClient
export let collection: Collection<Message>

export async function connectDB(uri: string) {
  try {
    console.log(
      'Attempting to connect to MongoDB:',
      uri.replace(/:([^@]+)@/, ':<hidden>@')
    )
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: false,
    })
    await client.connect()
    collection = client.db('telegram_bot').collection<Message>('messages')
    console.log('DB connected successfully')
  } catch (err) {
    console.error('DB connection failed:', err)
    setTimeout(() => connectDB(uri), 5000)
  }
}

export async function saveToDB(data: Message) {
  if (!collection) {
    console.warn('DB not connected, skipping save. Data:', data)
    return
  }
  try {
    await collection.insertOne(data)
    console.log('Saved to DB:', data)
  } catch (err) {
    console.error('DB save error:', err)
  }
}
