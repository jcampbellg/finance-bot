import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function menuMessage(params: ConversationProps, isEnd = false) {
  const { bot, conversation, firstName, chatId } = params

  await xprisma.conversation.waiting(conversation.id)

  if (isEnd) {
    await bot.sendMessage(chatId, `¡Hasta luego ${firstName}!`, {
      parse_mode: 'HTML'
    })
  }

  await bot.sendMessage(chatId, `¡Hola ${firstName}!\n¿En qué puedo ayudarte?`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🧾 Nuevo Gasto', callback_data: 'transaction_create_expense' }, { text: '🏦 Nuevo Deposito', callback_data: 'transaction_create_deposit' }],
        [{ text: '🤑 Nuevo Ingreso', callback_data: 'income_create' }, { text: '💵 Nuevo Pago Fijo', callback_data: 'payment_create' }],
        [{ text: '🔄 Nueva Transferencia', callback_data: 'transfer_create' }],
        [{ text: '📚 Ver y Seleccionar Libro', callback_data: 'books_menu' }],
        [{ text: '📝 Preparar Presupuesto', callback_data: 'budget_menu' }],
        [{ text: '🧾 Ultimos Movimientos', callback_data: 'recent' }, { text: '📑 Resumen', callback_data: 'summary_menu' }],
        [{ text: '🔎 Buscar', callback_data: 'search' }]
      ]
    }
  })
}