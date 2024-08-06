import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'

export default async function budgetMenuMessage(params: ConversationPropsWithBookSelected) {
  const { query, bot, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  await bot.editMessageText('📝 Preparar Presupuesto', {
    chat_id: chatId,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏦 Cuentas', callback_data: 'accounts_menu' }, { text: '🤑 Ingresos', callback_data: 'incomes_menu' }],
        [{ text: '🗂️ Categorias', callback_data: 'categories_menu' }, { text: '💵 Pagos Fijos', callback_data: 'payments_menu' }],
      ]
    }
  })
}