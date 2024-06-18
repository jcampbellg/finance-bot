import { MessageFromPrivate, QueryFromPrivate } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'
import { booksOnStart } from './books'

type Props = {
  bot: TelegramBot
  msg: MessageFromPrivate
}

export default async function waitingForCommand({ bot, msg }: Props) {
  const userId = msg.chat.id
  const text = msg.text?.trim() || ''

  if (text === '/cancelar') {
    await prisma.conversation.delete({
      where: {
        chatId: userId
      }
    })

    await bot.sendMessage(userId, '¡Hasta luego! 👋')
    return
  }

  if (text === '/start') {
    const userId = msg?.chat.id

    await prisma.conversation.update({
      data: {
        state: 'onboarding_timezone',
        data: {}
      },
      where: {
        chatId: userId
      }
    })

    const firstName = msg?.chat.first_name || msg?.chat.username || 'Usuario'
    await showContinents({ bot, msg }, `¡Hola ${firstName}!\n¿Cuál es tu zona horaria?`)
    return
  }

  if (text === '/libros') {
    await booksOnStart({ bot, msg })
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

export async function showContinents({ bot, msg, query }: PropsContinents, message: string) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  const timezones = Intl.supportedValuesOf('timeZone')
  const continents = [...new Set(timezones.map(tz => tz.split('/')[0]))]

  const groupedContinents = continents.reduce((acc, tz, i) => {
    const index = Math.floor(i / 2)
    acc[index] = [...(acc[index] || []), tz]
    return acc
  }, [] as string[][])

  await bot.sendMessage(userId, message, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: groupedContinents.map(continent => continent.map(c => ({ text: c, callback_data: `${c}` })))
    }
  })
}