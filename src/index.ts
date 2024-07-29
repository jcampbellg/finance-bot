import { onBookBegin, onBookCallback, onBookText } from '@conversations/book'
import { onBooksBegin } from '@conversations/books'
import { onNewBookBegin, onNewBookText } from '@conversations/newBook'
import { onConversationEnd, onMenuBegin } from '@conversations/mainMenu'
import { onStartBegin, onStartCallback, onStartText } from '@conversations/start'
import { MsgProps, QueryProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import { onAddBookBegin } from '@conversations/addBook'
import { onRoleAddBegin, onRoleAddText } from '@conversations/roleAdd'
import { onRolesBegin } from '@conversations/roles'
import { onGiveUpBegin, onGiveUpYes } from '@conversations/giveUp'
import { onBudgetBegin } from '@conversations/budget'
import { onAccountsBegin } from '@conversations/accounts'
import { onNewTransactionAccountCallback, onNewTransactionBegin, onNewTransactionNewAccountCallback, onNewTransactionText } from '@conversations/newTransaction'

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
    await onMenuBegin(msg)
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

  if (conversation.subject === 'book' && !!conversation.edit.bookId) {
    await onBookText(msg)
    return
  }

  if (conversation.subject === 'role_add' && !!conversation.edit.bookId) {
    await onRoleAddText(msg)
    return
  }

  if (conversation.subject === 'new_transaction') {
    await onNewTransactionText(msg)
    return
  }
})

bot.on('callback_query', async (query) => {
  if (!query.message || !query.data) return

  const msg = await auth({ bot, query } as QueryProps)
  const { userId, conversation, user } = msg

  await bot.sendChatAction(userId, 'typing')

  if (query.data === 'menu' && !!user.timezone) {
    await onMenuBegin(msg)
    return
  }

  if (query.data === 'end_conversation' && !!user.timezone) {
    await onConversationEnd(msg)
    return
  }

  if (conversation.subject === 'start') {
    await onStartCallback(msg)
    return
  }

  if (user.timezone === null) {
    return
  }

  if (query.data === 'new_transaction') {
    onNewTransactionBegin(msg)
    return
  }

  if (query.data.startsWith('new_transaction_account')) {
    await onNewTransactionAccountCallback(msg)
    return
  }

  if (query.data === 'new_transaction_new_account') {
    await onNewTransactionNewAccountCallback(msg)
    return
  }

  if (query.data === 'budget') {
    await onBudgetBegin(msg)
    return
  }

  if (query.data === 'accounts') {
    await onAccountsBegin(msg)
    return
  }

  if (query.data === 'add_book') {
    await onAddBookBegin(msg)
    return
  }

  if (query.data === 'new_book') {
    await onNewBookBegin(msg)
    return
  }

  if (query.data === 'books') {
    await onBooksBegin(msg)
    return
  }

  if (query.data.startsWith('bookedit')) {
    await onBookCallback(msg)
    return
  }

  if (query.data.startsWith('roles_')) {
    await onRolesBegin(msg)
    return
  }

  if (query.data.startsWith('role_add')) {
    await onRoleAddBegin(msg)
    return
  }

  if (query.data.startsWith('book_')) {
    await onBookBegin(msg)
    return
  }

  if (query.data.startsWith('giveup_yes')) {
    await onGiveUpYes(msg)
    return
  }

  if (query.data.startsWith('giveup_')) {
    await onGiveUpBegin(msg)
    return
  }
})