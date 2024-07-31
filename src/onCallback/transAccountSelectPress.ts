import { ConversationProps } from '@customTypes/messageTypes'
import noAccountAccessSend from '@onSend/noAccountAccessSend'
import xprisma from '@utils/xprisma'
import { chunkIt } from '@array-utils/chunk-it'
import menuBtn from '@buttons/menuBtn'
import noBookSelectedSend from '@onSend/noBookSelectedSend'

export async function transAccountSelectPress(params: ConversationProps, accountId: string) {
  const { query, bot, chatId, conversation, user, bookSelected } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  if (!bookSelected) {
    await noBookSelectedSend(params)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    edit: {
      ...conversation.edit,
      accountId: accountId
    }
  })

  const account = await xprisma.account.findUnique(user, accountId)
  if (!account) {
    await noAccountAccessSend(params)
    return
  }

  const currencies = account.currency.map((currency) => currency.symbol)
  const groupedcurrencies: string[][] = chunkIt(currencies).size(3)

  const prefix = query.data.startsWith('trans_new') ? 'trans_new' : 'trans_edit'

  await bot.sendMessage(chatId, `¡Gracias! ¿En qué moneda se realizará esta transacción?`, {
    reply_markup: {
      inline_keyboard: [
        ...groupedcurrencies.map((group) => group.map((currency) => ({
          text: currency,
          callback_data: `${prefix}_currency_${currency}`
        }))),
        menuBtn
      ]
    }
  })
  return
}