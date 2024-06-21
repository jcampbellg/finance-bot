import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import { prisma } from '@utils/prisma'
import waitingForCommand from '@conversations/waitingForCommand'
import { MessageFromPrivate, QueryFromPrivate } from '@customTypes/messageTypes'
import { booksOnText, booksOnCallbackQuery } from '@conversations/books'
import { onboardingOnCallbackQuery } from '@conversations/onboarding'
import { bundgetOnCallbackQuery } from '@conversations/budget'
import { accountsOnCallbackQuery, accountsOnText } from '@conversations/budget/accounts'
import { categoriesOnCallbackQuery, categoriesOnText } from '@conversations/budget/categories'
import { newExpenseOnCallbackQuery, newExpenseOnText } from '@conversations/newExpense'
import { expenseOnCallbackQuery, expenseOnText } from '@conversations/expense'

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

  if (conversation.state === 'waitingForCommand' || text.startsWith('/')) {
    waitingForCommand({
      bot,
      msg: msg as MessageFromPrivate
    })
    return
  }

  if (conversation.state === 'books') {
    booksOnText({
      bot,
      msg: msg as MessageFromPrivate
    })
    return
  }

  if (conversation.state === 'accounts') {
    await accountsOnText({
      bot,
      msg: msg as MessageFromPrivate
    })
    return
  }

  if (conversation.state === 'categories') {
    await categoriesOnText({
      bot,
      msg: msg as MessageFromPrivate
    })
    return
  }

  if (conversation.state === 'newExpense') {
    await newExpenseOnText({
      bot,
      msg: msg as MessageFromPrivate
    })
    return
  }

  if (conversation.state === 'expense') {
    await expenseOnText({
      bot,
      msg: msg as MessageFromPrivate
    })
    return
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

  if (conversation.state === 'onboarding') {
    onboardingOnCallbackQuery({
      bot,
      query: query as QueryFromPrivate
    })
  }

  if (conversation.state === 'books') {
    booksOnCallbackQuery({
      bot,
      query: query as QueryFromPrivate
    })
  }

  if (conversation.state === 'budget') {
    bundgetOnCallbackQuery({
      bot,
      query: query as QueryFromPrivate
    })
  }

  if (conversation.state === 'accounts') {
    accountsOnCallbackQuery({
      bot,
      query: query as QueryFromPrivate
    })
  }

  if (conversation.state === 'categories') {
    categoriesOnCallbackQuery({
      bot,
      query: query as QueryFromPrivate
    })
  }

  if (conversation.state === 'newExpense') {
    newExpenseOnCallbackQuery({
      bot,
      query: query as QueryFromPrivate
    })
  }

  if (conversation.state === 'expense') {
    expenseOnCallbackQuery({
      bot,
      query: query as QueryFromPrivate
    })
  }
})