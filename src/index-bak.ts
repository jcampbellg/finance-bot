import botReply from '@utils/botReply'
import TelegramBot from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import z from 'zod'
import { prisma } from '@utils/prisma'
import { Book, ChatUser } from '@prisma/client'
dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

type Onboarding = {
  timezone: string | null
}

type Chats = Record<number, {
  chatUser: ChatUser | null
  onboarding?: Onboarding
  book?: Book
  books?: {
    list: Book[]
    create?: {
      description: string
      currency?: string
    }
  }
}>

const chats: Chats = {}

const commands = [
  {
    command: 'nueva',
    description: 'Crea una nueva transacción'
  }, {
    command: 'libros',
    description: 'Muestra tus libros contables'
  }, {
    command: 'configurar',
    description: 'Configura tu libro'
  }, {
    command: 'cancelar',
    description: 'Termina la conversación actual'
  }
]

bot.on('text', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text?.trim() || ''

  if (!msg.from || msg.from?.is_bot || msg.chat.type !== 'private') return

  bot.sendChatAction(chatId, 'typing')

  if (!chats[chatId]) {
    const chatUser = await prisma.chatUser.findUnique({
      where: { id: msg.from.id }
    })

    chats[chatId] = { chatUser: chatUser }
  }

  if (text === '/start') {
    await bot.setMyCommands(commands, {
      scope: {
        type: 'all_private_chats',
      },
      language_code: msg.from.language_code
    })

    await bot.setMyCommands(commands, {
      scope: {
        type: 'chat',
        chat_id: chatId
      },
      language_code: msg.from.language_code
    })

    if (!!chats[chatId].chatUser) {
      await bot.sendMessage(chatId, botReply.start.user(msg.from.first_name))
      return
    }
    await bot.sendMessage(chatId, botReply.start.noUser())
    chats[chatId].onboarding = {
      timezone: null
    }
    return
  }

  if (!!chats[chatId].onboarding) {
    if (!!chats[chatId].onboarding.timezone) {
      if (text === '/si') {
        const chatUser = await prisma.chatUser.create({
          data: {
            id: msg.from.id,
            timezone: chats[chatId].onboarding.timezone
          }
        })

        await bot.sendMessage(chatId, botReply.onboarding.success(msg.from.first_name))

        chats[chatId].chatUser = chatUser
        delete chats[chatId].onboarding
        return
      }
    }

    const timezones = Intl.supportedValuesOf('timeZone')
    const exactMatch = timezones.find(tz => tz.toLowerCase() === text.toLowerCase())
    const someMatch = !exactMatch ? timezones.filter(tz => tz.toLowerCase().includes(text.toLowerCase())) : []

    if (!exactMatch && someMatch.length === 0) {
      await bot.sendMessage(chatId, botReply.onboarding.timezone.error)
      return
    }

    if (exactMatch) {
      chats[chatId].onboarding.timezone = exactMatch
      await bot.sendMessage(chatId, botReply.onboarding.timezone.confirm(exactMatch))
      return
    }

    if (someMatch.length > 0) {
      chats[chatId].onboarding.timezone = someMatch[0]
      await bot.sendMessage(chatId, botReply.onboarding.timezone.confirm(someMatch[0]))
      return
    }
  }

  if (!chats[chatId].chatUser) {
    await bot.sendMessage(chatId, botReply.noChatUser)
    return
  }

  if (text === '/cancelar') {
    chats[chatId] = {
      chatUser: chats[chatId].chatUser
    }

    await bot.sendMessage(chatId, botReply.start.user(msg.from.first_name))
    return
  }

  if (text === '/libros') {
    const books = await prisma.book.findMany({
      where: {
        OR: [
          { ownerId: msg.from.id },
          { share: { some: { userId: msg.from.id } } }
        ]
      }
    })

    chats[chatId].books = { list: books }
    await bot.sendMessage(chatId, botReply.ask, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Crear un libro', callback_data: 'create_book' }],
          ...books.map((book) => ([{
            text: book.description,
            callback_data: `book_${book.id}`
          }]))]
      }
    })
    return
  }

  if (!!chats[chatId].books) {
    if (text === '/crear') {
      chats[chatId].books.create = { description: '' }
      await bot.sendMessage(chatId, botReply.book.create.description, { parse_mode: 'HTML' })
      return
    }

    if (!!chats[chatId].books.create) {
      const isValid = z.string().min(3).max(15).safeParse(text)
      if (!isValid.success) {
        await bot.sendMessage(chatId, botReply.validationErrors.string(3, 15))
        return

      }
      chats[chatId].books.create.description = text
      const newBook = await prisma.book.create({
        data: {
          ownerId: msg.from.id,
          description: text
        }
      })
      await bot.sendMessage(chatId, botReply.book.one(newBook), { parse_mode: 'HTML' })
      return
    }

    if (text.match(/^\/\d+$/)) {
      const bookIndex = parseInt(text.substring(1)) - 1

      if (!chats[chatId].books.list[bookIndex]) {
        await bot.sendMessage(chatId, botReply.book.notFound)
        return
      }

      await bot.sendMessage(chatId, botReply.book.one(chats[chatId].books.list[bookIndex]), { parse_mode: 'HTML' })
      return
    }
  }

  if (!chats[chatId].book) {
    await bot.sendMessage(chatId, botReply.book.noSelected)
    return
  }
})