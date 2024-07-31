import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function menuSend(params: ConversationProps) {
  const { bot, conversation, firstName, chatId } = params

  await xprisma.conversation.waiting(conversation.id)

  await bot.sendMessage(chatId, `¡Hola ${firstName}!\n¿En qué puedo ayudarte?`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🧾 Nuevo Gasto', callback_data: 'trans_expense_new' }, { text: '🏦 Nuevo Deposito', callback_data: 'trans_deposit_new' }],
        [{ text: '🤑 Nuevo Ingreso', callback_data: 'trans_income_new' }, { text: '💵 Nuevo Pago Fijo', callback_data: 'trans_payment_new' }],
        [{ text: '🔄 Nueva Transferencia', callback_data: 'trans_transfer_new' }],
        [{ text: '📚 Ver y Seleccionar Libro', callback_data: 'books' }],
        [{ text: '📝 Preparar Presupuesto', callback_data: 'budget' }],
        [{ text: '📑 Resumen', callback_data: 'summary' }]
      ]
    }
  })
}