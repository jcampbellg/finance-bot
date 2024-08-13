import accountsListMessage from '@botMessage/account/accountsListMessage'
import categoriesListMessage from '@botMessage/category/categoriesListMessage'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function budgetListMenuMessage(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const btnPress = query.data

  await xprisma.conversation.waiting(conversation.id)

  if (btnPress === 'accounts_menu') {
    await accountsListMessage(params, {
      btn: 'budget',
      callbackCreate: 'budget_create_account',
      callbackPrefix: 'account_view_',
      text: '🏦 Cuentas'
    })
    return
  }

  if (btnPress === 'incomes_menu') {
    await categoriesListMessage(params, {
      btn: 'budget',
      callbackCreate: 'budget_create_income',
      callbackPrefix: 'income_view_',
      text: '🤑 Ingresos',
      type: 'INCOME'
    })
    return
  }

  if (btnPress === 'categories_menu') {
    await categoriesListMessage(params, {
      btn: 'budget',
      callbackCreate: 'budget_create_category',
      callbackPrefix: 'category_view_',
      text: '🗂️ Categorias',
      type: 'CATEGORY'
    })
    return
  }

  if (btnPress === 'payments_menu') {
    await categoriesListMessage(params, {
      btn: 'budget',
      callbackCreate: 'budget_create_payment',
      callbackPrefix: 'payment_view_',
      text: '💵 Pagos Fijos',
      type: 'PAYMENT'
    })
    return
  }
}