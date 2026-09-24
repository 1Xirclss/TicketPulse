const paymentAtEnd = /(?:\s|[,;|:\-])(?:EFECTIVO|EFECTICO|EFECT|CASH|TRANSFERENCIA|TRANSFER|TRANSF|TRANSFE|TRANS)(?:\s*[.!])?\s*$/iu;

export function parseSalesList(input) {
  return input.split(/\r?\n/u).map((raw, index) => ({ raw: raw.trim(), line: index + 1 })).filter(row => row.raw).map(({ raw, line }) => {
    const clean = raw.replace(/^\s*(?:\d+[.)-]|[-*•])\s*/u, '').trim();
    const payment = clean.match(paymentAtEnd);
    const name = (payment ? clean.slice(0, payment.index) : clean).replace(/[\s,;|:\-]+$/u, '').trim();
    const method = payment ? /^EFECT|^CASH/iu.test(payment[0].trim().replace(/^[,;|:\-]\s*/u, '')) ? 'Efectivo' : 'Transferencia' : '';
    let error = '';
    if (!payment) error = /\s+[A-ZÁÉÍÓÚÑ]{3,}\s*$/u.test(clean) ? 'Método de pago no reconocido.' : 'Falta el método de pago.';
    else if (name.length < 2 || name.length > 120) error = 'Revisa el nombre.';
    return { line, raw, name, method, error };
  });
}
