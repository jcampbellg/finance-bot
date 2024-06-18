import { showContinents } from '@conversations/waitingForCommand'
import { QueryFromPrivate } from '@customTypes/messageTypes'
import { Conversation } from '@prisma/client'
import { prisma } from '@utils/prisma'
import setMyCommands from '@utils/setMyCommands'
import TelegramBot from 'node-telegram-bot-api'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

type Props = {
  bot: TelegramBot
  query: QueryFromPrivate
  conversation: Conversation
}

export default async function onboardingTimezone({ bot, query, conversation }: Props) {
  const chatId = query.message.chat.id
  const firstName = query.message.chat.first_name || query.message.chat.username || 'Usuario'

  const conversationData: any = conversation.data || {}

  let continent = conversationData.continent || null
  const btnPress = query.data

  if (!conversationData.continent) {
    continent = query.data

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
    const lastPage = Math.ceil(timezones.length / pageSize)
    const isOnLastPage = page === lastPage
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
          isOnLastPage ? [] : [{ text: 'Ver mas', callback_data: 'next' }],
          [{ text: 'Cambiar', callback_data: 'continent' }]
        ]
      }
    })
    return
  }

  if (btnPress === 'continent') {
    await showContinents({ bot, query })
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
      firstName: firstName,
      books: {
        create: {
          description: `Finazas de ${firstName}`,
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

  await setMyCommands({ bot, query })

  const dateInTimezone = dayjs().tz(timezone).format('LL hh:mma')

  await bot.sendMessage(chatId, `¡Perfecto ${firstName}!\nTu zona horaria es:\n<b>${timezone}</b>\n\nFecha:\n${dateInTimezone}`, {
    parse_mode: 'HTML'
  })
  return
}