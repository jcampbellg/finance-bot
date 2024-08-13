import upsError from '@botMessage/errors/upsError'
import step1 from '@conversation/transactionCreate/step1'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import { Edit } from '@customTypes/prismaTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { query, ctx, conversation, user } = params

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