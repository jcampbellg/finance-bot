import { chunkIt } from '@array-utils/chunk-it'
import noAccountError from '@botMessage/errors/noAccountError'
import endBtn from '@buttons/endBtn'
import amountReply from '@conversation/utils/amountReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { conversation, user, ctx, bot, chatId } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const accountId = conversation.edit.accountId || ''

  const account = await xprisma.account.findUnique(user, accountId)

  if (!account) {
    await noAccountError(params)
    return
  }

  await amountReply(params, async (amount) => {
    await xprisma.conversation.update(conversation.id, {
      subject: 'account_balance',
      subSubject: 'currency',
      edit: {
        ...conversation.edit,
        amount
      }
    })

    const currencies = account.currency.map((currency) => currency.symbol)
    const groupedcurrencies: string[][] = chunkIt(currencies).size(3)

    await bot.sendMessage(chatId, `¿A qué moneda pertenece este monto?\n\n<i>O escribe la moneda en 3 letras.</i>`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          ...groupedcurrencies.map((group) => group.map((currency) => ({
            text: currency,
            callback_data: `${currency}`
          }))),
          endBtn
        ]
      }
    })
  })
}