import {useEffect, useMemo, useState} from 'react'
import type {ChangeEvent} from 'react'
import './App.css'
import {useProducts} from './hooks/useProduct'
import {submitOrder} from './services/inventory'
import type {Product, Row} from './types'

type FlavorSelection = {
  id: string
  rowKey: string
  quantity: number
}

type ProductSelection = {
  id: string
  productId: string
  flavors: FlavorSelection[]
}

type SelectionDetail = {
  id: string
  product: Product
  flavors: Array<{id: string; row: Row; quantity: number}>
}

type FeedbackMessage = {type: 'success' | 'error' | 'info'; message: string} | null

const steps = ['Cliente', 'Produtos', 'Revisão'] as const

const createInternalId = () => Math.random().toString(36).slice(2, 9)

const createTimestampId = () => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}${hh}${min}${ss}`
}

const createEmptySelection = (): ProductSelection => ({
  id: createInternalId(),
  productId: '',
  flavors: [],
})

const createEmptyFlavor = (): FlavorSelection => ({
  id: createInternalId(),
  rowKey: '',
  quantity: 1,
})

const buildMessage = (orderId: string, clientName: string, details: SelectionDetail[]) => {
  const safeName = clientName.trim() || '—'
  const lines: string[] = []

  lines.push(`NUMERO DO PEDIDO: ${orderId}`)
  lines.push('')
  lines.push(`NOME DO CLIENTE: ${safeName}`)
  lines.push('')
  lines.push('PEDIDO:')

  details.forEach((detail, index) => {
    lines.push(detail.product.name)
    detail.flavors.forEach((flavor) => {
      lines.push(`${flavor.quantity} ${flavor.row.flavor}`)
    })
    if (index < details.length - 1) lines.push('')
  })

  return lines.join('\n')
}

async function copyToClipboard(value: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch (error) {
    console.error('navigator.clipboard.writeText failed', error)
  }

  if (typeof document === 'undefined') return false

  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'absolute'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const result = document.execCommand('copy')
    document.body.removeChild(textarea)
    return result
  } catch (error) {
    console.error('fallback copy failed', error)
    return false
  }
}

export default function App() {
  const {data: products, loading, error, refetch} = useProducts()
  const [clientName, setClientName] = useState('')
  const [selections, setSelections] = useState<ProductSelection[]>(() => [createEmptySelection()])
  const [currentStep, setCurrentStep] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackMessage>(null)
  const [processing, setProcessing] = useState(false)

  const selectionDetails = useMemo<SelectionDetail[]>(() => {
    return selections
      .map((selection) => {
        const product = products.find((item) => item._id === selection.productId)
        if (!product) return null

        const flavors = selection.flavors
          .map((flavor) => {
            if (!flavor.rowKey) return null
            const row = product.rows.find((item) => item._key === flavor.rowKey)
            if (!row) return null
            const qty = Number.isFinite(flavor.quantity) ? Math.max(1, flavor.quantity) : 1
            return {id: flavor.id, row, quantity: qty}
          })
          .filter((item): item is {id: string; row: Row; quantity: number} => item !== null)

        if (flavors.length === 0) return null

        return {
          id: selection.id,
          product,
          flavors,
        }
      })
      .filter((item): item is SelectionDetail => item !== null)
  }, [products, selections])

  const messagePreview = useMemo(
    () => buildMessage('Será gerado ao enviar', clientName || '—', selectionDetails),
    [clientName, selectionDetails],
  )

  const hasClientName = clientName.trim().length > 0
  const hasValidSelection = selectionDetails.length > 0

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const updateSelection = (
    selectionId: string,
    updater: (selection: ProductSelection) => ProductSelection,
  ) => {
    setSelections((prev) => prev.map((selection) => (selection.id === selectionId ? updater(selection) : selection)))
  }

  const handleClientNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setClientName(event.target.value)
  }

  const handleProductChange = (selectionId: string, productId: string) => {
    updateSelection(selectionId, (selection) => {
      if (!productId) {
        return {
          ...selection,
          productId: '',
          flavors: [],
        }
      }

      const sameProduct = selection.productId === productId
      return {
        ...selection,
        productId,
        flavors: sameProduct ? selection.flavors : [],
      }
    })
  }

  const handleAddProduct = () => {
    setSelections((prev) => [...prev, createEmptySelection()])
  }

  const handleRemoveProduct = (selectionId: string) => {
    setSelections((prev) => {
      if (prev.length === 1) return prev
      return prev.filter((selection) => selection.id !== selectionId)
    })
  }

  const clampQuantity = (value: number, product: Product | null, rowKey: string) => {
    const base = Math.max(1, Math.floor(Number.isFinite(value) ? value : 1))
    if (!product) return base
    const row = product.rows.find((item) => item._key === rowKey)
    const stock = typeof row?.stock === 'number' && Number.isFinite(row.stock) ? row.stock : null
    if (stock === null) return base
    return Math.max(1, Math.min(base, stock))
  }

  const handleAddFlavor = (selectionId: string) => {
    updateSelection(selectionId, (selection) => ({
      ...selection,
      flavors: [...selection.flavors, createEmptyFlavor()],
    }))
  }

  const handleFlavorRowChange = (
    selectionId: string,
    flavorId: string,
    rowKey: string,
    product: Product | null,
  ) => {
    updateSelection(selectionId, (selection) => ({
      ...selection,
      flavors: selection.flavors.map((flavor) => {
        if (flavor.id !== flavorId) return flavor
        const quantity = clampQuantity(flavor.quantity, product, rowKey)
        return {...flavor, rowKey, quantity}
      }),
    }))
  }

  const handleFlavorQuantityChange = (
    selectionId: string,
    flavorId: string,
    quantity: number,
    product: Product | null,
  ) => {
    updateSelection(selectionId, (selection) => ({
      ...selection,
      flavors: selection.flavors.map((flavor) => {
        if (flavor.id !== flavorId) return flavor
        const next = clampQuantity(quantity, product, flavor.rowKey)
        return {...flavor, quantity: next}
      }),
    }))
  }

  const handleRemoveFlavor = (selectionId: string, flavorId: string) => {
    updateSelection(selectionId, (selection) => ({
      ...selection,
      flavors: selection.flavors.filter((flavor) => flavor.id !== flavorId),
    }))
  }

  const resetForm = () => {
    setClientName('')
    setSelections([createEmptySelection()])
    setCurrentStep(0)
  }

  const handleBack = () => {
    if (currentStep === 0) return
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }

  const handleNext = () => {
    if (currentStep === steps.length - 1) return
    if (currentStep === 0 && !hasClientName) {
      setFeedback({type: 'error', message: 'Informe o nome do cliente para continuar.'})
      return
    }
    if (currentStep === 1 && !hasValidSelection) {
      setFeedback({
        type: 'error',
        message: 'Adicione pelo menos um produto com sabor e quantidade para avançar.',
      })
      return
    }
    setCurrentStep((prev) => prev + 1)
  }

  const handleFinalize = async (action: 'copy' | 'whatsapp') => {
    if (processing) return

    if (!hasClientName) {
      setCurrentStep(0)
      setFeedback({type: 'error', message: 'Informe o nome do cliente antes de enviar o pedido.'})
      return
    }

    if (!hasValidSelection) {
      setCurrentStep(1)
      setFeedback({type: 'error', message: 'Selecione ao menos um produto com sabor e quantidade.'})
      return
    }

    const orderId = createTimestampId()
    const message = buildMessage(orderId, clientName, selectionDetails)
    const copied = await copyToClipboard(message)

    if (!copied) {
      setFeedback({
        type: 'error',
        message: 'Não foi possível copiar automaticamente a mensagem. Copie manualmente na pré-visualização.',
      })
      return
    }

    setProcessing(true)
    try {
      for (const detail of selectionDetails) {
        for (const flavor of detail.flavors) {
          try {
            await submitOrder({
              productId: detail.product._id,
              rowKey: flavor.row._key,
              quantity: flavor.quantity,
            })
          } catch (error) {
            throw {type: 'submit-order', error, detail, flavor}
          }
        }
      }

      try {
        await refetch({silent: true})
      } catch (refreshError) {
        console.error('refetch after submit failed', refreshError)
      }

      if (action === 'whatsapp' && typeof window !== 'undefined') {
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
      }

      setFeedback({
        type: 'success',
        message: `Pedido ${orderId} registrado e copiado com sucesso.`,
      })
      resetForm()
    } catch (caught: any) {
      if (caught?.type === 'submit-order') {
        const {error: err, detail, flavor} = caught
        const baseMessage =
          typeof err?.message === 'string'
            ? err.message
            : 'Falha ao atualizar o estoque. Tente novamente.'
        const status = Number(err?.status) || Number(err?.statusCode) || 0
        const currentStockFromServer = Number(err?.details?.currentStock)

        if (status === 404 || status === 405) {
          setFeedback({
            type: 'error',
            message:
              'Não foi possível acessar a função de atualização de estoque. Verifique a configuração de VITE_FUNCTIONS_BASE_URL (consulte docs/RESOLVENDO-ERRO-405.md).',
          })
        } else {
          let messageDetail = `Não foi possível atualizar o estoque de ${detail.product.name} · ${flavor.row.flavor}. ${baseMessage}`
          if (Number.isFinite(currentStockFromServer)) {
            const safeStock = Math.max(0, currentStockFromServer)
            messageDetail += ` Estoque atual: ${safeStock}.`
            setSelections((prev) =>
              prev.map((selection) => {
                if (selection.id !== detail.id) return selection
                return {
                  ...selection,
                  flavors: selection.flavors.map((item) => {
                    if (item.id !== flavor.id) return item
                    return {
                      ...item,
                      quantity: safeStock > 0 ? Math.min(item.quantity, safeStock) : 1,
                    }
                  }),
                }
              }),
            )
          }
          setFeedback({type: 'error', message: messageDetail})
        }

        try {
          await refetch({silent: true})
        } catch (refreshError) {
          console.error('refetch after error failed', refreshError)
        }

        setCurrentStep(1)
      } else {
        const baseMessage =
          typeof caught?.message === 'string'
            ? caught.message
            : 'Falha inesperada ao registrar o pedido. Tente novamente.'
        setFeedback({type: 'error', message: baseMessage})
      }
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <p className="status">Carregando…</p>
  if (error) return <p className="status error">Erro: {error}</p>

  return (
    <main className="app">
      <section className="form-card">
        <header className="form-card__header">
          <h1>Cadastro de pedido</h1>
          <p>Preencha as etapas para gerar e enviar o pedido pelo WhatsApp.</p>
        </header>

        <nav className="stepper" aria-label="Etapas do formulário">
          {steps.map((label, index) => {
            const status =
              index === currentStep ? 'stepper__item--active' : index < currentStep ? 'stepper__item--done' : ''
            return (
              <button
                key={label}
                type="button"
                className={`stepper__item ${status}`}
                onClick={() => {
                  if (index > currentStep) return
                  setCurrentStep(index)
                }}
                aria-current={index === currentStep ? 'step' : undefined}
                disabled={index > currentStep || processing}
              >
                <span className="stepper__index">{index + 1}</span>
                <span className="stepper__label">{label}</span>
              </button>
            )
          })}
        </nav>

        {feedback && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

        <div className="step-content">
          {currentStep === 0 && (
            <div className="step-panel">
              <label className="field">
                <span>Nome do cliente</span>
                <input
                  type="text"
                  placeholder="Digite o nome do cliente"
                  value={clientName}
                  onChange={handleClientNameChange}
                />
              </label>
              <p className="step-hint">Clique em “Avançar” para selecionar os produtos do pedido.</p>
            </div>
          )}

          {currentStep === 1 && (
            <div className="step-panel">
              <p className="step-description">
                Escolha o produto, adicione quantos sabores forem necessários e ajuste a quantidade de cada um.
              </p>

              <div className="products-list">
                {selections.map((selection) => {
                  const product = products.find((item) => item._id === selection.productId) ?? null
                  const availableRows = product?.rows ?? []

                  return (
                    <article key={selection.id} className="product-block">
                      <div className="product-block__header">
                        <label className="field">
                          <span>Produto</span>
                          <select
                            value={selection.productId}
                            onChange={(event) => handleProductChange(selection.id, event.target.value)}
                          >
                            <option value="">Selecione…</option>
                            {products.map((item) => (
                              <option key={item._id} value={item._id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleRemoveProduct(selection.id)}
                          disabled={selections.length === 1}
                        >
                          Remover
                        </button>
                      </div>

                      <div className="flavor-list">
                        {selection.flavors.map((flavor) => {
                          const currentRow = availableRows.find((row) => row._key === flavor.rowKey)
                          const stock =
                            typeof currentRow?.stock === 'number' && Number.isFinite(currentRow.stock)
                              ? currentRow.stock
                              : null

                          return (
                            <div key={flavor.id} className="flavor-row">
                              <label className="field">
                                <span>Sabor</span>
                                <select
                                  value={flavor.rowKey}
                                  onChange={(event) =>
                                    handleFlavorRowChange(selection.id, flavor.id, event.target.value, product)
                                  }
                                  disabled={!product}
                                >
                                  <option value="">Selecione…</option>
                                  {availableRows.map((row) => (
                                    <option key={row._key} value={row._key}>
                                      {row.flavor}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="field field--inline">
                                <span>Quantidade</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={flavor.quantity}
                                  onChange={(event) =>
                                    handleFlavorQuantityChange(
                                      selection.id,
                                      flavor.id,
                                      Number(event.target.value),
                                      product,
                                    )
                                  }
                                  disabled={!currentRow}
                                  max={stock ?? undefined}
                                  inputMode="numeric"
                                />
                              </label>

                              <span className="stock-indicator">
                                {stock !== null ? `Disponível: ${stock}` : 'Informe o sabor'}
                              </span>

                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => handleRemoveFlavor(selection.id, flavor.id)}
                              >
                                Remover sabor
                              </button>
                            </div>
                          )
                        })}

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleAddFlavor(selection.id)}
                          disabled={!product}
                        >
                          Adicionar sabor
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>

              <button type="button" className="secondary-button add-product" onClick={handleAddProduct}>
                Adicionar outro produto
              </button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-panel">
              <p className="step-description">
                Revise a mensagem abaixo. Ao copiar, o estoque será atualizado automaticamente.
              </p>
              <label className="field">
                <span>Pré-visualização da mensagem</span>
                <textarea readOnly value={messagePreview} rows={Math.max(8, messagePreview.split('\n').length)} />
              </label>

              <div className="review-actions">
                <div className="actions__row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleFinalize('copy')}
                    disabled={processing}
                  >
                    {processing ? 'Processando…' : 'Copiar mensagem'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button secondary-button--outline"
                    onClick={() => handleFinalize('whatsapp')}
                    disabled={processing}
                  >
                    Copiar e abrir WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="form-footer">
          <button type="button" className="outline-button" onClick={handleBack} disabled={currentStep === 0 || processing}>
            Voltar
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleNext}
            disabled={
              currentStep === steps.length - 1 ||
              (currentStep === 0 && !hasClientName) ||
              (currentStep === 1 && !hasValidSelection) ||
              processing
            }
          >
            Avançar
          </button>
        </footer>
      </section>
    </main>
  )
}
