import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import { MAX_ACCOUNTS, MAX_CATEGORIES, MAX_FILES, MAX_INCOMES, MAX_OWN_BOOKS, MAX_PAYMENTS } from '@utils/constant'

export default async function appLimitMessage(params: ConversationProps) {
  const { query, bot, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  const appLimits = [{
    name: 'Libros que puedes Crear',
    limit: MAX_OWN_BOOKS
  }, {
    name: 'Cuentas por Libro',
    limit: MAX_ACCOUNTS
  }, {
    name: 'Ingresos por Libro',
    limit: MAX_INCOMES
  }, {
    name: 'Pagos Fijos por Libro',
    limit: MAX_PAYMENTS
  }, {
    name: 'Categorías por Libro',
    limit: MAX_CATEGORIES
  }, {
    name: 'Archivos por Transacción',
    limit: MAX_FILES
  }]

  const limits = appLimits.map(l => `<b>${l.name}:</b> ${l.limit}`).join('\n')

  await bot.editMessageText(`🚫 <b>Limites:</b>\n\n${limits}`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}