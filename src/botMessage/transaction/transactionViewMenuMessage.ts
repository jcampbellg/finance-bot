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
import { TRANSACTION_TYPE } from '@utils/constant'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function transactionViewMenuMessage(params: ConversationPropsWithBookSelected, transactionIdImport?: string) {
  const { query, user } = params

  await xprisma.conversation.waiting(params.conversation.id)

  const transactionId = transactionIdImport || query?.data.replace('transaction_view_', '')

  if (!transactionId) {
    await noTransactionError(params)
    return
  }

  const transaction = await xprisma.transaction.findUnique(user, transactionId)

  if (!transaction) {
    await noTransactionError(params)
    return
  }

  await botTransaction(params, transaction)
}

export async function botTransaction(params: ConversationPropsWithBookSelected, t: TransactionWithAll) {
  const { bot, user, chatId } = params

  const isPayment = t.type === 'PAYMENT'
  const isNormal = t.type === 'EXPENSE' || t.type === 'DEPOSIT'
  const isIncome = t.type === 'INCOME'

  const spanishDate = dayjs(t.createdAt).tz(user.timezone).format('LL hh:mma')
  const categoryLabel = isPayment ? 'Pago Fijo:' : 'Categoría:'
  const category = t.category ? t.category.description : 'Sin Categoría'

  const amount = numeral(t.amount).format('0,0.00') + ' ' + t.currency + `[${TRANSACTION_TYPE[t.type]}]`

  const paidAt = t.paidAt ? dayjs(t.paidAt).tz(user.timezone).format('LL hh:mma') : 'SIN PAGAR'

  const isPaidLabel = (isPayment || isIncome) ? `\n<b>Fecha Pagada:</b> ${paidAt}` : ''

  const files = t.files

  for (let i = 0; i < files.length; i++) {
    const file = files[i]

    const keyboard = [[{ text: '❌ Borrar', callback_data: `file_delete_${file.id}` }]]
    const caption = t.description

    if (file.fileType === 'PHOTO') {
      await bot.sendPhoto(chatId, file.fileId, {
        caption,
        reply_markup: {
          inline_keyboard: keyboard
        }
      })
    } else {
      await bot.sendDocument(chatId, file.fileId, {
        caption,
        reply_markup: {
          inline_keyboard: keyboard
        }
      })
    }
  }

  await bot.sendMessage(chatId, `Editando Transacción\n\n<b>Descripción:</b> ${t.description}\n<b>Monto:</b> ${amount}\n<b>Fecha:</b> ${spanishDate}\n<b>Cuenta:</b> ${t.account.description}\n<b>${categoryLabel}</b> ${category}${isPaidLabel}`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✏️ Renombrar', callback_data: `transaction_rename_${t.id}` }, { text: `❌ Eliminar`, callback_data: `transaction_delete_${t.id}` }],
        [...(isNormal ? [{ text: `🏷️ Categoría`, callback_data: `transaction_category_${t.id}` }] : []), { text: '✂️ Dividir', callback_data: `transaction_split_${t.id}` }],
        [{ text: '📅 Cambiar Fecha', callback_data: `transaction_date_${t.id}` }],
        ...((isPayment || isIncome) ? (!t.paidAt ? [[{ text: `✅ Marcar como Pagado`, callback_data: `transaction_paid_now_${t.id}` }]] : [[{ text: `❌ Marcar como No Pagado`, callback_data: `transaction_paid_cancel_${t.id}` }]]) : []),
        ...(((isPayment || isIncome) && t.paidAt) ? [[{ text: '📅 Cambiar Fecha de Pago', callback_data: `transaction_paid_date_${t.id}` }]] : []),
        [{ text: '💵 Cambiar Monto', callback_data: `transaction_amount_${t.id}` }, { text: `📎 Adjuntar${t.files.length > 0 ? ' otra' : ''}`, callback_data: `transaction_file_${t.id}` }],
        menuBtn
      ]
    }
  })
}