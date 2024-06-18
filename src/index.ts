import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import { prisma } from '@utils/prisma'
import waitingForCommand from '@conversations/waitingForCommand'
import onboardingTimezone from '@conversations/onboarding/onboardingTimezone'
import { MessageFromPrivate, QueryFromPrivate } from '@customTypes/messageTypes'

dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

bot.on('message', async (msg) => {
  if (msg.chat.type !== 'private') return

  const userId = msg.chat.id

  bot.sendChatAction(userId, 'typing')

  const conversation = await prisma.conversation.upsert({
    where: {
      chatId: userId,
    },
    create: {
      chatId: msg.chat.id,
      state: 'waitingForCommand',
      data: {}
    },
    update: {}
  })

  const text = msg.text?.trim() || ''

  if (conversation.state === 'waitingForCommand' || text === '/start' || text === '/cancelar') {
    waitingForCommand({
      bot,
      msg: msg as MessageFromPrivate
    })
  }
})

bot.on('callback_query', async (query) => {
  if (!query.message || !query.data) return

  const userId = query.message.chat.id
  bot.sendChatAction(userId, 'typing')

  const conversation = await prisma.conversation.upsert({
    where: {
      chatId: userId,
    },
    create: {
      chatId: userId,
      state: 'waitingForCommand',
      data: {}
    },
    update: {}
  })

  if (conversation.state === 'onboarding_timezone') {
    onboardingTimezone({
      bot,
      query: query as QueryFromPrivate,
      conversation
    })
  }
})