import menuBtn from '@buttons/menuBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function summaryMenuMessage(params: ConversationPropsWithBookSelected) {
  const { query, bot, chatId, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const prevMonth = dayjs().tz(user.timezone).startOf('month').subtract(1, 'month').format('MMMM YYYY')
  const thisMonth = dayjs().tz(user.timezone).startOf('month').format('MMMM YYYY')
  const nextMonth = dayjs().tz(user.timezone).startOf('month').add(1, 'month').format('MMMM YYYY')

  await bot.editMessageText('📑 Resumen:', {
    chat_id: chatId,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: [
        [{ text: `${prevMonth}`, callback_data: 'pdf_previous' },
        { text: `${thisMonth}`, callback_data: 'pdf_current' },
        { text: `${nextMonth}`, callback_data: 'pdf_next' }],
        menuBtn
      ]
    }
  })
}