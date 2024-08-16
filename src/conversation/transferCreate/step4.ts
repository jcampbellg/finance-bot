import amountReply from '@conversation/utils/amountReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import step1 from './step1'
import upsError from '@botMessage/errors/upsError'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import menuBtn from '@buttons/menuBtn'
import { Edit } from '@customTypes/prismaTypes'
import transactionGroupNotificationMessage from '@botMessage/transaction/transactionGroupNotificationMessage'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function step4(params: ConversationPropsWithBookSelected, sameData: boolean = false) {
  const { conversation } = params

  const edit = conversation.edit

  if (sameData) {
    await createTransfer(params, {
      ...edit,
      currencyB: edit.currencyA,
      amountB: edit.amountA
    })
    return
  }

  await amountReply(params, async (amount) => {
    if (conversation.subSubject === 'amount-a') {
      await xprisma.conversation.update(conversation.id, {
        edit: {
          ...conversation.edit,
          amountA: amount
        }
      })

      step1(params, true)
      return
    }

    if (conversation.subSubject === 'amount-b') {
      await createTransfer(params, {
        ...edit,
        amountB: amount
      })
    }
  })
}

async function createTransfer(params: ConversationPropsWithBookSelected, edit: Edit) {
  const { user, bot, chatId } = params

  if (!edit.accountAId || !edit.accountBId || !edit.currencyA || !edit.currencyB || !edit.amountA || !edit.amountB) {
    await upsError(params)
    return
  }

  const newDate = dayjs().tz(user.timezone)

  const accountA = await xprisma.account.findUnique(user, edit.accountAId)

  if (!accountA) {
    await upsError(params)
    return
  }

  const accountB = await xprisma.account.findUnique(user, edit.accountBId)

  if (!accountB) {
    await upsError(params)
    return
  }

  const transferA = await xprisma.transaction.create(user, {
    amount: edit.amountA,
    currency: edit.currencyA,
    description: `${accountA.description} -> ${accountB.description}`,
    type: 'TRANSFER_OUT',
    accountId: edit.accountAId,
    paidAt: newDate.format()
  })

  if (!transferA) {
    await upsError(params)
    return
  }

  await transactionGroupNotificationMessage(params, transferA)

  const transferB = await xprisma.transaction.create(user, {
    amount: edit.amountB,
    currency: edit.currencyB,
    description: `${accountA.description} -> ${accountB.description}`,
    type: 'TRANSFER_IN',
    accountId: edit.accountBId,
    paidAt: newDate.format(),
    transferIn: {
      create: {
        transactionInId: transferA.id
      }
    }
  })

  if (!transferB) {
    await upsError(params)
    return
  }

  await transactionGroupNotificationMessage(params, transferB)
  await bot.sendMessage(chatId, `Transferencia realizada con éxito.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔴 Ver Transferencia Destino', callback_data: `transaction_view_${transferA.id}` }],
        [{ text: '🟢 Ver Transferencia Origen', callback_data: `transaction_view_${transferB.id}` }],
        menuBtn
      ]
    }
  })
}