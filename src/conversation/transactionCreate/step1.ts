import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import { transactionType } from '@customTypes/prismaTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { conversation, chatId, bot, query } = params

  let type: transactionType = 'expense'

  if (conversation.edit?.type) type = conversation.edit.type

  if (query?.data === 'transaction_create_expense') type = 'expense'
  if (query?.data === 'transaction_create_deposit') type = 'income'

  await xprisma.conversation.update(conversation.id, {
    subject: 'transaction_create',
    subSubject: 'description',
    edit: {
      type: type
    }
  })

  const botText = `🧾 Vamos a crear una nueva transacción.\nPrimero, por favor proporciona una breve descripción de la transacción.`

  if (query) {
    await bot.editMessageText(botText, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [endBtn]
      }
    })
    return
  }

  await bot.sendMessage(chatId, botText, {
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}