import { onNewBookBegin, onNewBookText } from '@conversations/newBook'
import { onNewConversationEnd, onNewConversationBegin } from '@conversations/newConversation'
import { onStartBegin, onStartCallback, onStartText } from '@conversations/start'
import { MsgProps, QueryProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'

dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

bot.on('message', async (ctx) => {
  if (ctx.chat.type === 'group') {
    // TODO: Handle group messages
    return
  }

  if (ctx.chat.type !== 'private') return

  const msg = await auth({ bot, ctx } as MsgProps)
  const { text, userId, conversation } = msg

  await bot.sendChatAction(userId, 'typing')

  if (conversation.subject === 'waiting') {
    await onNewConversationBegin(msg)
    return
  }

  if (text.startsWith('/start')) {
    await onStartBegin(msg)
    return
  }

  if (conversation.subject === 'start') {
    await onStartText(msg)
    return
  }

  if (conversation.subject === 'new_book') {
    await onNewBookText(msg)
    return
  }
})

bot.on('callback_query', async (query) => {
  if (!query.message || !query.data) return

  const msg = await auth({ bot, query } as QueryProps)
  const { userId, conversation } = msg

  await bot.sendChatAction(userId, 'typing')

  if (query.data === 'end_conversation') {
    await onNewConversationEnd(msg)
    return
  }

  if (query.data === 'new_book') {
    await onNewBookBegin(msg)
    return
  }

  if (conversation.subject === 'start') {
    await onStartCallback(msg)
    return
  }
})