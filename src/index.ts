import { Telegraf, Context } from 'telegraf'
import { Update, Message } from 'telegraf/typings/core/types/typegram'
import express, { Express } from 'express'
import { Message as DBMessage, connectDB, saveToDB, collection } from './db'
import * as dotenv from 'dotenv'

// interface BusinessMessage extends Message.TextMessage {
//   business_connection_id?: string;
// }

// interface BusinessMessageUpdate extends Update {
//   business_message?: BusinessMessage;
// }

dotenv.config()

const bot = new Telegraf(process.env.BOT_TOKEN!)
const app: Express = express()
const PORT = process.env.PORT || 3000

if (process.env.MONGODB_URI) {
  connectDB(process.env.MONGODB_URI)
}

// Обработка обычных сообщений
bot.on('message', async (ctx) => {
  const msg = ctx.message as Message
  const data: DBMessage = {
    chatId: msg.chat.id,
    userId: msg.from?.id,
    text: ('text' in msg
      ? msg.text
      : 'caption' in msg
      ? msg.caption || 'media'
      : 'media')!,
    timestamp: new Date(msg.date * 1000).toISOString(),
    businessConnectionId:
      'business_connection_id' in msg
        ? (msg as any).business_connection_id
        : undefined,
    messageId: msg.message_id,
  }
  await saveToDB(data)
  console.log('Saved:', data)
})

// Обработка бизнес-сообщений
bot.on('business_message' as any, async (ctx: Context<any>) => {
  const msg = ctx.update.business_message
  if (!msg) return
  const data: DBMessage = {
    chatId: msg.chat.id,
    userId: msg.from?.id,
    text: ('text' in msg
      ? msg.text
      : 'caption' in msg
      ? msg.caption || 'media'
      : 'media')!,
    timestamp: new Date().toISOString(),
    businessConnectionId: msg.business_connection_id,
    messageId: msg.message_id,
  }
  await saveToDB(data)
  console.log('Saved business:', data)
})

// Обработка удалённых сообщений
bot.on('delete_chat_message' as any, async (ctx: Context<Update>) => {
  const update = ctx.update as any
  const chatId = update.chat_id
  const messageId = update.message_id
  const timestamp = new Date().toISOString()

  // Ищем сообщение в базе
  const message = await collection?.findOne({ chatId, messageId })
  if (!message) {
    console.log('Deleted message not found in DB:', { chatId, messageId })
    return
  }

  // Сохраняем как удалённое
  const deletedData: DBMessage = {
    ...message,
    deleted: true,
    timestamp,
  }
  await saveToDB(deletedData)
  console.log('Saved deleted message:', deletedData)

  if (message.businessConnectionId) {
    try {
      const connection = await (ctx.telegram as any).getBusinessConnection(
        message.businessConnectionId
      )
      const ownerId = connection.user.id
      await ctx.telegram.sendMessage(
        ownerId,
        `Удалённое сообщение из чата ${chatId}:\n` +
          `Текст: ${message.text}\n` +
          `Пользователь: ${message.userId || 'unknown'}\n` +
          `Время удаления: ${timestamp}`
      )
      console.log('Sent deleted message to owner:', ownerId)
    } catch (err) {
      console.error('Failed to send to owner:', err)
    }
  } else {
    console.log('No businessConnectionId, cannot send to owner')
  }
})

app.use(bot.webhookCallback('/secret'))
app.get('/', (_, res) => res.send('Bot alive'))
bot.telegram
  .setWebhook(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/secret`)
  .then(() => {
    console.log('Webhook set')
  })

bot.catch((err: unknown, ctx: Context<Update>) => {
  console.error('Bot error:', err, ctx)
})

app.listen(PORT, () => console.log(`Server on ${PORT}`))
bot.launch().then(() => console.log('Bot started'))
