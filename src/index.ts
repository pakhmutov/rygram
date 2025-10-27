import { Telegraf, Context } from 'telegraf';
import { Update, Message } from 'telegraf/typings/core/types/typegram';
import express, { Express } from 'express';
import { Message as DBMessage, connectDB, saveToDB } from './db';
import * as dotenv from 'dotenv';

// Кастомный тип для бизнес-сообщений
interface BusinessMessage extends Message.TextMessage {
  business_connection_id?: string;
}

// interface BusinessMessageUpdate extends Update {
//   business_message?: BusinessMessage;
// }

dotenv.config();

const bot = new Telegraf<any>(process.env.BOT_TOKEN!);
const app: Express = express();
const PORT = process.env.PORT || 3000;

// Подключение к MongoDB
if (process.env.MONGODB_URI) {
  connectDB(process.env.MONGODB_URI);
}

// Обработка обычных сообщений
bot.on('message', async (ctx) => {
  const msg = ctx.message as Message;
  const data: DBMessage = {
    chatId: msg.chat.id,
    userId: msg.from?.id,
    text: ('text' in msg ? msg.text : 'caption' in msg ? msg.caption || 'media' : 'media')!,
    timestamp: new Date(msg.date * 1000).toISOString(),
    businessConnectionId: 'business_connection_id' in msg ? (msg as any).business_connection_id : undefined,
  };
  await saveToDB(data);
  console.log('Saved:', data);
});

// Обработка бизнес-сообщений
bot.on('business_message' as any, async (ctx: Context<any>) => {
  const msg = ctx.update.business_message;
  if (!msg) return;
  const data: DBMessage = {
    chatId: msg.chat.id,
    userId: msg.from?.id,
    text: ('text' in msg ? msg.text : 'caption' in msg ? msg.caption || 'media' : 'media')!,
    timestamp: new Date().toISOString(),
    businessConnectionId: msg.business_connection_id,
  };
  await saveToDB(data);
  console.log('Saved business:', data);
});

// Webhook
app.use(bot.webhookCallback('/secret'));
app.get('/', (_, res) => res.send('Bot alive'));
bot.telegram.setWebhook(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/secret`).then(() => {
  console.log('Webhook set');
});

// Обработка ошибок
bot.catch((err: unknown, ctx: Context<Update>) => {
  console.error('Bot error:', err, ctx);
});

// Запуск
app.listen(PORT, () => console.log(`Server on ${PORT}`));
bot.launch().then(() => console.log('Bot started'));
