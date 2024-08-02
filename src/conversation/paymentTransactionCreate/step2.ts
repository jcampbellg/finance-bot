import { chunkIt } from '@array-utils/chunk-it'
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

      // Go to normal transaction flow
      await step1(params)
      return
    })
    return
  }

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data === 'payment_create') {
    await xprisma.conversation.update(conversation.id, {
      subSubject: 'payment_create'
    })
    await bot.editMessageText(`💵 Vamos a registrar una nuevo pago fijo en tu presupuesto.\n¿Cómo te gustaría llamarlo?`, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [endBtn]
      }
    })
    return
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
      type: 'payment'
    }

    // Go to normal transaction flow
    await step1(params, newEdit)
    return
  }
}