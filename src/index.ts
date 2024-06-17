import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { prisma } from '@utils/prisma'
import waitingForCommand from '@conversations/waitingForCommand'
import onboardingTimezone from '@conversations/onboarding/onboardingTimezone'

dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

dayjs.extend(utc)
dayjs.extend(timezone)


const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

bot.on('text', async (msg) => {
  if (!msg.from || msg.chat.type === 'channel' || msg.chat.type === 'supergroup') return

  const chatId = msg.chat.id
  bot.sendChatAction(chatId, 'typing')

  const conversation = await prisma.conversation.upsert({
    where: {
      chatId: chatId,
    },
    update: {},
    create: {
      chatId: chatId,
      state: 'waitingForCommand',
      data: {},
      type: msg.chat.type
    }
  })

  if (conversation.state === 'waitingForCommand' || msg.text === '/start') {
    await waitingForCommand(bot, msg)
    return
  }
})

bot.on('callback_query', async (query) => {
  if (!query.from || !query.message || query.message?.chat.type === 'channel' || query.message?.chat.type === 'supergroup' || !query.data) return
  const chatId = query.message?.chat.id
  bot.sendChatAction(chatId, 'typing')

  const conversation = await prisma.conversation.upsert({
    where: {
      chatId: chatId,
    },
    update: {},
    create: {
      chatId: chatId,
      state: 'waitingForCommand',
      data: {},
      type: query.message.chat.type
    }
  })

  if (conversation.state === 'onboarding_timezone') {
    await onboardingTimezone(bot, query.message, query.data, conversation)
    return
  }
})