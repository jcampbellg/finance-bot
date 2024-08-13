import menuBtn from '@buttons/menuBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'

export default async function summaryMenuMessage(params: ConversationPropsWithBookSelected) {
  const { query, bot, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  await bot.editMessageText('📑 Resumen', {
    chat_id: chatId,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏦 Transacciones por Cuenta', callback_data: 'pdf_accounts' }],
        [{ text: '🗂️ Transacciones por Categorias', callback_data: 'pdf_transactions' }],
        [{ text: '💵 Pagos Fijos e Ingresos', callback_data: 'pdf_payments' }],
        menuBtn
      ]
    }
  })
}