import upsError from '@botMessage/errors/upsError'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import menuBtn from '@buttons/menuBtn'
import amountReply from '@conversation/utils/amountReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import dayjs from 'dayjs'

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

    const newDate = dayjs().tz(user.timezone)

    const newTransaction = await xprisma.transaction.create(user, {
      accountId: conversation.edit.accountId,
      currency: conversation.edit.currency,
      amount: amount,
      description: conversation.edit.description,
      categoryId: conversation.edit.categoryId || null,
      type: editType,
      paidAt: (editType === 'PAYMENT' || editType === 'INCOME') ? null : newDate.format()
    })

    if (!newTransaction) {
      await upsError(params)
      return
    }

    await transactionViewMenuMessage(params, newTransaction.id)
  })
}