import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'

export default async function waitingForCommand(bot: TelegramBot, msg: TelegramBot.Message) {
  if (!msg.from || msg.chat.type === 'channel' || msg.chat.type === 'supergroup') return

  const chatId = msg.chat.id
  const userChat = msg.from

  const text = msg.text?.trim() || ''

  if (text === '/start') {
    await prisma.conversation.update({
      data: {
        state: 'onboarding_timezone',
        data: {}
      },
      where: {
        chatId
      }
    })

    const timezones = Intl.supportedValuesOf('timeZone')
    const continents = [...new Set(timezones.map(tz => tz.split('/')[0]))]

    const groupedContinents = continents.reduce((acc, tz, i) => {
      const index = Math.floor(i / 2)
      acc[index] = [...(acc[index] || []), tz]
      return acc
    }, [] as string[][])

    await bot.sendMessage(chatId, `¡Hola ${userChat.first_name}!\n¿Cuál es tu zona horaria?`, {
      reply_markup: {
        inline_keyboard: groupedContinents.map(continent => continent.map(c => ({ text: c, callback_data: `${c}` })))
      }
    })
    return
  }

  if (text === '/libros') {
    const books = await prisma.book.findMany({
      where: {
        OR: [
          { ownerId: userChat.id },
          {
            share: {
              some: {
                userId: userChat.id
              }
            }
          }
        ]
      },
      include: {
        bookSelected: true
      }
    })

    await prisma.conversation.update({
      data: {
        state: 'books',
        data: {}
      },
      where: {
        chatId
      }
    })

    return await bot.sendMessage(chatId, `Selecciona, edita o crea un libro contable.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Crear Nuevo Libro', callback_data: 'create' }],
          ...books.map(book => ([{
            text: `${book.bookSelected.length > 0 ? '⦿ ' : ''}${book.description}`,
            callback_data: `${book.id}`
          }]))
        ]
      }
    })
  }

  await bot.sendMessage(chatId, 'No entiendo ese comando.')
  return
}