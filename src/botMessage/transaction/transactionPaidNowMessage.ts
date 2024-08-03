import noTransactionError from '@botMessage/errors/noTransactionError'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { botTransaction } from './transactionViewMenuMessage'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function transactionPaidNowMessage(params: ConversationPropsWithBookSelected, transactionIdImport?: string) {
  const { query, user } = params

  await xprisma.conversation.waiting(params.conversation.id)

  const transactionId = transactionIdImport || query?.data.replace('transaction_paid_now_', '')

  if (!transactionId) {
    await noTransactionError(params)
    return
  }

  const newDate = dayjs().tz(user.timezone)

  const transaction = await xprisma.transaction.update(user, transactionId, {
    paidAt: newDate.format()
  })

  if (!transaction) {
    await noTransactionError(params)
    return
  }

  await botTransaction(params, transaction)
  return
}