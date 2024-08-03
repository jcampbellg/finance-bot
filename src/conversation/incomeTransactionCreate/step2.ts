import upsError from '@botMessage/errors/upsError'
import endBtn from '@buttons/endBtn'
import step1 from '@conversation/transactionCreate/step1'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import { Edit } from '@customTypes/prismaTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { query, ctx, chatId, bot, conversation, user } = params

  if (!!ctx) {
    // Account description
    await stringReply(params, async (description) => {
      const newIncome = await xprisma.income.create(user, description)

      if (!newIncome) {
        upsError(params)
        return
      }

      await xprisma.conversation.update(conversation.id, {
        edit: {
          ...conversation.edit,
          categoryId: newIncome.id
        }
      })

      const newEdit: Edit = {
        categoryId: newIncome.id,
        type: 'INCOME'
      }

      // Go to normal transaction flow
      await step1(params, newEdit)
      return
    })
    return
  }

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data === 'income_create') {
    await xprisma.conversation.update(conversation.id, {
      subSubject: 'income_create'
    })
    await bot.editMessageText(`🤑 Vamos a registrar una nuevo ingreso en tu presupuesto.\n¿Cómo te gustaría llamarlo?`, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [endBtn]
      }
    })
    return
  }

  if (query.data.startsWith('income_select_')) {
    const incomeId = query.data.replace('income_select_', '')

    const income = await xprisma.income.findUnique(user, incomeId)

    if (!income) {
      upsError(params)
      return
    }

    const newEdit: Edit = {
      categoryId: income.id,
      type: 'INCOME'
    }

    // Go to normal transaction flow
    await step1(params, newEdit)
    return
  }
}