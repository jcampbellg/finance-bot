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
import { MAX_FILES, TRANSACTION_TYPE } from '@utils/constant'
import TelegramBot from 'node-telegram-bot-api'
import { $Enums } from '@prisma/client'

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
  const isIncome = t.type === 'INCOME'
  const isExpense = t.type === 'EXPENSE'
  const isNormal = t.type === 'EXPENSE' || t.type === 'DEPOSIT'

  const isTransfer = !!t.transferIn || !!t.transferOut

  const spanishDate = dayjs(isNormal ? t.paidAt : t.createdAt).tz(user.timezone).format('dddd LL hh:mma')
  const categoryLabel = isPayment ? 'Pago Fijo:' : 'Categoría:'
  const category = t.category ? t.category.description : 'Sin Categoría'

  const amount = numeral(t.amount).format('0,0.00') + ' ' + t.currency

  const paidAt = t.paidAt ? dayjs(t.paidAt).tz(user.timezone).format('dddd LL hh:mma') : 'SIN PAGAR'

  const isPaidLabel = (isPayment || isIncome) ? `\n<b>Fecha Pagada:</b> ${paidAt}` : ''

  const tags = t.tags.length > 0 ? `\n<b>Etiquetas:</b> ${t.tags.map(t => t).join(', ')}` : ''

  const transferBtn = isTransfer ? [[{ text: `${!!t.transferIn ? '🔴 Ver Origen' : '🟢 Ver Destino'}`, callback_data: `transaction_view_${t.transferIn?.transactionInId || t.transferOut?.transactionOutId}` }]] : []

  const splitBtns: TelegramBot.InlineKeyboardButton[][] = t.splits?.childrens.map(s => {
    return [{ text: `👉 Ver ${s.description}`, callback_data: `transaction_view_${s.id}` }]
  }) || []

  const parentBtn: TelegramBot.InlineKeyboardButton[][] = !!t.parentSplit ? [[{ text: `👈 Ver ${t.parentSplit.parent.description}`, callback_data: `transaction_view_${t.parentSplit.parent.id}` }]] : []

  const canAttachFiles = t.files.length < MAX_FILES

  const categoryTypeView: Record<$Enums.CategoryType, string> = {
    'INCOME': '🤑 Ver Ingreso',
    'CATEGORY': '🗂️ Ver Categoría',
    'PAYMENT': '💵 Ver Pago Fijo'
  }

  await bot.sendMessage(chatId, `Editando ${TRANSACTION_TYPE[t.type]}\n\n<b>Descripción:</b> ${t.description}\n<b>Monto:</b> ${amount}\n<b>Fecha:</b> ${spanishDate}\n<b>Cuenta:</b> ${t.account.description}\n<b>${categoryLabel}</b> ${category}${isPaidLabel}${tags}`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✏️ Renombrar', callback_data: `transaction_rename_${t.id}` }, { text: `❌ Eliminar`, callback_data: `transaction_delete_${t.id}` }],
        [{ text: `🗂️ Categoría`, callback_data: `transaction_category_${t.id}` }],
        [...((isNormal || isTransfer) ? [{ text: `🗂️ Categoría`, callback_data: `transaction_category_${t.id}` }, { text: '🏷️ Etiquetas', callback_data: `transaction_tag_${t.id}` }, ...(isExpense ? [{ text: '✂️ Dividir', callback_data: `transaction_split_${t.id}` }] : [])] : [])],
        [{ text: '💵 Cambiar Monto', callback_data: `transaction_amount_${t.id}` }, { text: '📅 Cambiar Fecha', callback_data: `transaction_date_${t.id}` }],
        ...((isPayment || isIncome) ? (!t.paidAt ? [[{ text: `✅ Marcar como Pagado`, callback_data: `transaction_paid_now_${t.id}` }]] : [[{ text: `❌ Marcar como No Pagado`, callback_data: `transaction_paid_cancel_${t.id}` }]]) : []),
        ...(((isPayment || isIncome) && t.paidAt) ? [[{ text: '📅 Cambiar Fecha de Pago', callback_data: `transaction_paid_date_${t.id}` }]] : []),
        [...(canAttachFiles ? [{ text: `📎 Adjuntar`, callback_data: `transaction_file_${t.id}` }] : []), ...(t.files.length > 0 ? [{ text: '📎 Ver Archivos', callback_data: `transaction_files_${t.id}` }] : [])],
        ...((!!t.category) ? [[{ text: `${categoryTypeView[t.category.type]}`, callback_data: `category_view_${t.categoryId}` }]] : []),
        ...parentBtn,
        ...splitBtns,
        ...transferBtn,
        menuBtn
      ]
    }
  })
}