import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { query, conversation, bot, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  // account, income, category or payment
  const btnPress = query.data.replace('budget_create_', '')

  xprisma.conversation.update(conversation.id, {
    subject: 'budget_create',
    subSubject: btnPress
  })

  const botText: Record<string, string> = {
    'account': '🏦 Vamos a crear una nueva cuenta.',
    'income': '🤑 Vamos a crear un nuevo ingreso.',
    'category': '🗂️ Vamos a crear una nueva categoría.',
    'payment': '💵 Vamos a crear un nuevo pago fijo.'
  }

  await bot.editMessageText(`${botText[btnPress]}\n¿Cómo te gustaría llamarlo?`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}