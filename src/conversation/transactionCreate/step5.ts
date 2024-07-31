import upsError from '@botMessage/errors/upsError'
import menuBtn from '@buttons/menuBtn'
import amountReply from '@conversation/utils/amountReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step5(params: ConversationPropsWithBookSelected) {
  const { conversation, bot, chatId, user } = params

  await amountReply(params, async (amount) => {
    if (!conversation.edit.accountId || !conversation.edit.currency || !conversation.edit.description || !conversation.edit.type) {
      await bot.sendMessage(chatId, `¡Ups! Parece que no has completado la transacción.`, {
        reply_markup: {
          inline_keyboard: [menuBtn]
        }
      })
      return
    }

    const newTransaction = await xprisma.transaction.create(user, {
      accountId: conversation.edit.accountId,
      currency: conversation.edit.currency,
      amount: amount,
      description: conversation.edit.description,
      type: conversation.edit.type === 'expense' ? 'EXPENSE' : 'INCOME'
    })

    if (!newTransaction) {
      await upsError(params)
      return
    }

    await xprisma.currency.create(user, conversation.edit.accountId, conversation.edit.currency)

    await bot.sendMessage(chatId, `¡Perfecto!\nTu transacción ha sido creada.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `🧾 Ver Transacción`, callback_data: `transaction_view_${newTransaction.id}` }],
          menuBtn
        ]
      }
    })
  })
}