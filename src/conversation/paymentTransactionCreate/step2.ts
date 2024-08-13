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
      const newPayment = await xprisma.payment.create(user, description)

      if (!newPayment) {
        upsError(params)
        return
      }

      await xprisma.conversation.update(conversation.id, {
        edit: {
          ...conversation.edit,
          categoryId: newPayment.id
        }
      })

      const newEdit: Edit = {
        categoryId: newPayment.id,
        type: 'PAYMENT'
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

  if (query.data.startsWith('payment_select_')) {
    const paymentId = query.data.replace('payment_select_', '')

    const payment = await xprisma.payment.findUnique(user, paymentId)

    if (!payment) {
      upsError(params)
      return
    }

    const newEdit: Edit = {
      categoryId: payment.id,
      type: 'PAYMENT'
    }

    // Go to normal transaction flow
    await step1(params, newEdit)
    return
  }
}