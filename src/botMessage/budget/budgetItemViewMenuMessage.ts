import noAccountError from '@botMessage/errors/noAccountError'
import noCategoryError from '@botMessage/errors/noCategoryError'
import menuBtn from '@buttons/menuBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import numeral from 'numeral'

type SelectProps = {
  isAccount: boolean
  itemId: string
}

export default async function budgetItemViewMenuMessage(params: ConversationPropsWithBookSelected, select?: SelectProps) {
  const { query, user, bot, chatId } = params

  if (!query && !select) {
    throw new Error('query is required')
  }

  const isAccount = query?.data.startsWith('account_view_') || select?.isAccount

  if (isAccount) {
    await accountViewMenuMessage(params, select)
    return
  }

  const itemId = select?.itemId || query?.data.replace('category_view_', '') || ''

  const item = await xprisma.category.findUniqueById(user, itemId)

  if (!item) {
    await noCategoryError(params)
    return
  }

  const limits = item.limits.map(l => `${numeral(l.amount).format('0,0.00')} ${l.currency}`).join('\n')
  const limitsText = limits.length ? `\n\n<b>Límites:</b>\n${limits}` : ''

  const type = item.type

  const title = type === 'INCOME' ? '🤑 Editando Ingreso' : type === 'PAYMENT' ? '💵 Editando Pago Fijo' : '🗂️ Editando Categoria'
  const menu = type === 'INCOME' ? 'incomes_menu' : type === 'PAYMENT' ? 'payments_menu' : 'categories_menu'
  const look = type === 'INCOME' ? 'Ingresos' : type === 'PAYMENT' ? 'Pagos Fijos' : 'Categorías'

  const botText = `${title}\n\n<b>Descripción:</b> ${item.description}${limitsText}`
  const buttons = [
    [{ text: '✏️ Renombrar', callback_data: `category_rename_${item.id}` }, { text: `❌ Eliminar`, callback_data: `category_delete_${item.id}` }],
    [{ text: '⚠️ Editar Límite', callback_data: `category_limit_${item.id}` }],
    [{ text: `🔎 Ver ${look}`, callback_data: menu }, { text: `📑 Ver Transacciones`, callback_data: `search_category_${item.id}` }],
    menuBtn
  ]

  if (!!query) {
    await bot.editMessageText(botText, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons
      }
    })
    return
  }

  await bot.sendMessage(chatId, botText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: buttons
    }
  })
}

async function accountViewMenuMessage(params: ConversationPropsWithBookSelected, select?: SelectProps) {
  const { query, user, bot, chatId } = params

  const accountId = select?.itemId || query?.data.replace('account_view_', '') || ''
  const account = await xprisma.account.findUnique(user, accountId)

  if (!account) {
    await noAccountError(params)
    return
  }

  const currencies = `<b>Monedas:</b> ` + !account.currency.length ? account.currency.map(c => `${c.symbol}`).join(', ') : 'La cuenta no tiene monedas'

  const currenciesBtns = account.currency.map(c => [{ text: `${c.symbol}`, callback_data: `account_currency_${account.id}_${c.id}` }])

  const botText = `🏦 Editando Cuenta\n\n<b>Descripción:</b> ${account.description}\n${currencies}`
  const buttons = [
    [{ text: '✏️ Renombrar', callback_data: `account_rename_${account.id}` }, { text: `❌ Eliminar`, callback_data: `account_delete_${account.id}` }],
    [{ text: '💲 Crear Moneda', callback_data: `account_currency_create_${account.id}` }],
    ...currenciesBtns,
    [{ text: '🔎 Ver Cuentas', callback_data: 'accounts_menu' }, { text: `📑 Ver Transacciones`, callback_data: `search_account_${account.id}` }],
    menuBtn
  ]

  if (!!query) {
    await bot.editMessageText(botText, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons
      }
    })
    return
  }

  await bot.sendMessage(chatId, botText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: buttons
    }
  })
}