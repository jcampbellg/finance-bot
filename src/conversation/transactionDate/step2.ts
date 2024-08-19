import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import dateReply from '@conversation/utils/dateReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import transactionGroupNotificationMessage from '@botMessage/transaction/transactionGroupNotificationMessage'
import upsError from '@botMessage/errors/upsError'
import noTransactionError from '@botMessage/errors/noTransactionError'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  await dateReply(params, async (newDateInput) => {
    const transactionId = conversation.edit.transactionId

    if (!transactionId) {
      await noTransactionError(params)
      return
    }

    const newDate = dayjs.tz(newDateInput, user.timezone)

    const success = await xprisma.transaction.update(user, transactionId, {
      [conversation.subject === 'transaction_paid_date' ? 'paidAt' : 'createdAt']: newDate.format()
    })

    if (!success) {
      await upsError(params)
      return
    }

    await transactionGroupNotificationMessage(params, success)
    await transactionViewMenuMessage(params, transactionId)
  })
}