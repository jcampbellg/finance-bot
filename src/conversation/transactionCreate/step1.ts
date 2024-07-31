import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { conversation, chatId, bot, query } = params

  if (!query) {
    throw new Error('query is required')
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'transaction_create',
    subSubject: 'description',
    edit: {
      type: query.data === 'transaction_create_expense' ? 'expense' : 'deposit',
    }
  })

  await bot.sendMessage(chatId, `🧾 Vamos a crear una nueva transacción.\nPrimero, por favor proporciona una breve descripción de la transacción.`, {
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}