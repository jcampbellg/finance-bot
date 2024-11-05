import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import appLimitMessage from '@botMessage/appLimitMessage'
import bookAddMessage from '@botMessage/book/bookAddMessage'
import bookSelectMessage from '@botMessage/book/bookSelectMessage'
import booksMenuMessage from '@botMessage/book/booksMenuMessage'
import bookViewMenuMessage from '@botMessage/book/bookViewMenuMessage'
import budgetItemViewMenuMessage from '@botMessage/budget/budgetItemViewMenuMessage'
import budgetListMenuMessage from '@botMessage/budget/budgetListMenuMessage'
import budgetMenuMessage from '@botMessage/budget/budgetMenuMessage'
import menuMessage from '@botMessage/menuMessage'
import pdfAccounts from '@botMessage/pdf/pdfAccounts'
import pdfCategories from '@botMessage/pdf/pdfCategories'
import searchMessage from '@botMessage/search/searchMessage'
import summaryMenuMessage from '@botMessage/summary/summaryMenuMessage'
import summaryPDFMenuMessage from '@botMessage/summary/summaryPDFMenuMessage'
import transactionHandleMessageButton from '@botMessage/transaction/transactionHandleMessageButton'
import transactionHandleMessageText from '@botMessage/transaction/transactionHandleMessageText'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import accountBalanceButton from '@conversation/accountBalance/accountBalanceButton'
import accountBalanceText from '@conversation/accountBalance/accountBalanceText'
import bookCreateButton from '@conversation/bookCreate/bookCreateButton'
import bookCreateText from '@conversation/bookCreate/bookCreateText'
import bookDeleteButton from '@conversation/bookDelete/bookDeleteButton'
import bookRenameButton from '@conversation/bookRename/bookRenameButton'
import bookRenameText from '@conversation/bookRename/bookRenameText'
import bookShareButton from '@conversation/bookShare/bookShareButton'
import bookShareText from '@conversation/bookShare/bookShareText'
import budgetCreateButton from '@conversation/budgetCreate/budgetCreateButton'
import budgetCreateText from '@conversation/budgetCreate/budgetCreateText'
import budgetDeleteButton from '@conversation/budgetDelete/budgetDeleteButton'
import budgetRenameButton from '@conversation/budgetRename/budgetRenameButton'
import budgetRenameText from '@conversation/budgetRename/budgetRenameText'
import categoryLimitButton from '@conversation/categoryLimit/categoryLimitButton'
import categoryLimitText from '@conversation/categoryLimit/categoryLimitText'
import searchByButton from '@conversation/searchBy/searchByButton'
import searchByText from '@conversation/searchBy/searchByText'
import startButton from '@conversation/start/startButton'
import startText from '@conversation/start/startText'
import transferCreateButton from '@conversation/transferCreate/transferCreateButton'
import transferCreateText from '@conversation/transferCreate/transferCreateText'
import BookSelectedWrapper from '@conversation/utils/BookSelectedWrapper'
import { MsgProps, QueryProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import xprisma from '@utils/xprisma'
import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import otpGenerator from 'otp-generator'

dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

bot.on('message', async (ctx) => {
  //#region Group
  if (ctx.chat.type === 'group') {
    const group = await xprisma.groupChat.upsert({
      where: { telegramId: ctx.chat.id },
      create: {
        telegramId: ctx.chat.id,
      },
      update: {},
      include: {
        books: true
      }
    })

    const groupId = Number(group.telegramId)

    if (ctx.text === '/start') {
      await bot.sendMessage(groupId, `¡Hola!\n\nAquí está el ID del grupo que necesitas compartir:\n\n<code>${group.id}</code>.\n\nPara compartir el libro dile a tu amigo que sigue estos pasos:\n1. Ve a "Ver y Seleccionar Libro".\n2. Selecciona el libro.\n3. Ve a "Compartir y Permisos".\n4. Pega el ID de usuario.`, {
        parse_mode: 'HTML'
      })
    }
    return
  }
  //#endregion

  if (ctx.chat.type !== 'private') return

  //#region Auth
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
  if (conversation.subject === 'account_balance') {
    await BookSelectedWrapper(params, accountBalanceText)
    return
  }
  if (conversation.subject === 'category_limit') {
    await BookSelectedWrapper(params, categoryLimitText)
    return
  }
  if (conversation.subject === 'budget_create') {
    await BookSelectedWrapper(params, budgetCreateText)
    return
  }
  if (conversation.subject === 'account_rename' || conversation.subject === 'category_rename') {
    await BookSelectedWrapper(params, budgetRenameText)
    return
  }
  //#endregion

  //#region Transfer
  if (conversation.subject === 'transfer_create') {
    await BookSelectedWrapper(params, transferCreateText)
    return
  }
  //#endregion

  //#region Search
  if (conversation.subject === 'search_by') {
    await BookSelectedWrapper(params, searchByText)
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

  //#region Group
  if (query.message?.chat.type === 'group') {
    if (query.data?.startsWith('transaction_view_')) {
      await BookSelectedWrapper(msg, transactionViewMenuMessage)
    }
    return
  }
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

  if (btnPress.startsWith('book_rename_') || conversation.subject === 'book_rename') {
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
  if (query.data.startsWith('account_balance_') || conversation.subject === 'account_balance') {
    await BookSelectedWrapper(msg, accountBalanceButton)
    return
  }
  if (query.data.startsWith('category_limit_') || conversation.subject === 'category_limit') {
    await BookSelectedWrapper(msg, categoryLimitButton)
    return
  }
  if (btnPress.startsWith('budget_create_')) {
    await BookSelectedWrapper(msg, budgetCreateButton)
    return
  }
  if (btnPress.startsWith('account_rename_') || btnPress.startsWith('category_rename_')) {
    await BookSelectedWrapper(msg, budgetRenameButton)
    return
  }
  if (btnPress.startsWith('account_delete_') || btnPress.startsWith('category_delete_') || conversation.subject === 'account_delete' || conversation.subject === 'category_delete') {
    await BookSelectedWrapper(msg, budgetDeleteButton)
    return
  }
  if (['accounts_menu', 'incomes_menu', 'categories_menu', 'payments_menu'].includes(query.data)) {
    await BookSelectedWrapper(msg, budgetListMenuMessage)
    return
  }
  if (btnPress.startsWith('account_view_') || btnPress.startsWith('category_view_')) {
    await BookSelectedWrapper(msg, budgetItemViewMenuMessage)
    return
  }
  //#endregion

  //#region Transfer
  if (conversation.subject === 'transfer_create' || btnPress === 'transfer_create') {
    await BookSelectedWrapper(msg, transferCreateButton)
    return
  }
  //#endregion

  //#region Search
  if (btnPress.startsWith('search_by')) {
    await BookSelectedWrapper(msg, searchByButton)
    return
  }
  if (btnPress.startsWith('search_')) {
    await BookSelectedWrapper(msg, searchMessage)
    return
  }
  //#endregion

  //#region PDFs
  if (btnPress.startsWith('pdf_payments') || btnPress.startsWith('pdf_incomes') || btnPress.startsWith('pdf_categories')) {
    await BookSelectedWrapper(msg, pdfCategories)
    return
  }
  if (btnPress.startsWith('pdf_accounts')) {
    await BookSelectedWrapper(msg, pdfAccounts)
    return
  }
  if (btnPress.startsWith('pdf_')) {
    await BookSelectedWrapper(msg, summaryPDFMenuMessage)
    return
  }
  //#endregion
})

const app = new Hono()

const port = 3000

app.post('/otp', async (c) => {
  // send otp number to user
  const body = await c.req.json()

  const user = await xprisma.user.findUnique(body.userId)

  if (!user) {
    return c.json({ error: 'No existe el usuario.' }, 404)
  }

  const otp = otpGenerator.generate(6, { upperCaseAlphabets: true, specialChars: false, digits: true, lowerCaseAlphabets: false })

  const chatId = Number(user.telegramId)

  await bot.sendMessage(chatId, `Tu código de verificación es:\n<code>${otp}</code>`, {
    parse_mode: 'HTML'
  })

  await xprisma.otp.upsert({
    create: {
      code: otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      userId: user.id
    },
    update: {
      code: otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    },
    where: {
      userId: user.id
    }
  })

  return c.json<{ message: string }>({ message: 'Código enviado.' })
})

app.get('/', (c) => {
  // Health check
  return c.text('OK')
})

console.log(`Server running at http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})