import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function noSplitTransactionError(params: ConversationProps) {
  const { bot, conversation, chatId } = params

  await xprisma.conversation.waiting(conversation.id)

  await bot.sendMessage(chatId, `Solo se puede dividir transacciones de tipo gastos. 😕`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}