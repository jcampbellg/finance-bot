import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import parseEmoji from '@utils/parseEmoji'
import sendPDF from '@utils/sendPDF'
import xprisma from '@utils/xprisma'
import numeral from 'numeral'
import { TDocumentDefinitions } from 'pdfmake/interfaces'

export default async function pdfPayments(params: ConversationPropsWithBookSelected) {
  const { bookSelected, query, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const currencies = await xprisma.account.currencies(user)
  const symbols = currencies.map(a => a.symbol).filter((value, index, self) => self.indexOf(value) === index)

  const empty = symbols.map(() => ({}))
  const widthsAuto = symbols.map(() => 'auto')
  const widthsExpand = symbols.map(() => '*')

  const payments = await xprisma.category.findManyByType(user, 'PAYMENT')

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    content: [
      {
        marginBottom: 10,
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 2,
          widths: ['auto', ...widthsExpand],
          body: [
            [
              { text: 'Pagos Fijos', bold: true, colSpan: symbols.length + 1, alignment: 'center' },
              ...empty
            ],
            [
              { text: 'Descripción', bold: true, alignment: 'left', fillColor: '#d3d3d3' },
              ...symbols.map(s => ({ text: s, alignment: 'left', fillColor: '#d3d3d3' }))
            ],
            ...(await Promise.all(payments.map(async (p) => {
              const description = await parseEmoji(p.description)
              const trans: Record<string, number> = p.transactions.reduce((acc: Record<string, number>, t) => {
                const symbol = t.currency
                const amount = t.amount

                if (!acc[symbol]) {
                  acc[symbol] = 0
                }
                acc[symbol] += amount
                return acc
              }, {})

              return [description,
                ...symbols.map(s => ({ text: numeral(trans[s] || 0).format('0,0.00') }))
              ]
            })))
          ]
        }
      }
    ]
  }

  await sendPDF('Test', params, docDefinition)
}