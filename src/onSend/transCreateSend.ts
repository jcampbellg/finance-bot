import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import noBookSelectedSend from '@onSend/noBookSelectedSend'
import upsSend from '@onSend/upsSend'

export default async function transCreateSend(params: ConversationProps) {
  const { bot, chatId, user, bookSelected, conversation } = params

  if (!bookSelected) {
    await noBookSelectedSend(params)
    return
  }

  if (!conversation.edit.accountId || !conversation.edit.currency || !conversation.edit.amount || !conversation.edit.description || !conversation.edit.type) {
    await bot.sendMessage(chatId, `¡Ups! Parece que no has completado la transacción.`, {
      reply_markup: {
        inline_keyboard: [
          menuBtn
        ]
      }
    })
    return
  }

  const newTransaction = await xprisma.transaction.create(user, {
    accountId: conversation.edit.accountId,
    currency: conversation.edit.currency,
    amount: conversation.edit.amount,
    description: conversation.edit.description,
    type: conversation.edit.type === 'deposit' ? 'INCOME' : 'EXPENSE'
  })

  if (!newTransaction) {
    await upsSend(params)
    return
  }

  await bot.sendMessage(chatId, `¡Perfecto!\nTu transacción ha sido creado.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `🧾 Ver Transacción`, callback_data: `trans_view_${newTransaction.id}` }],
        menuBtn
      ]
    }
  })
}