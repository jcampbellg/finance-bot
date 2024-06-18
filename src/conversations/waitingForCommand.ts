import { MessageFromPrivate, QueryFromPrivate } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'

type Props = {
  bot: TelegramBot
  msg: MessageFromPrivate
}

export default async function waitingForCommand({ bot, msg }: Props) {
  const userId = msg.chat.id
  const firstName = msg.chat.first_name || msg.chat.username || 'Usuario'

  const text = msg.text?.trim() || ''

  if (text === '/start') {
    await showContinents({ bot, msg })
    return
  }

  if (text === '/libros') {
    const books = await prisma.book.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            share: {
              some: {
                userId: userId
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
        chatId: userId
      }
    })

    await bot.sendMessage(userId, `Selecciona, edita o crea un libro contable.`, {
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

    return
  }

  if (text === '/cancelar') {
    await prisma.conversation.delete({
      where: {
        chatId: userId
      }
    })

    await bot.sendMessage(userId, '¡Hasta luego! 👋')
    return
  }

  await bot.sendMessage(userId, 'No entiendo ese comando.')
  return
}

type PropsContinents = {
  bot: TelegramBot
  msg: MessageFromPrivate
  query?: QueryFromPrivate
} | {
  bot: TelegramBot
  query: QueryFromPrivate
  msg?: MessageFromPrivate
}

export async function showContinents({ bot, msg, query }: PropsContinents) {
  const userId = msg?.chat.id || query?.message.chat.id as number
  const firstName = msg?.chat.first_name || msg?.chat.username || query?.message.chat.first_name || query?.message.chat.username || 'Usuario'

  await prisma.conversation.update({
    data: {
      state: 'onboarding_timezone',
      data: {}
    },
    where: {
      chatId: userId
    }
  })

  const timezones = Intl.supportedValuesOf('timeZone')
  const continents = [...new Set(timezones.map(tz => tz.split('/')[0]))]

  const groupedContinents = continents.reduce((acc, tz, i) => {
    const index = Math.floor(i / 2)
    acc[index] = [...(acc[index] || []), tz]
    return acc
  }, [] as string[][])

  await bot.sendMessage(userId, `¡Hola ${firstName}!\n¿Cuál es tu zona horaria?`, {
    reply_markup: {
      inline_keyboard: groupedContinents.map(continent => continent.map(c => ({ text: c, callback_data: `${c}` })))
    }
  })
}