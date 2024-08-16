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

export default async function summaryPDFMenuMessage(params: ConversationPropsWithBookSelected) {
  const { query, bot, chatId, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const range = query.data.replace('pdf_', '')

  const rangeText = range === 'next' ? dayjs().tz(user.timezone).startOf('month').add(1, 'month').format('MMMM YYYY') : range === 'current' ? dayjs().tz(user.timezone).startOf('month').format('MMMM YYYY') : dayjs().tz(user.timezone).startOf('month').subtract(1, 'month').format('MMMM YYYY')

  await bot.editMessageText(`📑 Resumen de ${rangeText}`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: [
        [{ text: `🏦 Transacciones por Cuenta`, callback_data: `pdf_accounts_${range}` }],
        [{ text: `🗂️ Transacciones por Categorias`, callback_data: `pdf_categories_${range}` }],
        [{ text: `💵 Transacciones por Pagos Fijos`, callback_data: `pdf_payments_${range}` }],
        [{ text: '« Regresar', callback_data: 'summary_menu' }],
        menuBtn
      ]
    }
  })
}