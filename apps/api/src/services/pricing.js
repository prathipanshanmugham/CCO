// Authoritative price calculation. Everything in rupees here; stored total in paise.
const r0 = (n) => Math.round(n);

export function computeBreakdown({ weightG, metal, stones = [], pricing, overrides = {}, brand = 'CLELIA' }) {
  const rate = overrides.metalRate ?? pricing.metalRates[metal] ?? 0;
  const wastagePercent = overrides.wastagePercent ?? pricing.wastagePercent;
  const makingPerGram = overrides.makingPerGram ?? pricing.makingPerGram;
  const designFee = overrides.designFee ?? pricing.designFee;
  const printAndCasting = overrides.printAndCasting ?? pricing.printAndCasting;
  const gstPercent = overrides.gstPercent ?? pricing.gstPercent;
  const discount = overrides.discount ?? 0;
  const weight = Number(overrides.weightG ?? weightG ?? 0);

  const metalValue = weight * rate;
  const wastage = metalValue * (wastagePercent / 100);
  const making = Math.max(weight * makingPerGram, weight > 0 ? pricing.makingMinimum : 0);
  const stoneLines = stones.map((s) => {
    const unit = s.unitPrice ?? pricing.stoneRates[s.type]?.[s.size || 'small'] ?? 0;
    return { type: s.type, size: s.size || 'small', count: Number(s.count || 0), unitPrice: unit, amount: r0(unit * Number(s.count || 0)) };
  });
  const stonesTotal = stoneLines.reduce((a, l) => a + l.amount, 0);
  const surcharge = brand === 'SCORPLING' ? (metalValue + making) * ((pricing.scorplingSurchargePercent || 0) / 100) : 0;
  const subtotal = metalValue + wastage + making + stonesTotal + designFee + printAndCasting + surcharge - discount;
  const gst = subtotal * (gstPercent / 100);
  const total = subtotal + gst;

  return {
    weightG: Number(weight.toFixed(3)),
    metal,
    metalRate: rate,
    lines: [
      { key: 'metal', label: `Metal (${weight.toFixed(2)} g × ₹${rate}/g)`, amount: r0(metalValue) },
      { key: 'wastage', label: `Wastage ${wastagePercent}%`, amount: r0(wastage) },
      { key: 'making', label: `Making charges (₹${makingPerGram}/g)`, amount: r0(making) },
      ...stoneLines.map((l, i) => ({ key: `stone${i}`, label: `${l.count} × ${l.type} (${l.size})`, amount: l.amount })),
      { key: 'design', label: 'Design fee', amount: r0(designFee) },
      { key: 'print', label: '3D printing & casting', amount: r0(printAndCasting) },
      ...(surcharge ? [{ key: 'surcharge', label: 'Scorpling setting surcharge', amount: r0(surcharge) }] : []),
      ...(discount ? [{ key: 'discount', label: 'Discount', amount: -r0(discount) }] : []),
    ],
    subtotal: r0(subtotal),
    gstPercent,
    gst: r0(gst),
    total: r0(total),
    stones: stoneLines,
    overrides,
  };
}

export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
