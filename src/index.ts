import bookAddMessage from '@botMessage/book/bookAddMessage'
import bookSelectMessage from '@botMessage/book/bookSelectMessage'
import booksMenuMessage from '@botMessage/book/booksMenuMessage'
import bookViewMenuMessage from '@botMessage/book/bookViewMenuMessage'
import budgetMenuMessage from '@botMessage/budget/budgetMenuMessage'
import menuMessage from '@botMessage/menuMessage'
import summaryMenuMessage from '@botMessage/summary/summaryMenuMessage'
import bookCreateButton from '@conversation/bookCreate/bookCreateButton'
import bookCreateText from '@conversation/bookCreate/bookCreateText'
import bookDeleteButton from '@conversation/bookDelete/bookDeleteButton'
import bookRenameButton from '@conversation/bookRename/bookRenameButton'
import bookRenameText from '@conversation/bookRename/bookRenameText'
import startButton from '@conversation/start/startButton'
import startText from '@conversation/start/startText'
import transactionCreateButton from '@conversation/transactionCreate/transactionCreateButton'
import transactionCreateText from '@conversation/transactionCreate/transactionCreateText'
import BookSelectedWrapper from '@conversation/utils/BookSelectedWrapper'
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
  //#region Auth
  if (ctx.chat.type === 'group') {
    // TODO: Handle group messages
    return
  }

  if (ctx.chat.type !== 'private') return

  const params = await auth({ bot, ctx } as MsgProps)
  const { text, chatId, conversation } = params

  await bot.sendChatAction(chatId, 'typing')
  //#endregion

  //#region Start
  if (text === '/start' || conversation.subject === 'start') {
    await startText(params)
    return
  }
  //#endregion

  //#region Books
  if (conversation.subject === 'book_create') {
    await bookCreateText(params)
    return
  }

  if (conversation.subject === 'book_rename') {
    await bookRenameText(params)
    return
  }
  //#endregion

  //#region Transactions
  if (conversation.subject === 'transaction_create') {
    await BookSelectedWrapper(params, transactionCreateText)
    return
  }
  //#endregion
})

bot.on('callback_query', async (query) => {
  //#region Auth
  if (!query.message || !query.data) return

  const msg = await auth({ bot, query } as QueryProps)
  const { chatId, conversation } = msg

  const btnPress = query.data

  await bot.sendChatAction(chatId, 'typing')
  //#endregion

  //#region Start
  if (conversation.subject === 'start') {
    if (await startButton(msg)) {
      return
    }
  }
  //#endregion

  //#region Menus
  if (query.data === 'menu' || query.data === 'end') {
    await menuMessage(msg, query.data === 'end')
    return
  }

  if (query.data === 'budget_menu') {
    await BookSelectedWrapper(msg, budgetMenuMessage)
    return
  }

  if (query.data === 'summary_menu') {
    await BookSelectedWrapper(msg, summaryMenuMessage)
    return
  }
  //#endregion

  //#region Books
  if (btnPress === 'books_menu') {
    await booksMenuMessage(msg)
    return
  }

  if (btnPress === 'book_add') {
    await bookAddMessage(msg)
    return
  }

  if (btnPress === 'book_create' || conversation.subject === 'book_create') {
    await bookCreateButton(msg)
    return
  }

  if (btnPress.startsWith('book_view')) {
    await bookViewMenuMessage(msg)
    return
  }

  if (btnPress.startsWith('book_select_')) {
    await bookSelectMessage(msg)
    return
  }

  if (btnPress.startsWith('book_rename_')) {
    await bookRenameButton(msg)
    return
  }

  if (btnPress.startsWith('book_delete_') || conversation.subject === 'book_delete') {
    await bookDeleteButton(msg)
    return
  }
  //#endregion

  //#region Transactions
  if (['transaction_create_expense', 'transaction_create_deposit'].indexOf(btnPress) !== -1 || conversation.subject === 'transaction_create') {
    await BookSelectedWrapper(msg, transactionCreateButton)
    return
  }
  //#endregion
})