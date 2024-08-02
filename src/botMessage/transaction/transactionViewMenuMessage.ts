import noTransactionError from '@botMessage/errors/noTransactionError'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { TransactionWithAll } from '@customTypes/prismaTypes'
import menuBtn from '@buttons/menuBtn'
import numeral from 'numeral'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function transactionViewMenuMessage(params: ConversationPropsWithBookSelected) {
  const { query, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const transactionId = query.data.replace('transaction_view_', '').replace('_paid_now', '').replace('_paid_not', '')

  if (!transactionId) {
    await noTransactionError(params)
    return
  }

  const isPaidNow = query.data.endsWith('_paid_now')
  const isPaidCancel = query.data.endsWith('_paid_not')

  if (isPaidNow) {
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

  if (isPaidCancel) {
    const transaction = await xprisma.transaction.update(user, transactionId, {
      paidAt: null
    })
    if (!transaction) {
      await noTransactionError(params)
      return
    }

    await botTransaction(params, transaction)
    return
  }

  const transaction = await xprisma.transaction.findUnique(user, transactionId)

  if (!transaction) {
    await noTransactionError(params)
    return
  }

  await botTransaction(params, transaction)
}

async function botTransaction(params: ConversationPropsWithBookSelected, t: TransactionWithAll) {
  const { bot, user, chatId } = params

  const spanishDate = dayjs(t.createdAt).tz(user.timezone).format('LL hh:mma')
  const categoryLabel = t.isPayment ? 'Pago Fijo:' : 'Categoría:'
  const category = t.category ? t.category.description : 'Sin Categoría'
  const amount = numeral(t.amount).format('0,0.00') + ' ' + t.currency + (t.type === 'INCOME' ? ' (Ingreso)' : '')

  const paidAt = t.paidAt ? dayjs(t.paidAt).tz(user.timezone).format('LL hh:mma') : 'SIN PAGAR'

  const isPaidLabel = !t.isPayment ? '' : `\n<b>Fecha Pagada:</b> ${paidAt}`

  await bot.sendMessage(chatId, `Editando Transacción\n\n<b>Descripción:</b> ${t.description}\n<b>Monto:</b> ${amount}\n<b>Fecha:</b> ${spanishDate}\n<b>Cuenta:</b> ${t.account.description}\n<b>${categoryLabel}</b> ${category}${isPaidLabel}`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✏️ Renombrar', callback_data: `transaction_rename_${t.id}` }, { text: `❌ Eliminar`, callback_data: `transaction_delete_${t.id}` }],
        [{ text: '🏦 Cambiar Cuenta', callback_data: `transaction_account_${t.id}` }, { text: '💵 Cambiar Monto', callback_data: `transaction_amount_${t.id}` }],
        ...(!t.isPayment ? [[{ text: `🏷️ Categoría`, callback_data: `transaction_category_${t.id}_paid_now` }]] : []),
        [{ text: '📅 Cambiar Fecha', callback_data: `transaction_date_${t.id}` }],
        ...((t.isPayment && !t.paidAt) ? [[{ text: `✅ Marcar como Pagado`, callback_data: `transaction_view_${t.id}_paid_now` }]] : [[{ text: `❌ Marcar como No Pagado`, callback_data: `transaction_view_${t.id}_paid_not` }]]),
        ...((t.isPayment && t.paidAt) ? [[{ text: '📅 Cambiar Fecha de Pago', callback_data: `transaction_date_${t.id}_paid` }]] : []),
        menuBtn
      ]
    }
  })
}