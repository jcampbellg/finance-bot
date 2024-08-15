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

  const prevMonth = dayjs().tz(user.timezone).startOf('month').subtract(1, 'month').format('MMMM')
  const thisMonth = dayjs().tz(user.timezone).startOf('month').format('MMMM')

  await bot.editMessageText('📑 Resumen:\n\nTransacciones por:', {
    chat_id: chatId,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: [
        [{ text: `🏦 Cuenta ${prevMonth}`, callback_data: 'pdf_accounts_previous' }, { text: `🏦 Cuenta ${thisMonth}`, callback_data: 'pdf_accounts_current' }],
        [{ text: `🗂️ Categorias ${prevMonth}`, callback_data: 'pdf_categories_previous' }, { text: `🗂️ Categorias ${thisMonth}`, callback_data: 'pdf_categories_current' }],
        [{ text: `💵 Pagos Fijos ${prevMonth}`, callback_data: 'pdf_payments_previous' }, { text: `💵 Pagos Fijos ${thisMonth}`, callback_data: 'pdf_payments_current' }],
        [{ text: `💵 Ingresos ${prevMonth}`, callback_data: 'pdf_incomes_previous' }, { text: `💵 Ingresos ${thisMonth}`, callback_data: 'pdf_incomes_current' }],
        menuBtn
      ]
    }
  })
}