import { ConversationProps, TelegramOptions } from '@customTypes/messageTypes'
import { endButtons, onConversationEnd } from './mainMenu'
import xprisma from '@utils/xprisma'

export async function onBudgetBegin(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  if (!user.canPrepareBudget || !user.bookSelected) {
    await bot.sendMessage(userId, 'No tienes permisos para preparar un presupuesto. 😕')
    await onConversationEnd(params)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'budget',
    subSubject: '',
    edit: {}
  })
  const [botText, botOptions] = await budgetFormat(params)

  await bot.editMessageText(botText, {
    chat_id: userId,
    message_id: query.message.message_id,
    ...botOptions
  })
  return
}

export async function budgetFormat({ firstName, user }: ConversationProps): Promise<[string, TelegramOptions]> {
  if (!user.bookSelected) {
    throw new Error('No book selected')
  }

  return [
    `¡Hola ${firstName}! 👋\n\n📝 Vamos a preparar tu presupuesto.\n¿En qué puedo ayudarte?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏛️ Ver Cuentas', callback_data: 'accounts' }],
          [{ text: '🗂️ Ver Categorias', callback_data: 'categories' }],
          [{ text: '🤑 Ver Ingresos', callback_data: 'incomes' }],
          [{ text: '💸 Ver Gastos Fijos', callback_data: 'payments' }],
          [{ text: '💱 Ver Intercambios de Moneda', callback_data: 'exchange' }],
          ...endButtons('menu')
        ]
      }
    }
  ]
}