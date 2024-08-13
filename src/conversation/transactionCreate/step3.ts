import { chunkIt } from '@array-utils/chunk-it'
import upsError from '@botMessage/errors/upsError'
import endBtn from '@buttons/endBtn'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step3(params: ConversationPropsWithBookSelected) {
  const { query, ctx, chatId, bot, conversation, user } = params

  if (!!ctx) {
    // Account description
    await stringReply(params, async (description) => {
      const newAccount = await xprisma.account.create(user, description)

      if (!newAccount) {
        upsError(params)
        return
      }

      await xprisma.conversation.update(conversation.id, {
        subSubject: 'currency',
        edit: {
          ...conversation.edit,
          accountId: newAccount.id
        }
      })

      await bot.sendMessage(chatId, `¿En qué moneda se realizará esta transacción?\n\n<i>Escribe la moneda en 3 letras.</i>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [endBtn]
        }
      })
    })
    return
  }

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data.startsWith('account_select_')) {
    const accountId = query.data.replace('account_select_', '')

    const account = await xprisma.account.findUnique(user, accountId)

    if (!account) {
      upsError(params)
      return
    }

    await xprisma.conversation.update(conversation.id, {
      subSubject: 'currency',
      edit: {
        ...conversation.edit,
        accountId: account.id
      }
    })

    const currencies = account.currency.map((currency) => currency.symbol)
    const groupedcurrencies: string[][] = chunkIt(currencies).size(3)

    await bot.editMessageText(`¿En qué moneda se realizará esta transacción?\n\n<i>O escribe la moneda en 3 letras.</i>`, {
      chat_id: chatId,
      message_id: query.message.message_id,
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
    return
  }
}