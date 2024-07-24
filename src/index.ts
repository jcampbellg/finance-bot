import waitingForCommand from '@conversations/waitingForCommand'
import { MsgProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'

dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

bot.on('message', async (msg) => {
  if (msg.chat.type === 'group') {
    // TODO: Handle group messages
    return
  }

  if (msg.chat.type !== 'private') return

  const conversation = await auth({ bot, msg } as MsgProps)
  const { text, userId } = conversation

  bot.sendChatAction(userId, 'typing')

  if (text.startsWith('/')) {
    waitingForCommand(conversation)
  }
})

bot.on('callback_query', async (query) => {
  if (!query.message || !query.data) return

  const userId = query.message.chat.id
  bot.sendChatAction(userId, 'typing')
})