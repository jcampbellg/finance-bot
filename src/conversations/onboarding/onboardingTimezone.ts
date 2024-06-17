import { Conversation } from '@prisma/client'
import { prisma } from '@utils/prisma'
import setMyCommands from '@utils/setMyCommands'
import TelegramBot from 'node-telegram-bot-api'

export default async function onboardingTimezone(bot: TelegramBot, msg: TelegramBot.Message, btnPress: string, conversation: Conversation) {
  if (!msg.from || msg.chat.type === 'channel' || msg.chat.type === 'supergroup') return

  const chatId = msg.chat.id

  const conversationData: any = conversation.data || {}

  let continent = conversationData.continent || null

  if (!conversationData.continent) {
    continent = btnPress
    await prisma.conversation.update({
      where: {
        chatId
      },
      data: {
        data: {
          continent: continent,
          page: 1
        }
      }
    })
  }

  if (btnPress === 'next' || !conversationData.continent) {
    const page = conversationData.page + 1 || 1
    const timezones = Intl.supportedValuesOf('timeZone').filter(tz => tz.startsWith(continent))
    const pageSize = 10

    const paginatedTimezones = timezones.slice((page - 1) * pageSize, page * pageSize)

    await prisma.conversation.update({
      where: {
        chatId
      },
      data: {
        data: {
          continent: continent,
          page: page
        }
      }
    })

    // Group timezones by 2
    const groupedTimezones = paginatedTimezones.reduce((acc, tz, i) => {
      const index = Math.floor(i / 2)
      acc[index] = [...(acc[index] || []), tz]
      return acc
    }, [] as string[][])

    await bot.sendMessage(chatId, `Selecciona una en <b>${continent}</b>:`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          ...groupedTimezones.map(tz => tz.map(timezone => ({ text: timezone.replace(`${continent}/`, '').replace(/_/g, ' '), callback_data: `${timezone}` }))),
          [{ text: 'Siguiente', callback_data: 'next' }]
        ]
      }
    })
    return
  }

  const timezone = btnPress

  await prisma.conversation.delete({
    where: {
      chatId
    }
  })

  const newUser = await prisma.user.upsert({
    where: {
      id: chatId
    },
    update: {},
    create: {
      id: chatId,
      timezone: timezone,
      books: {
        create: {
          description: `Finazas Personales`,
          timezone: timezone
        }
      }
    },
    include: {
      books: true
    }
  })

  await prisma.bookSelected.deleteMany({
    where: {
      chatId
    }
  })

  await prisma.bookSelected.create({
    data: {
      chatId: chatId,
      bookId: newUser.books[0].id
    }
  })

  await setMyCommands(bot, { from: msg.from, chat: msg.chat })

  await bot.sendMessage(chatId, `¡Perfecto! Tu zona horaria es <b>${timezone}</b>`, {
    parse_mode: 'HTML'
  })

  return
}