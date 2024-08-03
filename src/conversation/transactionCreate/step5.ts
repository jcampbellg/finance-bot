import upsError from '@botMessage/errors/upsError'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
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

    const editType = conversation.edit.type

    const newTransaction = await xprisma.transaction.create(user, {
      accountId: conversation.edit.accountId,
      currency: conversation.edit.currency,
      amount: amount,
      description: conversation.edit.description,
      categoryId: conversation.edit.categoryId || null,
      type: editType
    })

    if (!newTransaction) {
      await upsError(params)
      return
    }

    // Update the balance
    if (newTransaction.type === 'EXPENSE' || newTransaction.type === 'DEPOSIT') {
      const currency = await xprisma.currency.findOrCreate(user, conversation.edit.accountId, conversation.edit.currency)
      if (currency) {
        await xprisma.balance.sum(user, currency.id, newTransaction.id)
      }
    }

    await transactionViewMenuMessage(params, newTransaction.id)
  })
}