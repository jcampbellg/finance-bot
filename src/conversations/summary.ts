import { MsgAndQueryProps, QueryProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import { prisma } from '@utils/prisma'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export async function summaryOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ bot, msg, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'summary',
      data: {}
    }
  })

  const thisMonth = dayjs().utc().startOf('month')
  const nextMonth = thisMonth.add(1, 'month')
  const prevMonth = thisMonth.subtract(1, 'month')

  await bot.sendMessage(userId, '¿Qué mes deseas ver?', {
    reply_markup: {
      inline_keyboard: [[{
        text: prevMonth.format('MMMM YYYY'),
        callback_data: `${prevMonth.format()}`
      }, {
        text: thisMonth.format('MMMM YYYY'),
        callback_data: `${thisMonth.format()}`
      }, {
        text: nextMonth.format('MMMM YYYY'),
        callback_data: `${nextMonth.format()}`
      }]]
    }
  })
}

export async function summaryOnCallbackQuery({ bot, query }: QueryProps) {
  const { user, book, userId } = await auth({ bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return
}