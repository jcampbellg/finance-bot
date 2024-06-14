import TelegramBot from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import z from 'zod'
import { prisma } from '@utils/prisma'
import { Book, ChatUser } from '@prisma/client'
import setMyCommands, { clearMyCommands } from '@utils/setMyCommands'
dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

const conversation: Record<number, { subject: 'timezone' }> = {}

bot.on('text', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text?.trim() || ''

  if (!msg.from || msg.from?.is_bot || msg.chat.type !== 'private') return

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

  return bot.sendMessage(chatId, 'No entiendo lo que quieres decir. ¿Puedes intentar de nuevo?')
})

bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id || 0
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

      console.log({ page, timezones })

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
    await prisma.chatUser.upsert({
      where: {
        id: chatId
      },
      create: {
        id: chatId,
        timezone: timezone
      },
      update: {
        timezone: timezone
      }
    })

    return await bot.sendMessage(chatId, `¡Perfecto ${query.from.first_name}! Tu zona horaria es ${timezone}.`)
  }

  if (data === 'user_login') {
    return await bot.sendMessage(chatId, '¡Vamos a iniciar sesión!')
  }

  return await bot.sendMessage(chatId, '¡Ups! Algo salió mal')
})