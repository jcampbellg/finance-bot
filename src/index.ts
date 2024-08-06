import appLimitMessage from '@botMessage/appLimitMessage'
import bookAddMessage from '@botMessage/book/bookAddMessage'
import bookSelectMessage from '@botMessage/book/bookSelectMessage'
import booksMenuMessage from '@botMessage/book/booksMenuMessage'
import bookViewMenuMessage from '@botMessage/book/bookViewMenuMessage'
import budgetListMenuMessage from '@botMessage/budget/budgetListMenuMessage'
import budgetMenuMessage from '@botMessage/budget/budgetMenuMessage'
import menuMessage from '@botMessage/menuMessage'
import summaryMenuMessage from '@botMessage/summary/summaryMenuMessage'
import transactionHandleMessageButton from '@botMessage/transaction/transactionHandleMessageButton'
import transactionHandleMessageText from '@botMessage/transaction/transactionHandleMessageText'
import bookCreateButton from '@conversation/bookCreate/bookCreateButton'
import bookCreateText from '@conversation/bookCreate/bookCreateText'
import bookDeleteButton from '@conversation/bookDelete/bookDeleteButton'
import bookRenameButton from '@conversation/bookRename/bookRenameButton'
import bookRenameText from '@conversation/bookRename/bookRenameText'
import bookShareButton from '@conversation/bookShare/bookShareButton'
import bookShareText from '@conversation/bookShare/bookShareText'
import budgetCreateButton from '@conversation/budgetCreate/budgetCreateButton'
import budgetCreateText from '@conversation/budgetCreate/budgetCreateText'
import startButton from '@conversation/start/startButton'
import startText from '@conversation/start/startText'
import transferCreateButton from '@conversation/transferCreate/transferCreateButton'
import transferCreateText from '@conversation/transferCreate/transferCreateText'
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

  if (conversation.subject === 'book_share' || conversation.subject === 'book_owner') {
    await bookShareText(params)
    return
  }
  //#endregion

  //#region Transactions
  const notContinueTransaction: boolean = await BookSelectedWrapper(params, async (msg) => {
    return await transactionHandleMessageText(msg)
  })

  if (notContinueTransaction) return
  //#endregion

  //#region Budget
  if (conversation.subject === 'budget_create') {
    await BookSelectedWrapper(params, budgetCreateText)
    return
  }
  //#endregion

  //#region Transfer
  if (conversation.subject === 'transfer_create') {
    await BookSelectedWrapper(params, transferCreateText)
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
  if (query.data === 'app_limit') {
    await appLimitMessage(msg)
    return
  }

  if (query.data === 'menu' || query.data === 'end') {
    await menuMessage(msg, query.data === 'end')
    return
  }

  if (query.data === 'budget_menu') {
    await BookSelectedWrapper(msg, budgetMenuMessage)
    return
  }

  if (['accounts_menu', 'incomes_menu', 'categories_menu', 'payments_menu'].includes(query.data)) {
    await BookSelectedWrapper(msg, budgetListMenuMessage)
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

  if (btnPress.startsWith('book_share_') || btnPress.startsWith('book_owner_')) {
    await bookShareButton(msg)
    return
  }
  //#endregion

  //#region Transactions
  const notContinueTransaction: boolean = await BookSelectedWrapper(msg, async (msg) => {
    return await transactionHandleMessageButton(msg)
  })

  if (notContinueTransaction) return
  //#endregion

  //#region Budget
  if (btnPress.startsWith('budget_create_')) {
    await BookSelectedWrapper(msg, budgetCreateButton)
    return
  }
  //#endregion

  //#region Transfer
  if (conversation.subject === 'transfer_create' || btnPress === 'transfer_create') {
    await BookSelectedWrapper(msg, transferCreateButton)
    return
  }
  //#endregion
})