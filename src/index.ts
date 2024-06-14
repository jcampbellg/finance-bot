import TelegramBot from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import z from 'zod'
import { prisma } from '@utils/prisma'
import { Book, ChatUser } from '@prisma/client'
import setMyCommands, { clearMyCommands } from '@utils/setMyCommands'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}


dayjs.extend(utc)
dayjs.extend(timezone)

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

bot.on('text', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text?.trim() || ''

  if (!msg.from || msg.from?.is_bot || msg.chat.type !== 'private') return
  const user = msg.from

  bot.sendChatAction(chatId, 'typing')

  if (text === '/start') {
    clearMyCommands(bot, msg)
    return await bot.sendMessage(chatId, `¡Hola <b>${msg.from.first_name}</b>! Bienvenido soy Bync Bot. ¿En qué puedo ayudarte?`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Crear Cuenta', callback_data: 'user_create' }],
          [{ text: 'Iniciar Sesión', callback_data: 'user_login' }],
        ]
      }
    })
  }

  const userExists = await prisma.chatUser.findUnique({
    where: {
      id: user.id
    }
  })

  if (!userExists) {
    return await bot.sendMessage(chatId, 'No tienes una cuenta. Por favor, crea una cuenta primero.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Crear Cuenta', callback_data: 'user_create' }]
        ]
      }
    })
  }

  if (text === '/libros') {
    const books = await prisma.book.findMany({
      where: {
        ownerId: user.id
      },
      include: {
        BookSelected: true
      }
    })

    return await bot.sendMessage(chatId, `Selecciona, edita o crea un libro contable.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Crear Nuevo Libro', callback_data: 'book_create' }],
          ...books.map(book => ([{
            text: `${book.BookSelected.length > 0 ? '⦿ ' : ''}${book.description}`,
            callback_data: `book_${book.id}`
          }]))
        ]
      }
    })
  }

  return bot.sendMessage(chatId, 'No entiendo lo que quieres decir. ¿Puedes intentar de nuevo?')
})

bot.on('callback_query', async (query) => {
  if (!query.message) {
    return
  }
  const chatId = query.message.chat.id
  const data = query.data || ''

  if (data === 'user_create') {
    const timezones = Intl.supportedValuesOf('timeZone')
    const continents = [...new Set(timezones.map(tz => tz.split('/')[0]))]

    const groupedContinents = continents.reduce((acc, tz, i) => {
      const index = Math.floor(i / 2)
      acc[index] = [...(acc[index] || []), tz]
      return acc
    }, [] as string[][])

    return await bot.sendMessage(chatId, `Selecciona tu zona horaria:`, {
      reply_markup: {
        inline_keyboard: groupedContinents.map(continent => continent.map(c => ({ text: c, callback_data: `timezone_region_1_${c}` })))
      }
    })
  }

  if (data.startsWith('timezone_')) {
    if (data.startsWith('timezone_region_')) {
      const continent = data.replace('timezone_region_', '').replace(/\d+_/, '')
      console.log({ continent })
      const page = parseInt(data.split('_')[2])

      const timezones = Intl.supportedValuesOf('timeZone').filter(tz => tz.startsWith(continent))

      const pageSize = 10

      const paginatedTimezones = timezones.slice((page - 1) * pageSize, page * pageSize)

      // Group timezones by 2
      const groupedTimezones = paginatedTimezones.reduce((acc, tz, i) => {
        const index = Math.floor(i / 2)
        acc[index] = [...(acc[index] || []), tz]
        return acc
      }, [] as string[][])

      return await bot.sendMessage(chatId, `Selecciona tu zona horaria:`, {
        reply_markup: {
          inline_keyboard: [
            ...groupedTimezones.map(tz => tz.map(timezone => ({ text: timezone.replace(`${continent}/`, '').replace(/_/g, ' '), callback_data: `timezone_${timezone}` }))),
            [{ text: 'Siguiente ▶', callback_data: `timezone_region_${page + 1}_${continent}` }]
          ]
        }
      })
    }

    const timezone = data.replace('timezone_', '')
    const newUser = await prisma.chatUser.upsert({
      where: {
        id: chatId
      },
      create: {
        id: chatId,
        timezone: timezone
      },
      update: {
        timezone: timezone
      },
      include: {
        books: true
      }
    })

    if (newUser.books.length === 0) {
      const newBook = await prisma.book.create({
        data: {
          description: `Finanzas de ${query.from.first_name}`,
          ownerId: query.from.id
        }
      })

      await prisma.bookSelected.create({
        data: {
          bookId: newBook.id,
          chatId: chatId
        }
      })
    }

    const spanishDate = dayjs().tz(timezone).locale('es').format('dddd, MMMM D, YYYY h:mm A')

    setMyCommands(bot, { from: query.from, chat: query.message.chat })
    return await bot.sendMessage(chatId, `¡Perfecto ${query.from.first_name}! Tu zona horaria es <b>${timezone}</b>.\n\nLa fecha y hora actual en tu zona horaria es:\n${spanishDate}.\n\nUsa el botón de Menu para acceder a los comandos disponibles.`, { parse_mode: 'HTML' })
  }

  if (data === 'user_login') {
    const user = await prisma.chatUser.findUnique({
      where: {
        id: chatId
      }
    })

    if (!user) {
      return await bot.sendMessage(chatId, 'No tienes una cuenta. Por favor, crea una cuenta primero.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Crear Cuenta', callback_data: 'user_create' }]
          ]
        }
      })
    }

    setMyCommands(bot, { from: query.from, chat: query.message.chat })
    return await bot.sendMessage(chatId, 'Bienvenido de vuelta. Usa el botón de Menu para acceder a los comandos disponibles.')
  }

  if (data === 'book_create') {

  }

  if (data.startsWith('book_')) {
    const splitData = data.split('_')
    const bookId = splitData[splitData.length - 1]
    const book = await prisma.book.findUnique({
      where: {
        id: bookId
      }
    })

    if (!book) {
      return await bot.sendMessage(chatId, '¡Ups! No se encontró el libro.')
    }

    if (data.startsWith('book_delete_')) {
      const booksCount = await prisma.book.count({
        where: {
          ownerId: query.from.id
        }
      })

      if (booksCount === 1) {
        return await bot.sendMessage(chatId, 'No puedes eliminar tu único libro.')
      }

      await prisma.bookSelected.deleteMany({
        where: {
          bookId: book.id,
          chatId: chatId
        }
      })

      return await bot.sendMessage(chatId, `Libro eliminado: ⦿ <b>${book.description}</b>`)
    }

    await prisma.bookSelected.deleteMany({
      where: {
        bookId: book.id,
        chatId: chatId
      }
    })

    await prisma.bookSelected.create({
      data: {
        bookId: book.id,
        chatId: chatId
      }
    })

    return await bot.sendMessage(chatId, `Libro seleccionado: ⦿ <b>${book.description}</b>\n\n¿Qué quieres hacer?`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Editar Libro', callback_data: `book_edit_${book.id}` }, { text: 'Eliminar Libro', callback_data: `book_delete_${book.id}` }],
          [{ text: 'Crear Moneda', callback_data: `book_currency_create_${book.id}` }, { text: 'Crear Cambio de Moneda', callback_data: `book_currency_list_${book.id}` }],
        ]
      }
    })
  }

  return await bot.sendMessage(chatId, '¡Ups! Algo salió mal')
})