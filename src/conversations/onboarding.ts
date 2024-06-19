import { MessageFromPrivate, QueryProps } from '@customTypes/messageTypes'
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

type TextProps = {
  bot: TelegramBot
  msg: MessageFromPrivate
}

export async function onboardingOnStart({ bot, msg }: TextProps) {
  const userId = msg.chat.id
  const firstName = msg.chat.first_name || msg.chat.username || 'Usuario'

  await prisma.conversation.update({
    data: {
      state: 'onboarding',
      data: {}
    },
    where: {
      chatId: userId
    }
  })

  const continentsBtns = continentsButtons()
  await bot.sendMessage(userId, `¡Hola ${firstName}!\n¿Cuál es tu zona horaria?`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: continentsBtns
    }
  })
  return
}

export async function onboardingOnCallbackQuery({ bot, query }: QueryProps) {
  const userId = query.message.chat.id
  const firstName = query.message.chat.first_name || query.message.chat.username || 'Usuario'

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })
  const conversationData: any = conversation?.data || {}

  let continent = conversationData.continent || null
  const btnPress = query.data

  if (btnPress === 'continent') {
    const continentsBtns = continentsButtons()
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        data: {
          continent: null,
          page: 1
        }
      }
    })
    await bot.sendMessage(userId, `¿Cuál es tu zona horaria?`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: continentsBtns
      }
    })
    return
  }

  if (!conversationData.continent) {
    continent = query.data

    await prisma.conversation.update({
      where: {
        chatId: userId
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
    const page = (conversationData.page || 0) + 1

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        data: {
          continent: continent,
          page: page
        }
      }
    })

    const timezonesBtns = timezonesButtons({ page, continent })

    await bot.sendMessage(userId, `Selecciona una en <b>${continent}</b>:`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: timezonesBtns
      }
    })
    return
  }

  const timezone = btnPress

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'waitingForCommand',
      data: {}
    }
  })

  const newUser = await prisma.user.upsert({
    where: {
      id: userId
    },
    update: {
      timezone: timezone,
      firstName: firstName
    },
    create: {
      id: userId,
      timezone: timezone,
      firstName: firstName,
      books: {
        create: {
          title: `Finanzas de ${firstName}`
        }
      }
    },
    include: {
      books: true
    }
  })

  if (!newUser.bookSelectedId) {
    await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        bookSelectedId: newUser.books[0].id
      }
    })
  }

  await setMyCommands({ bot, query })

  const dateInTimezone = dayjs().tz(timezone).format('LL hh:mma (Z)')

  await bot.sendMessage(userId, `¡Perfecto ${firstName}!\nTu zona horaria es:\n<b>${timezone}</b>\n\nFecha:\n${dateInTimezone}`, {
    parse_mode: 'HTML'
  })
  return
}

type TZProps = {
  page: number
  continent: string
}

export function timezonesButtons({ page, continent }: TZProps): TelegramBot.InlineKeyboardButton[][] {
  const timezones = Intl.supportedValuesOf('timeZone').filter(tz => tz.startsWith(continent))
  const pageSize = 10
  const lastPage = Math.ceil(timezones.length / pageSize)
  const isOnLastPage = page === lastPage
  const paginatedTimezones = timezones.slice((page - 1) * pageSize, page * pageSize)

  // Group timezones by 2
  const groupedTimezones = paginatedTimezones.reduce((acc, tz, i) => {
    const index = Math.floor(i / 2)
    acc[index] = [...(acc[index] || []), tz]
    return acc
  }, [] as string[][])

  return [
    ...groupedTimezones.map(tz => tz.map(timezone => ({ text: timezone.replace(`${continent}/`, '').replace(/_/g, ' '), callback_data: `${timezone}` }))),
    isOnLastPage ? [] : [{ text: 'Ver mas', callback_data: 'next' }],
    [{ text: 'Cambiar', callback_data: 'continent' }]
  ]
}

export function continentsButtons(): TelegramBot.InlineKeyboardButton[][] {
  const timezones = Intl.supportedValuesOf('timeZone')
  const continents = [...new Set(timezones.map(tz => tz.split('/')[0]))]

  const groupedContinents = continents.reduce((acc, tz, i) => {
    const index = Math.floor(i / 2)
    acc[index] = [...(acc[index] || []), tz]
    return acc
  }, [] as string[][])

  return groupedContinents.map(continent => continent.map(c => ({ text: c, callback_data: `${c}` })))
}