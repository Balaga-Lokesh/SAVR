import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

type PlanMartItem = {
  product_id: number | string
  name: string
  qty: number
  unit_price: number
  line_price: number
}

type PlanMart = {
  mart_id: number | string
  mart_name: string
  distance_km: number
  eta_min: number
  weight_kg: number
  delivery_charge: number
  items: PlanMartItem[]
}

type Plan = {
  items_price: number
  delivery_total: number
  grand_total: number
  eta_total_min: number
  marts: PlanMart[]
}

interface Props {
  open: boolean
  onClose: () => void
  onProceed: () => void
  plan: Plan | null
  originalItems?: Array<{ product_id?: string | number; name?: string; quantity: number; unit_price?: number }>
}

const ExplainSwapsDialog: React.FC<Props> = ({ open, onClose, onProceed, plan, originalItems }) => {
  if (!plan) return null

  const origMap = new Map<string, any>()
  ;(originalItems || []).forEach((it) => origMap.set(String(it.product_id), it))

  // compute original total if possible
  let originalTotal: number | null = 0
  let originalKnown = true
  if (!originalItems || originalItems.length === 0) {
    originalKnown = false
  } else {
    for (const it of originalItems) {
      if (typeof it.unit_price !== 'number') {
        originalKnown = false
        break
      }
      originalTotal = (originalTotal || 0) + (it.unit_price || 0) * (it.quantity || 1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Plan Summary & swaps</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="text-sm text-muted-foreground">Total: ₹{plan.grand_total.toFixed(2)} · ETA: {plan.eta_total_min} mins</div>

          {plan.marts.map((m) => (
            <div key={String(m.mart_id)} className="p-3 bg-card rounded">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{m.mart_name}</div>
                <div className="text-xs text-muted-foreground">Delivery: ₹{m.delivery_charge} · {m.weight_kg}kg</div>
              </div>
              <div className="space-y-1">
                {m.items.map((it) => {
                  const orig = origMap.get(String(it.product_id))
                  const origPrice = orig && typeof orig.unit_price === 'number' ? orig.unit_price : undefined
                  const chosenUnit = it.unit_price || 0
                  const delta = origPrice != null ? (chosenUnit - origPrice) : undefined
                  return (
                    <div key={String(it.product_id)} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{it.qty}× {it.name}</div>
                        <div className="text-xs text-muted-foreground">
                          <span>Chosen: ₹{chosenUnit.toFixed(2)}</span>
                          {origPrice != null && (
                            <span className="ml-3">Original: ₹{origPrice.toFixed(2)}</span>
                          )}
                          {origPrice == null && <span className="ml-2 text-amber-600">(new)</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">₹{it.line_price.toFixed(2)}</div>
                        {delta != null && (
                          <div className={delta <= 0 ? 'text-fresh text-xs' : 'text-destructive text-xs'}>
                            {delta <= 0 ? 'You save' : 'Extra'}: ₹{Math.abs(delta * it.qty).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <Separator />
          <div className="text-sm text-muted-foreground">This plan was generated to minimize cost and delivery fees. Review the items above; proceed to place orders.</div>

          {originalKnown && originalTotal != null && (
            <div className="mt-3 p-3 bg-fresh/5 rounded">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">Original basket total</div>
                <div className="font-semibold">₹{originalTotal.toFixed(2)}</div>
              </div>
              <div className="flex justify-between items-center mt-1">
                <div className="text-sm text-muted-foreground">Optimized plan total</div>
                <div className="font-semibold">₹{plan.grand_total.toFixed(2)}</div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <div className="text-sm">You save</div>
                <div className="font-semibold text-fresh">₹{(originalTotal - plan.grand_total).toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="w-full flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => { onProceed(); onClose() }}>Proceed</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ExplainSwapsDialog
